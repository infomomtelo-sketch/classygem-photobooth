import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { MOTION_PRESETS } from '../config/motionPresets';

export const motionPresetsRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

motionPresetsRoute.get('/motion-presets', (c) => c.json({ motionPresets: MOTION_PRESETS }));
