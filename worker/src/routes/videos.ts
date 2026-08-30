import { Hono } from 'hono';
import { z } from 'zod';
import type { Env, Variables } from '../types';
import { requireAuth } from '../middleware/auth';
import { getDmemzAdmin } from '../lib/supabaseAdmin';
import { spendCredits, refundCredits } from '../lib/credits';
import { CREDIT_COSTS } from '../config/creditCosts';
import { MOTION_PRESET_IDS, getMotionPreset } from '../config/motionPresets';
import { buildSafePrompt } from '../guardrails/safePrompt';
import { submitFalJob } from '../lib/falClient';
import { FAL_VIDEO_MODEL, buildAnimateInput } from '../lib/falRecipes';
import { mintMediaUrl } from '../lib/mediaUrls';
import { loadOwnedUpscale } from '../lib/ownership';

export const videosRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

videosRoute.use('*', requireAuth);

interface VideoWithPersonaRow {
  id: string;
  persona_id: string;
  upscale_id: string;
  motion_preset: string;
  status: string;
  r2_key: string | null;
  created_at: string;
  personas: { user_id: string; age_range: string; style_vibe: string | null };
}

// The library: every finished video across all of the user's
// personas, newest first. Not scoped to one persona -- the spec
// describes this as one gallery, not a per-model view.
videosRoute.get('/videos', async (c) => {
  const user = c.get('user');
  const dmemz = getDmemzAdmin(c.env);
  const { data, error } = await dmemz
    .from('videos')
    .select('*, personas!inner(user_id, age_range, style_vibe)')
    .eq('personas.user_id', user.id)
    .eq('status', 'ready')
    .order('created_at', { ascending: false });
  if (error) return c.json({ error: 'Failed to list videos' }, 500);

  const rows = (data ?? []) as VideoWithPersonaRow[];
  const videos = await Promise.all(
    rows.map(async (row) => {
      const { personas, ...video } = row;
      return {
        ...video,
        personaLabel: `${personas.age_range} · ${personas.style_vibe ?? 'no vibe set'}`,
        videoUrl: await mintMediaUrl(c, 'videos', video.id),
      };
    })
  );
  return c.json({ videos });
});

const animateSchema = z.object({ motionPreset: z.enum(MOTION_PRESET_IDS) });

// Animation is image-conditioned -- the still already carries the
// locked identity and outfit -- so this only needs a motion prompt,
// not the full persona/outfit/background description used upstream.
videosRoute.post('/upscales/:id/animate', async (c) => {
  const user = c.get('user');
  const upscale = await loadOwnedUpscale(c);
  if (!upscale) return c.json({ error: 'Not found' }, 404);
  if (upscale.status !== 'ready') {
    return c.json({ error: 'Upscale is not ready to animate' }, 400);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = animateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  const preset = getMotionPreset(parsed.data.motionPreset);
  if (!preset) return c.json({ error: 'Unknown motion preset' }, 400);

  const dmemz = getDmemzAdmin(c.env);
  // Checked against generation_jobs rather than the videos table: a
  // video row is only inserted once the job finalizes, so a
  // running-but-not-yet-finalized job would otherwise slip past a
  // check against videos and let someone double-spend on the same
  // (upscale, motion) pair.
  const { data: inFlightOrDone } = await dmemz
    .from('generation_jobs')
    .select('id')
    .eq('job_type', 'video_generation')
    .contains('params', { upscale_id: upscale.id, motion_preset: preset.id })
    .in('status', ['running', 'succeeded']);
  if (inFlightOrDone && inFlightOrDone.length > 0) {
    return c.json({ error: 'This motion preset is already rendering or has been rendered for this still' }, 409);
  }

  const cost = CREDIT_COSTS.video_generation;
  const spend = await spendCredits(c.env, { userId: user.id, amount: cost, reason: 'video_generation', referenceId: upscale.id });
  if (!spend.ok) return c.json({ error: 'Insufficient credits' }, 402);

  try {
    const imageUrl = await mintMediaUrl(c, 'upscales', upscale.id);
    const { prompt } = buildSafePrompt(preset.promptFragment);
    const falInput = buildAnimateInput(prompt, imageUrl);
    const submission = await submitFalJob(c.env.FAL_KEY, FAL_VIDEO_MODEL, falInput);

    const { data: job, error: jobError } = await dmemz
      .from('generation_jobs')
      .insert({
        user_id: user.id,
        persona_id: upscale.persona_id,
        job_type: 'video_generation',
        fal_request_id: submission.request_id,
        status: 'running',
        credit_cost: cost,
        params: { upscale_id: upscale.id, motion_preset: preset.id },
      })
      .select()
      .single();
    if (jobError || !job) throw new Error('Failed to record generation job');

    return c.json({ jobId: job.id }, 202);
  } catch (err) {
    await refundCredits(c.env, { userId: user.id, amount: cost, reason: 'video_generation_refund', referenceId: upscale.id });
    return c.json({ error: 'Failed to start animation', detail: String(err) }, 502);
  }
});
