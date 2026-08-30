import type { Context } from 'hono';
import type { Env, PersonaRow, Variables } from '../types';
import { getDmemzAdmin } from './supabaseAdmin';

type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

export async function loadOwnedPersona(c: AppContext, personaId?: string): Promise<PersonaRow | null> {
  const user = c.get('user');
  const id = personaId ?? c.req.param('id');
  const dmemz = getDmemzAdmin(c.env);
  const { data, error } = await dmemz.from('personas').select('*').eq('id', id).eq('user_id', user.id).single();
  if (error || !data) return null;
  return data as PersonaRow;
}

export interface StillRow {
  id: string;
  persona_id: string;
  background_preset_id: string | null;
  custom_background_prompt: string | null;
  outfit_prompt: string;
  r2_key: string | null;
  status: string;
  moderation_status: string;
  moderation_reason: string | null;
  seed: number | null;
  generation_job_id: string | null;
  created_at: string;
}

// stills has no user_id of its own -- ownership runs through its
// persona, so this filters via an inner-joined embed rather than a
// second round trip.
export async function loadOwnedStill(c: AppContext, stillId?: string): Promise<StillRow | null> {
  const user = c.get('user');
  const id = stillId ?? c.req.param('id');
  const dmemz = getDmemzAdmin(c.env);
  const { data, error } = await dmemz
    .from('stills')
    .select('*, personas!inner(user_id)')
    .eq('id', id)
    .eq('personas.user_id', user.id)
    .single();
  if (error || !data) return null;
  const { personas: _owner, ...still } = data as StillRow & { personas: { user_id: string } };
  return still as StillRow;
}
