import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../types';

// Module-scope caching is safe here: env vars are fixed per
// deployment and Workers reuse module scope across requests within
// the same isolate, so this avoids reconstructing the client (and
// its internal fetch config) on every call.
let nwlhsClient: SupabaseClient | null = null;
let dmemzClient: SupabaseClient | null = null;

export function getNwlhsAdmin(env: Env): SupabaseClient {
  if (!nwlhsClient) {
    nwlhsClient = createClient(env.NWLHS_SUPABASE_URL, env.NWLHS_SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return nwlhsClient;
}

export function getDmemzAdmin(env: Env): SupabaseClient {
  if (!dmemzClient) {
    dmemzClient = createClient(env.DMEMZ_SUPABASE_URL, env.DMEMZ_SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return dmemzClient;
}
