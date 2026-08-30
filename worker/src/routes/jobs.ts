import { Hono, type Context } from 'hono';
import type { Env, GenerationJobRow, Variables } from '../types';
import { requireAuth } from '../middleware/auth';
import { getDmemzAdmin } from '../lib/supabaseAdmin';
import { refundCredits } from '../lib/credits';
import { getFalStatus, getFalResult } from '../lib/falClient';
import {
  FAL_FACE_MODEL,
  FAL_LORA_MODEL,
  FAL_STILLS_MODEL,
  FAL_UPSCALE_MODEL,
  extractLoraWeightsUrl,
  extractUpscaledImage,
  type FaceCandidatesResult,
  type LoraTrainingResult,
  type StillsResult,
  type UpscaleResult,
} from '../lib/falRecipes';
import { moderateMedia } from '../guardrails/moderation';
import { mintMediaUrl } from '../lib/mediaUrls';

export const jobsRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

jobsRoute.use('*', requireAuth);

function falModelFor(jobType: string): string {
  switch (jobType) {
    case 'lora_training':
      return FAL_LORA_MODEL;
    case 'still_generation':
      return FAL_STILLS_MODEL;
    case 'upscale':
      return FAL_UPSCALE_MODEL;
    default:
      return FAL_FACE_MODEL;
  }
}

// Generation is async on fal.ai's side (LoRA training especially can
// take minutes), so the frontend polls this until status settles.
// Finalization -- writing results into dmemz -- only happens here,
// the first time a poll observes COMPLETED; a later re-poll of an
// already-succeeded job just re-reads what was already written.
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

  const modelId = falModelFor(jobRow.job_type);
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
    const finalized = await finalizeJob(c, jobRow);
    return c.json(finalized);
  } catch (err) {
    await failJob(c, jobRow, String(err));
    return c.json({ job: { ...jobRow, status: 'failed' }, error: String(err) }, 502);
  }
});

async function finalizeJob(c: AppContext, job: GenerationJobRow) {
  switch (job.job_type) {
    case 'lora_training':
      return finalizeLoraTraining(c, job);
    case 'still_generation':
      return finalizeStillGeneration(c, job);
    case 'upscale':
      return finalizeUpscale(c, job);
    default:
      return finalizeFaceCandidates(c, job);
  }
}

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
  if (job.job_type === 'lora_training' && job.persona_id) {
    await dmemz.from('personas').update({ lora_status: 'failed', updated_at: new Date().toISOString() }).eq('id', job.persona_id);
  } else if (job.job_type === 'face_candidates' && job.persona_id) {
    await dmemz.from('personas').update({ status: 'draft', updated_at: new Date().toISOString() }).eq('id', job.persona_id);
  }
  // still_generation / upscale failures don't need a persona rollback
  // -- nothing else was optimistically changed for them.
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

  const candidates = await Promise.all(inserted.map(async (row) => ({ ...row, imageUrl: await mintMediaUrl(c, 'candidates', row.id) })));

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

async function finalizeStillGeneration(c: AppContext, job: GenerationJobRow) {
  const user = c.get('user');
  const dmemz = getDmemzAdmin(c.env);
  const result = await getFalResult<StillsResult>(c.env.FAL_KEY, FAL_STILLS_MODEL, job.fal_request_id as string);
  const params = job.params ?? {};

  const inserted: { id: string; r2_key: string | null }[] = [];
  for (const image of result.images) {
    const moderation = await moderateMedia(c.env, {
      userId: user.id,
      subjectType: 'still',
      subjectId: job.persona_id as string,
      mediaUrl: image.url,
    });

    let key: string | null = null;
    if (moderation.approved) {
      const imgRes = await fetch(image.url);
      if (imgRes.ok) {
        const bytes = await imgRes.arrayBuffer();
        key = `personas/${job.persona_id}/stills/${crypto.randomUUID()}.jpg`;
        await c.env.MEDIA_BUCKET.put(key, bytes, { httpMetadata: { contentType: image.content_type ?? 'image/jpeg' } });
      }
    }

    const { data: stillRow } = await dmemz
      .from('stills')
      .insert({
        persona_id: job.persona_id,
        generation_job_id: job.id,
        background_preset_id: params.background_preset_id ?? null,
        custom_background_prompt: params.custom_background_prompt ?? null,
        outfit_prompt: params.outfit_prompt ?? '',
        r2_key: key,
        status: key ? 'ready' : 'rejected_moderation',
        moderation_status: moderation.approved ? 'approved' : 'rejected',
        moderation_reason: moderation.approved ? null : moderation.hits.map((h) => h.category).join(','),
      })
      .select('id, r2_key')
      .single();
    if (stillRow) inserted.push(stillRow);
  }

  await dmemz.from('generation_jobs').update({ status: 'succeeded', updated_at: new Date().toISOString() }).eq('id', job.id);

  const stills = await Promise.all(
    inserted.map(async (row) => ({ ...row, imageUrl: row.r2_key ? await mintMediaUrl(c, 'stills', row.id) : null }))
  );

  return { job: { ...job, status: 'succeeded' }, stills };
}

