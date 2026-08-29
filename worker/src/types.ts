export interface Env {
  NWLHS_SUPABASE_URL: string;
  NWLHS_SUPABASE_SERVICE_ROLE_KEY: string;
  DMEMZ_SUPABASE_URL: string;
  DMEMZ_SUPABASE_SERVICE_ROLE_KEY: string;
  FAL_KEY: string;
  MEDIA_BUCKET: R2Bucket;
}

export interface AuthedUser {
  id: string;
  email: string | null;
}

export interface Variables {
  user: AuthedUser;
}
