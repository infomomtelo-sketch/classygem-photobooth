import { Hono } from 'hono';
import type { Env, Variables } from '../types';

export const healthRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

healthRoute.get('/health', (c) => c.json({ ok: true }));
