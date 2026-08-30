export interface Env {
  NWLHS_SUPABASE_URL: string;
  NWLHS_SUPABASE_SERVICE_ROLE_KEY: string;
  DMEMZ_SUPABASE_URL: string;
  DMEMZ_SUPABASE_SERVICE_ROLE_KEY: string;
  FAL_KEY: string;
  MEDIA_BUCKET: R2Bucket;
  APP_ORIGIN: string;
  PUBLIC_MEDIA_BASE_URL: string;
  MEDIA_SIGNING_SECRET: string;
}

export interface AuthedUser {
  id: string;
  email: string | null;
}

export interface Variables {
  user: AuthedUser;
}

export interface PersonaRow {
  id: string;
  user_id: string;
  status: string;
  age_range: string;
  hair: string | null;
  build: string | null;
  skin_tone: string | null;
  style_vibe: string | null;
  free_text: string | null;
  selected_candidate_id: string | null;
  lora_id: string | null;
  lora_status: string;
  created_at: string;
  updated_at: string;
}

export interface GenerationJobRow {
  id: string;
  user_id: string;
  persona_id: string | null;
  job_type: string;
  fal_request_id: string | null;
  status: string;
  credit_cost: number | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}
