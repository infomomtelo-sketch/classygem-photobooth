import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { getDmemzAdmin } from '../lib/supabaseAdmin';

export const backgroundsRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

backgroundsRoute.get('/backgrounds', async (c) => {
  const dmemz = getDmemzAdmin(c.env);
  const { data, error } = await dmemz
    .from('background_presets')
    .select('id, slug, label, prompt_fragment, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) return c.json({ error: 'Failed to load backgrounds' }, 500);
  return c.json({ backgrounds: data ?? [] });
});