async function finalizeUpscale(c: AppContext, job: GenerationJobRow) {
  const user = c.get('user');
  const dmemz = getDmemzAdmin(c.env);
  const result = await getFalResult<UpscaleResult>(c.env.FAL_KEY, FAL_UPSCALE_MODEL, job.fal_request_id as string);
  const image = extractUpscaledImage(result);
  if (!image) throw new Error('fal.ai upscale result did not include an image URL');

  const stillId = job.params?.still_id as string | undefined;
  if (!stillId) throw new Error('Upscale job is missing its still_id');

  const moderation = await moderateMedia(c.env, { userId: user.id, subjectType: 'still', subjectId: stillId, mediaUrl: image.url });
  if (!moderation.approved) throw new Error('Upscaled image was rejected by content guardrails');

  const imgRes = await fetch(image.url);
  if (!imgRes.ok) throw new Error('Failed to download upscaled image from fal.ai');
  const bytes = await imgRes.arrayBuffer();
  const key = `personas/${job.persona_id}/upscales/${crypto.randomUUID()}.jpg`;
  await c.env.MEDIA_BUCKET.put(key, bytes, { httpMetadata: { contentType: image.contentType ?? 'image/jpeg' } });

  const { data: upscaleRow } = await dmemz
    .from('upscales')
    .insert({ still_id: stillId, generation_job_id: job.id, r2_key: key, status: 'ready' })
    .select()
    .single();

  await dmemz.from('generation_jobs').update({ status: 'succeeded', updated_at: new Date().toISOString() }).eq('id', job.id);

  const upscale = upscaleRow ? { ...upscaleRow, imageUrl: await mintMediaUrl(c, 'upscales', upscaleRow.id) } : null;

  return { job: { ...job, status: 'succeeded' }, upscale };
}

async function attachResultPayload(c: AppContext, job: GenerationJobRow) {
  const dmemz = getDmemzAdmin(c.env);
  if (job.job_type === 'face_candidates') {
    const { data: candidates } = await dmemz.from('persona_face_candidates').select('*').eq('persona_id', job.persona_id);
    const withUrls = await Promise.all(
      (candidates ?? []).map(async (row) => ({ ...row, imageUrl: await mintMediaUrl(c, 'candidates', row.id) }))
    );
    return { candidates: withUrls };
  }
  if (job.job_type === 'lora_training') {
    const { data: persona } = await dmemz.from('personas').select('*').eq('id', job.persona_id).single();
    return { persona };
  }
  if (job.job_type === 'still_generation') {
    const { data: stills } = await dmemz.from('stills').select('*').eq('generation_job_id', job.id);
    const withUrls = await Promise.all(
      (stills ?? []).map(async (row) => ({ ...row, imageUrl: row.r2_key ? await mintMediaUrl(c, 'stills', row.id) : null }))
    );
    return { stills: withUrls };
  }
  if (job.job_type === 'upscale') {
    const { data: upscale } = await dmemz.from('upscales').select('*').eq('generation_job_id', job.id).single();
    if (!upscale) return {};
    return { upscale: { ...upscale, imageUrl: await mintMediaUrl(c, 'upscales', upscale.id) } };
  }
  return {};
}
