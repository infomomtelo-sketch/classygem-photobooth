import { Hono } from 'hono';
import { z } from 'zod';
import type { Env, Variables } from '../types';
import { requireAuth } from '../middleware/auth';
import { getDmemzAdmin } from '../lib/supabaseAdmin';
import { spendCredits, refundCredits } from '../lib/credits';
import { CREDIT_COSTS } from '../config/creditCosts';
import { moderateText } from '../guardrails/moderation';
import { buildSafePrompt } from '../guardrails/safePrompt';
import { buildStillPrompt } from '../lib/personaPrompt';
import { submitFalJob } from '../lib/falClient';
import { FAL_STILLS_MODEL, FAL_UPSCALE_MODEL, buildStillsInput, buildUpscaleInput } from '../lib/falRecipes';
import { mintMediaUrl } from '../lib/mediaUrls';
import { loadOwnedPersona, loadOwnedStill } from '../lib/ownership';

export const stillsRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

stillsRoute.use('*', requireAuth);

const createStillsSchema = z
  .object({
    backgroundPresetId: z.string().uuid().optional(),
    customBackgroundPrompt: z.string().min(1).max(300).optional(),
    outfitPrompt: z.string().min(1).max(300),
  })
  .refine((v) => Boolean(v.backgroundPresetId) !== Boolean(v.customBackgroundPrompt), {
    message: 'Provide exactly one of backgroundPresetId or customBackgroundPrompt',
  });

// Renders 4 stills against the persona's locked LoRA. Quality here
// depends on generation order (design -> lock identity -> stills ->
// upscale -> animate), so this route refuses to run before
// lora_status is 'ready'.
stillsRoute.post('/personas/:id/stills', async (c) => {
  const user = c.get('user');
  const persona = await loadOwnedPersona(c);
  if (!persona) return c.json({ error: 'Not found' }, 404);
  if (persona.lora_status !== 'ready' || !persona.lora_id) {
    return c.json({ error: "Lock the model's identity before generating stills" }, 400);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = createStillsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }
  const input = parsed.data;

  const dmemz = getDmemzAdmin(c.env);
  let backgroundFragment: string;
  if (input.backgroundPresetId) {
    const { data: preset } = await dmemz
      .from('background_presets')
      .select('id, prompt_fragment')
      .eq('id', input.backgroundPresetId)
      .eq('is_active', true)
      .single();
    if (!preset) return c.json({ error: 'Unknown background preset' }, 400);
    backgroundFragment = preset.prompt_fragment;
  } else {
    const moderation = await moderateText(c.env, { userId: user.id, text: input.customBackgroundPrompt as string });
    if (!moderation.approved) {
      return c.json({ error: 'Background prompt rejected by content guardrails', hits: moderation.hits }, 422);
    }
    backgroundFragment = input.customBackgroundPrompt as string;
  }

  const outfitModeration = await moderateText(c.env, { userId: user.id, text: input.outfitPrompt });
  if (!outfitModeration.approved) {
    return c.json({ error: 'Outfit prompt rejected by content guardrails', hits: outfitModeration.hits }, 422);
  }

  const cost = CREDIT_COSTS.still_generation;
  const spend = await spendCredits(c.env, { userId: user.id, amount: cost, reason: 'still_generation', referenceId: persona.id });
  if (!spend.ok) return c.json({ error: 'Insufficient credits' }, 402);

  try {
    const rawPrompt = buildStillPrompt(persona, backgroundFragment, input.outfitPrompt);
    const { prompt, negativePrompt } = buildSafePrompt(rawPrompt);
    const falInput = buildStillsInput(prompt, negativePrompt, persona.lora_id);
    const submission = await submitFalJob(c.env.FAL_KEY, FAL_STILLS_MODEL, falInput);

    const { data: job, error: jobError } = await dmemz
      .from('generation_jobs')
      .insert({
        user_id: user.id,
        persona_id: persona.id,
        job_type: 'still_generation',
        fal_request_id: submission.request_id,
        status: 'running',
        credit_cost: cost,
        params: {
          background_preset_id: input.backgroundPresetId ?? null,
          custom_background_prompt: input.customBackgroundPrompt ?? null,
          outfit_prompt: input.outfitPrompt,
        },
      })
      .select()
      .single();
    if (jobError || !job) throw new Error('Failed to record generation job');

    return c.json({ jobId: job.id }, 202);
  } catch (err) {
    await refundCredits(c.env, { userId: user.id, amount: cost, reason: 'still_generation_refund', referenceId: persona.id });
    return c.json({ error: 'Failed to start still generation', detail: String(err) }, 502);
  }
});

stillsRoute.get('/personas/:id/stills', async (c) => {
  const persona = await loadOwnedPersona(c);
  if (!persona) return c.json({ error: 'Not found' }, 404);
  const dmemz = getDmemzAdmin(c.env);
  const { data, error } = await dmemz
    .from('stills')
    .select('*')
    .eq('persona_id', persona.id)
    .order('created_at', { ascending: false });
  if (error) return c.json({ error: 'Failed to list stills' }, 500);
  const stills = await Promise.all(
    (data ?? []).map(async (row) => ({ ...row, imageUrl: row.r2_key ? await mintMediaUrl(c, 'stills', row.id) : null }))
  );
  return c.json({ stills });
});

// Upscaling is what "chooses" a still -- there's no separate select
// step like face candidates have, since the upscale call itself
// designates the winner.
stillsRoute.post('/stills/:id/upscale', async (c) => {
  const user = c.get('user');
  const still = await loadOwnedStill(c);
  if (!still) return c.json({ error: 'Not found' }, 404);
  if (still.status !== 'ready' || still.moderation_status !== 'approved') {
    return c.json({ error: 'Still is not ready to upscale' }, 400);
  }

  const dmemz = getDmemzAdmin(c.env);
  const { data: existing } = await dmemz
    .from('upscales')
    .select('id, status')
    .eq('still_id', still.id)
    .in('status', ['pending', 'processing', 'ready']);
  if (existing && existing.length > 0) {
    return c.json({ error: 'This still is already upscaled or upscaling' }, 409);
  }

  const cost = CREDIT_COSTS.upscale;
  const spend = await spendCredits(c.env, { userId: user.id, amount: cost, reason: 'upscale', referenceId: still.id });
  if (!spend.ok) return c.json({ error: 'Insufficient credits' }, 402);

  try {
    const imageUrl = await mintMediaUrl(c, 'stills', still.id);
    const falInput = buildUpscaleInput(imageUrl);
    const submission = await submitFalJob(c.env.FAL_KEY, FAL_UPSCALE_MODEL, falInput);

    const { data: job, error: jobError } = await dmemz
      .from('generation_jobs')
      .insert({
        user_id: user.id,
        persona_id: still.persona_id,
        job_type: 'upscale',
        fal_request_id: submission.request_id,
        status: 'running',
        credit_cost: cost,
        params: { still_id: still.id },
      })
      .select()
      .single();
    if (jobError || !job) throw new Error('Failed to record generation job');

    return c.json({ jobId: job.id }, 202);
  } catch (err) {
    await refundCredits(c.env, { userId: user.id, amount: cost, reason: 'upscale_refund', referenceId: still.id });
    return c.json({ error: 'Failed to start upscale', detail: String(err) }, 502);
  }
});
