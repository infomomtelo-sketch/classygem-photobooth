import { Hono } from 'hono';
import type { Env, Variables } from './types';
import { healthRoute } from './routes/health';
import { creditsRoute } from './routes/credits';
import { optionsRoute } from './routes/options';
import { backgroundsRoute } from './routes/backgrounds';
import { personasRoute } from './routes/personas';
import { stillsRoute } from './routes/stills';
import { jobsRoute } from './routes/jobs';
import { mediaRoute } from './routes/media';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Custom CORS (rather than hono/cors) because the allowed origin is
// an env var, only available per-request via c.env in a Worker.
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  const allowed = c.env.APP_ORIGIN;
  if (origin && (allowed === '*' || origin === allowed)) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Vary', 'Origin');
  }
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }
  await next();
});

app.route('/', healthRoute);
app.route('/', creditsRoute);
app.route('/', optionsRoute);
app.route('/', backgroundsRoute);
app.route('/', personasRoute);
app.route('/', stillsRoute);
app.route('/', jobsRoute);
app.route('/', mediaRoute);

export default app;
