import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { getDmemzAdmin } from '../lib/supabaseAdmin';
import { verifyMediaToken } from '../lib/signedMedia';

// Deliberately not behind requireAuth: fal.ai fetches this URL
// server-to-server and can't present our Supabase session. Access
// control is the signed, resource-scoped, short-lived token instead.
export const mediaRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

mediaRoute.get('/media/candidates/:candidateId', async (c) => {
  const candidateId = c.req.param('candidateId');
  const token = c.req.query('token');
  if (!token || !(await verifyMediaToken(c.env.MEDIA_SIGNING_SECRET, candidateId, token))) {
    return c.json({ error: 'Invalid or expired media token' }, 403);
  }

  const dmemz = getDmemzAdmin(c.env);
  const { data: candidate } = await dmemz.from('persona_face_candidates').select('r2_key').eq('id', candidateId).single();
  if (!candidate) return c.json({ error: 'Not found' }, 404);

  const object = await c.env.MEDIA_BUCKET.get(candidate.r2_key);
  if (!object) return c.json({ error: 'Media not found' }, 404);

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=3300',
    },
  });
});
