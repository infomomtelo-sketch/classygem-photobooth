import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { Env, PersonaRow, Variables } from '../types';
import { requireAuth } from '../middleware/auth';
import { getDmemzAdmin } from '../lib/supabaseAdmin';
import { spendCredits, refundCredits } from '../lib/credits';
import { CREDIT_COSTS } from '../config/creditCosts';
import { AGE_RANGES, HAIR_OPTIONS, BUILD_OPTIONS, SKIN_TONE_OPTIONS, STYLE_VIBE_OPTIONS } from '../config/personaOptions';
import { moderateText } from '../guardrails/moderation';
import { buildSafePrompt } from '../guardrails/safePrompt';
import { buildPersonaPrompt } from '../lib/personaPrompt';
import { submitFalJob } from '../lib/falClient';
import { FAL_FACE_MODEL, FAL_LORA_MODEL, buildFaceCandidatesInput, buildLoraTrainingInput } from '../lib/falRecipes';
import { signMediaToken } from '../lib/signedMedia';

export const personasRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

personasRoute.use('*', requireAuth);

const createPersonaSchema = z.object({
  age_range: z.enum(AGE_RANGES),
  hair: z.enum(HAIR_OPTIONS).optional(),
  build: z.enum(BUILD_OPTIONS).optional(),
  skin_tone: z.enum(SKIN_TONE_OPTIONS).optional(),
  style_vibe: z.enum(STYLE_VIBE_OPTIONS).optional(),
  free_text: z.string().max(500).optional(),
});

personasRoute.post('/personas', async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => null);
  const parsed = createPersonaSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }
  const input = parsed.data;

  if (input.free_text) {
    const moderation = await moderateText(c.env, { userId: user.id, text: input.free_text });
    if (!moderation.approved) {
      return c.json({ error: 'Prompt rejected by content guardrails', hits: moderation.hits }, 422);
    }
  }

  const dmemz = getDmemzAdmin(c.env);
  const { data, error } = await dmemz
    .from('personas')
    .insert({
      user_id: user.id,
      age_range: input.age_range,
      hair: input.hair ?? null,
      build: input.build ?? null,
      skin_tone: input.skin_tone ?? null,
      style_vibe: input.style_vibe ?? null,
      free_text: input.free_text ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    return c.json({ error: 'Failed to create persona' }, 500);
  }
  return c.json({ persona: data as PersonaRow }, 201);
});

personasRoute.get('/personas', async (c) => {
  const user = c.get('user');
  const dmemz = getDmemzAdmin(c.env);
  const { data, error } = await dmemz
    .from('personas')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) return c.json({ error: 'Failed to list personas' }, 500);
  return c.json({ personas: (data ?? []) as PersonaRow[] });
});

personasRoute.get('/personas/:id', async (c) => {
  const persona = await loadOwnedPersona(c);
  if (!persona) return c.json({ error: 'Not found' }, 404);
  return c.json({ persona });
});

personasRoute.post('/personas/:id/face-candidates', async (c) => {
  const user = c.get('user');
  const persona = await loadOwnedPersona(c);
  if (!persona) return c.json({ error: 'Not found' }, 404);
  if (persona.status === 'generating_candidates') {
    return c.json({ error: 'Candidates are already generating for this persona' }, 409);
  }

  const cost = CREDIT_COSTS.face_candidates;
  const spend = await spendCredits(c.env, { userId: user.id, amount: cost, reason: 'face_candidates', referenceId: persona.id });
  if (!spend.ok) {
    return c.json({ error: 'Insufficient credits' }, 402);
  }

  const dmemz = getDmemzAdmin(c.env);
  try {
    const rawPrompt = buildPersonaPrompt(persona);
    const { prompt, negativePrompt } = buildSafePrompt(rawPrompt);
    const falInput = buildFaceCandidatesInput(prompt, negativePrompt);
    const submission = await submitFalJob(c.env.FAL_KEY, FAL_FACE_MODEL, falInput);

    const { data: job, error: jobError } = await dmemz
      .from('generation_jobs')
      .insert({
        user_id: user.id,
        persona_id: persona.id,
        job_type: 'face_candidates',
        fal_request_id: submission.request_id,
        status: 'running',
        credit_cost: cost,
      })
      .select()
      .single();
    if (jobError || !job) throw new Error('Failed to record generation job');

    await dmemz.from('personas').update({ status: 'generating_candidates', updated_at: new Date().toISOString() }).eq('id', persona.id);

    return c.json({ jobId: job.id }, 202);
  } catch (err) {
    await refundCredits(c.env, { userId: user.id, amount: cost, reason: 'face_candidates_refund', referenceId: persona.id });
    return c.json({ error: 'Failed to start face candidate generation', detail: String(err) }, 502);
  }
});

