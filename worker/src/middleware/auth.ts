import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../types';
import { getNwlhsAdmin } from '../lib/supabaseAdmin';

// Verifies the bearer token against nwlhs (the auth project) on
// every request via Supabase Auth's /user endpoint. This works
// regardless of whether the project signs JWTs with a shared secret
// or asymmetric keys, and needs no local secret management -- the
// small latency cost of the round trip is worth not having to keep a
// second copy of Supabase's key-rotation logic in the Worker.
export const requireAuth: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (c, next) => {
  const authHeader = c.req.header('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return c.json({ error: 'Missing bearer token' }, 401);
  }

  const nwlhs = getNwlhsAdmin(c.env);
  const { data, error } = await nwlhs.auth.getUser(token);
  if (error || !data?.user) {
    return c.json({ error: 'Invalid or expired session' }, 401);
  }

  c.set('user', { id: data.user.id, email: data.user.email ?? null });
  await next();
};
