import { Hono, type Context } from 'hono';
import type { Env, Variables } from '../types';
import { getDmemzAdmin } from '../lib/supabaseAdmin';
import { verifyMediaToken } from '../lib/signedMedia';
import { serveMediaObject } from '../lib/mediaServing';

// Deliberately not behind requireAuth: fal.ai fetches these URLs
// server-to-server and can't present our Supabase session. Access
// control is the signed, resource-scoped, short-lived token instead.
export const mediaRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

async function isValidToken(c: AppContext, kind: string, id: string): Promise<boolean> {
  const token = c.req.query('token');
  if (!token) return false;
  return verifyMediaToken(c.env.MEDIA_SIGNING_SECRET, `${kind}:${id}`, token);
}

mediaRoute.get('/media/candidates/:id', async (c) => {
  const id = c.req.param('id');
  if (!(await isValidToken(c, 'candidates', id))) {
    return c.json({ error: 'Invalid or expired media token' }, 403);
  }
  const dmemz = getDmemzAdmin(c.env);
  const { data } = await dmemz.from('persona_face_candidates').select('r2_key').eq('id', id).single();
  if (!data) return c.json({ error: 'Not found' }, 404);
  return serveMediaObject(c.env, data.r2_key);
});

mediaRoute.get('/media/stills/:id', async (c) => {
  const id = c.req.param('id');
  if (!(await isValidToken(c, 'stills', id))) {
    return c.json({ error: 'Invalid or expired media token' }, 403);
  }
  const dmemz = getDmemzAdmin(c.env);
  const { data } = await dmemz.from('stills').select('r2_key').eq('id', id).single();
  if (!data?.r2_key) return c.json({ error: 'Not found' }, 404);
  return serveMediaObject(c.env, data.r2_key);
});

mediaRoute.get('/media/upscales/:id', async (c) => {
  const id = c.req.param('id');
  if (!(await isValidToken(c, 'upscales', id))) {
    return c.json({ error: 'Invalid or expired media token' }, 403);
  }
  const dmemz = getDmemzAdmin(c.env);
  const { data } = await dmemz.from('upscales').select('r2_key').eq('id', id).single();
  if (!data?.r2_key) return c.json({ error: 'Not found' }, 404);
  return serveMediaObject(c.env, data.r2_key);
});