const selectCandidateSchema = z.object({ candidateId: z.string().uuid() });

personasRoute.post('/personas/:id/select-candidate', async (c) => {
  const persona = await loadOwnedPersona(c);
  if (!persona) return c.json({ error: 'Not found' }, 404);
  const body = await c.req.json().catch(() => null);
  const parsed = selectCandidateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);

  const dmemz = getDmemzAdmin(c.env);
  const { data: candidate } = await dmemz
    .from('persona_face_candidates')
    .select('id, persona_id')
    .eq('id', parsed.data.candidateId)
    .single();
  if (!candidate || candidate.persona_id !== persona.id) {
    return c.json({ error: 'Candidate does not belong to this persona' }, 400);
  }

  const { data: updated, error } = await dmemz
    .from('personas')
    .update({ selected_candidate_id: candidate.id, updated_at: new Date().toISOString() })
    .eq('id', persona.id)
    .select()
    .single();
  if (error || !updated) return c.json({ error: 'Failed to select candidate' }, 500);
  return c.json({ persona: updated as PersonaRow });
});

personasRoute.post('/personas/:id/lock-identity', async (c) => {
  const user = c.get('user');
  const persona = await loadOwnedPersona(c);
  if (!persona) return c.json({ error: 'Not found' }, 404);
  if (!persona.selected_candidate_id) {
    return c.json({ error: 'Select a face candidate before locking identity' }, 400);
  }
  if (persona.lora_status === 'training' || persona.lora_status === 'ready') {
    return c.json({ error: `Identity is already ${persona.lora_status} for this persona` }, 409);
  }

  const dmemz = getDmemzAdmin(c.env);
  const { data: candidate } = await dmemz
    .from('persona_face_candidates')
    .select('id, r2_key')
    .eq('id', persona.selected_candidate_id)
    .single();
  if (!candidate) return c.json({ error: 'Selected candidate not found' }, 500);

  const cost = CREDIT_COSTS.lora_training;
  const spend = await spendCredits(c.env, { userId: user.id, amount: cost, reason: 'lora_training', referenceId: persona.id });
  if (!spend.ok) {
    return c.json({ error: 'Insufficient credits' }, 402);
  }

  try {
    const { token } = await signMediaToken(c.env.MEDIA_SIGNING_SECRET, candidate.id);
    const imageUrl = `${c.env.PUBLIC_MEDIA_BASE_URL}/media/candidates/${candidate.id}?token=${token}`;
    const falInput = buildLoraTrainingInput(imageUrl);
    const submission = await submitFalJob(c.env.FAL_KEY, FAL_LORA_MODEL, falInput);

    const { data: job, error: jobError } = await dmemz
      .from('generation_jobs')
      .insert({
        user_id: user.id,
        persona_id: persona.id,
        job_type: 'lora_training',
        fal_request_id: submission.request_id,
        status: 'running',
        credit_cost: cost,
      })
      .select()
      .single();
    if (jobError || !job) throw new Error('Failed to record generation job');

    await dmemz.from('personas').update({ lora_status: 'training', updated_at: new Date().toISOString() }).eq('id', persona.id);

    return c.json({ jobId: job.id }, 202);
  } catch (err) {
    await refundCredits(c.env, { userId: user.id, amount: cost, reason: 'lora_training_refund', referenceId: persona.id });
    return c.json({ error: 'Failed to start LoRA training', detail: String(err) }, 502);
  }
});

async function loadOwnedPersona(c: AppContext): Promise<PersonaRow | null> {
  const user = c.get('user');
  const id = c.req.param('id');
  const dmemz = getDmemzAdmin(c.env);
  const { data, error } = await dmemz.from('personas').select('*').eq('id', id).eq('user_id', user.id).single();
  if (error || !data) return null;
  return data as PersonaRow;
}
