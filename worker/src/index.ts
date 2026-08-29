import { Hono } from 'hono';
import type { Env, Variables } from './types';
import { healthRoute } from './routes/health';
import { creditsRoute } from './routes/credits';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.route('/', healthRoute);
app.route('/', creditsRoute);

export default app;
