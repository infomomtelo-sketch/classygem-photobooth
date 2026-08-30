export interface PersonaOptions {
  ageRanges: string[];
  hair: string[];
  build: string[];
  skinTone: string[];
  styleVibe: string[];
}

export interface Persona {
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

export interface Candidate {
  id: string;
  persona_id: string;
  r2_key: string;
  seed: number | null;
  created_at: string;
  imageUrl: string;
}

export interface GenerationJob {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  job_type: string;
}

export interface JobPollResult {
  job: GenerationJob;
  candidates?: Candidate[];
  persona?: Persona;
  error?: string;
}
