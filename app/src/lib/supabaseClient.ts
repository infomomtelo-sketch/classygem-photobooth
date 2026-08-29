import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_NWLHS_SUPABASE_URL;
const anonKey = import.meta.env.VITE_NWLHS_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing VITE_NWLHS_SUPABASE_URL / VITE_NWLHS_SUPABASE_ANON_KEY -- copy app/.env.local from .env.example');
}

export const supabase = createClient(url, anonKey);
