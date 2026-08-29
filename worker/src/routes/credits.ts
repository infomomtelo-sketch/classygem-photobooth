import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { requireAuth } from '../middleware/auth';
import { getBalance } from '../lib/credits';

export const creditsRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

creditsRoute.get('/credits', requireAuth, async (c) => {
  const user = c.get('user');
  const balance = await getBalance(c.env, user.id);
  return c.json({ balance });
});
