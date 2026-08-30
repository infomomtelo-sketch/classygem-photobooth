import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_NWLHS_SUPABASE_URL;
const anonKey = import.meta.env.VITE_NWLHS_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Don't throw here: this module is imported from the app's root
  // (via AuthContext, from main.tsx), so throwing at import time
  // would crash the entire React tree before it ever renders --
  // including the public landing page, which has no dependency on
  // Supabase and must still work even if this is misconfigured.
  // Sign-in itself will fail loudly instead, which is the right
  // place for this to surface.
  console.error(
    'Missing VITE_NWLHS_SUPABASE_URL / VITE_NWLHS_SUPABASE_ANON_KEY -- copy app/.env.local from .env.example. Auth will not work until this is set.'
  );
}

export const supabase = createClient(url || 'https://misconfigured.invalid', anonKey || 'misconfigured');
