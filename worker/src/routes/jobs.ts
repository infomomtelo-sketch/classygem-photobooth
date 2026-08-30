import { Hono, type Context } from 'hono';
import type { Env, GenerationJobRow, Variables } from '../types';
import { requireAuth } from '../middleware/auth';
import { getDmemzAdmin } from '../lib/supabaseAdmin';
import { refundCredits } from '../lib/credits';
import { getFalStatus, getFalResult } from '../lib/falClient';
import {
  FAL_FACE_MODEL,
  FAL_LORA_MODEL,
  extractLoraWeightsUrl,
  type FaceCandidatesResult,
  type LoraTrainingResult,
} from '../lib/falRecipes';
import { moderateMedia } from '../guardrails/moderation';
import { signMediaToken } from '../lib/signedMedia';

export const jobsRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

jobsRoute.use('*', requireAuth);

// Generation is async on fal.ai's side (LoRA training especially can
// take minutes), so the frontend polls this until status settles.
// Finalization -- writing candidates/LoRA results into dmemz -- only
// happens here, the first time a poll observes COMPLETED.
jobsRoute.get('/jobs/:id', async (c) => {
  const user = c.get('user');
  const dmemz = getDmemzAdmin(c.env);
  const { data: job, error } = await dmemz
    .from('generation_jobs')
    .select('*')
    .eq('id', c.req.param('id'))
    .eq('user_id', user.id)
    .single();
  if (error || !job) return c.json({ error: 'Not found' }, 404);

  const jobRow = job as GenerationJobRow;

  if (jobRow.status === 'succeeded' || jobRow.status === 'failed') {
    const extra = jobRow.status === 'succeeded' ? await attachResultPayload(c, jobRow) : {};
    return c.json({ job: jobRow, ...extra });
  }

  if (!jobRow.fal_request_id) {
    return c.json({ job: jobRow, error: 'Job has no fal.ai request id' }, 500);
  }

  const modelId = jobRow.job_type === 'lora_training' ? FAL_LORA_MODEL : FAL_FACE_MODEL;
  let statusResp;
  try {
    statusResp = await getFalStatus(c.env.FAL_KEY, modelId, jobRow.fal_request_id);
  } catch (err) {
    return c.json({ job: jobRow, error: `Failed to check job status: ${String(err)}` }, 502);
  }

  if (statusResp.status !== 'COMPLETED') {
    return c.json({ job: { ...jobRow, status: 'running' }, falStatus: statusResp.status });
  }

  try {
    const finalized =
      jobRow.job_type === 'lora_training'
        ? await finalizeLoraTraining(c, jobRow)
        : await finalizeFaceCandidates(c, jobRow);
    return c.json(finalized);
  } catch (err) {
    await failJob(c, jobRow, String(err));
    return c.json({ job: { ...jobRow, status: 'failed' }, error: String(err) }, 502);
  }
});

async function failJob(c: AppContext, job: GenerationJobRow, message: string): Promise<void> {
  const user = c.get('user');
  const dmemz = getDmemzAdmin(c.env);
  await dmemz
    .from('generation_jobs')
    .update({ status: 'failed', error: message, updated_at: new Date().toISOString() })
    .eq('id', job.id);
  if (job.credit_cost) {
    await refundCredits(c.env, {
      userId: user.id,
      amount: job.credit_cost,
      reason: `${job.job_type}_refund`,
      referenceId: job.persona_id ?? undefined,
    });
  }
  if (!job.persona_id) return;
  if (job.job_type === 'lora_training') {
    await dmemz.from('personas').update({ lora_status: 'failed', updated_at: new Date().toISOString() }).eq('id', job.persona_id);
  } else {
    await dmemz.from('personas').update({ status: 'draft', updated_at: new Date().toISOString() }).eq('id', job.persona_id);
  }
}

async function finalizeFaceCandidates(c: AppContext, job: GenerationJobRow) {
  const user = c.get('user');
  const dmemz = getDmemzAdmin(c.env);
  const result = await getFalResult<FaceCandidatesResult>(c.env.FAL_KEY, FAL_FACE_MODEL, job.fal_request_id as string);

  const inserted: { id: string; persona_id: string; r2_key: string; seed: number | null; created_at: string }[] = [];
  for (const image of result.images) {
    const moderation = await moderateMedia(c.env, {
      userId: user.id,
      subjectType: 'still',
      subjectId: job.persona_id as string,
      mediaUrl: image.url,
    });
    if (!moderation.approved) continue;

    const imgRes = await fetch(image.url);
    if (!imgRes.ok) continue;
    const bytes = await imgRes.arrayBuffer();
    const key = `personas/${job.persona_id}/candidates/${crypto.randomUUID()}.jpg`;
    await c.env.MEDIA_BUCKET.put(key, bytes, { httpMetadata: { contentType: image.content_type ?? 'image/jpeg' } });

    const { data: candidateRow } = await dmemz
      .from('persona_face_candidates')
      .insert({ persona_id: job.persona_id, r2_key: key })
      .select()
      .single();
    if (candidateRow) inserted.push(candidateRow);
  }

  await dmemz.from('generation_jobs').update({ status: 'succeeded', updated_at: new Date().toISOString() }).eq('id', job.id);
  await dmemz.from('personas').update({ status: 'candidates_ready', updated_at: new Date().toISOString() }).eq('id', job.persona_id);

  const candidates = await Promise.all(inserted.map(async (row) => ({ ...row, imageUrl: await mintCandidateUrl(c, row.id) })));

  return { job: { ...job, status: 'succeeded' }, candidates };
}

async function finalizeLoraTraining(c: AppContext, job: GenerationJobRow) {
  const dmemz = getDmemzAdmin(c.env);
  const result = await getFalResult<LoraTrainingResult>(c.env.FAL_KEY, FAL_LORA_MODEL, job.fal_request_id as string);
  const loraUrl = extractLoraWeightsUrl(result);
  if (!loraUrl) throw new Error('fal.ai training result did not include a LoRA weights URL');

  await dmemz.from('generation_jobs').update({ status: 'succeeded', updated_at: new Date().toISOString() }).eq('id', job.id);
  const { data: persona } = await dmemz
    .from('personas')
    .update({ lora_id: loraUrl, lora_status: 'ready', status: 'identity_locked', updated_at: new Date().toISOString() })
    .eq('id', job.persona_id)
    .select()
    .single();

  return { job: { ...job, status: 'succeeded' }, persona };
}

async function attachResultPayload(c: AppContext, job: GenerationJobRow) {
  const dmemz = getDmemzAdmin(c.env);
  if (job.job_type === 'face_candidates') {
    const { data: candidates } = await dmemz.from('persona_face_candidates').select('*').eq('persona_id', job.persona_id);
    const withUrls = await Promise.all(
      (candidates ?? []).map(async (row) => ({ ...row, imageUrl: await mintCandidateUrl(c, row.id) }))
    );
    return { candidates: withUrls };
  }
  if (job.job_type === 'lora_training') {
    const { data: persona } = await dmemz.from('personas').select('*').eq('id', job.persona_id).single();
    return { persona };
  }
  return {};
}

async function mintCandidateUrl(c: AppContext, candidateId: string): Promise<string> {
  const { token } = await signMediaToken(c.env.MEDIA_SIGNING_SECRET, candidateId);
  return `${c.env.PUBLIC_MEDIA_BASE_URL}/media/candidates/${candidateId}?token=${token}`;
}
