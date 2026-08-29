/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NWLHS_SUPABASE_URL: string;
  readonly VITE_NWLHS_SUPABASE_ANON_KEY: string;
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
