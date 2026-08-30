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

export interface BackgroundPreset {
  id: string;
  slug: string;
  label: string;
  prompt_fragment: string;
}

export interface Still {
  id: string;
  persona_id: string;
  background_preset_id: string | null;
  custom_background_prompt: string | null;
  outfit_prompt: string;
  status: string;
  moderation_status: string;
  imageUrl: string | null;
}

export interface Upscale {
  id: string;
  still_id: string;
  status: string;
  imageUrl: string;
}

export interface MotionPreset {
  id: string;
  label: string;
  promptFragment: string;
}

export interface Video {
  id: string;
  persona_id: string;
  upscale_id: string;
  motion_preset: string;
  status: string;
  videoUrl: string;
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
  stills?: Still[];
  upscale?: Upscale;
  video?: Video;
  error?: string;
}
