import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { PERSONA_OPTIONS } from '../config/personaOptions';

export const optionsRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

optionsRoute.get('/options', (c) => c.json(PERSONA_OPTIONS));
