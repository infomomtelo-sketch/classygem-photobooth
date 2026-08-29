-- dmemz: app data (personas, generation pipeline, moderation log).
--
-- This project has no Supabase Auth of its own -- accounts live in
-- the separate "nwlhs" project. RLS is enabled everywhere below but
-- no policies are granted to anon/authenticated, so auth.uid() is
-- never used here. The only path in is the service-role client, used
-- exclusively by the Worker, which verifies the nwlhs session and
-- enforces per-user access in application code before every query.

create table public.personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'draft', -- draft | candidates_ready | identity_locked | archived
  age_range text not null, -- structured option, e.g. '25-34' | '35-45'
  hair text,
  build text,
  skin_tone text,
  style_vibe text,
  free_text text,
  selected_candidate_id uuid,
  lora_id text, -- fal.ai LoRA reference, set once training succeeds
  lora_status text not null default 'none', -- none | training | ready | failed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index personas_user_id_idx on public.personas (user_id);

create table public.persona_face_candidates (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.personas(id) on delete cascade,
  r2_key text not null,
  seed bigint,
  created_at timestamptz not null default now()
);

create index persona_face_candidates_persona_id_idx on public.persona_face_candidates (persona_id);

alter table public.personas
  add constraint personas_selected_candidate_fk
  foreign key (selected_candidate_id) references public.persona_face_candidates(id);

create table public.background_presets (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  prompt_fragment text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

insert into public.background_presets (slug, label, prompt_fragment, sort_order) values
  ('studio_seamless', 'Studio Seamless', 'seamless studio backdrop, soft diffused lighting, minimal shadow', 1),
  ('rooftop_golden_hour', 'Rooftop, Golden Hour', 'rooftop terrace at golden hour, warm low sun, city skyline in soft focus', 2),
  ('city_street', 'City Street', 'urban city street, natural daylight, candid editorial energy', 3),
  ('beach', 'Beach', 'open beach at soft daylight, ocean horizon, natural breeze', 4),
  ('cafe', 'Cafe', 'small European cafe interior, warm ambient light, shallow depth of field', 5),
  ('penthouse', 'Penthouse', 'modern penthouse interior, floor-to-ceiling windows, soft natural light', 6),
  ('runway', 'Runway', 'fashion runway, dramatic overhead lighting, dark backdrop', 7),
  ('garden', 'Garden', 'lush garden setting, dappled natural light, greenery backdrop', 8)
on conflict (slug) do nothing;

create table public.stills (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.personas(id) on delete cascade,
  background_preset_id uuid references public.background_presets(id),
  custom_background_prompt text,
  outfit_prompt text not null,
  r2_key text,
  status text not null default 'pending', -- pending | rendering | ready | failed | rejected_moderation
  moderation_status text not null default 'pending', -- pending | approved | rejected
  moderation_reason text,
  seed bigint,
  created_at timestamptz not null default now()
);

create index stills_persona_id_idx on public.stills (persona_id);

create table public.upscales (
  id uuid primary key default gen_random_uuid(),
  still_id uuid not null references public.stills(id) on delete cascade,
  r2_key text,
  status text not null default 'pending', -- pending | processing | ready | failed
  created_at timestamptz not null default now()
);

create index upscales_still_id_idx on public.upscales (still_id);

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.personas(id) on delete cascade,
  upscale_id uuid not null references public.upscales(id),
  motion_preset text not null, -- slow_turn | walking_toward_camera | hair_in_wind | subtle_idle | over_shoulder_look
  r2_key text,
  status text not null default 'pending', -- pending | rendering | ready | failed | rejected_moderation
  moderation_status text not null default 'pending',
  moderation_reason text,
  duration_seconds integer not null default 5,
  aspect_ratio text not null default '9:16',
  created_at timestamptz not null default now()
);

create index videos_persona_id_idx on public.videos (persona_id);

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  persona_id uuid references public.personas(id) on delete cascade,
  job_type text not null, -- face_candidates | lora_training | still_generation | upscale | video_generation
  fal_request_id text,
  status text not null default 'queued', -- queued | running | succeeded | failed
  credit_cost integer,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index generation_jobs_user_id_idx on public.generation_jobs (user_id);
create index generation_jobs_persona_id_idx on public.generation_jobs (persona_id);

create table public.moderation_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  subject_type text not null, -- prompt | still | video
  subject_id uuid,
  input_excerpt text,
  outcome text not null, -- blocked | flagged | approved
  rule text,
  created_at timestamptz not null default now()
);

create index moderation_log_user_id_idx on public.moderation_log (user_id);

-- Ops-editable supplement to the Worker's hard-coded guardrail
-- patterns (see worker/src/guardrails/blocklist.ts) -- add terms
-- here to extend coverage without a redeploy. match_type 'regex'
-- patterns are compiled case-insensitively.
create table public.blocklist_terms (
  id uuid primary key default gen_random_uuid(),
  category text not null, -- explicit | minor | named_person
  pattern text not null,
  match_type text not null default 'literal', -- literal | regex
  created_at timestamptz not null default now()
);

alter table public.personas enable row level security;
alter table public.persona_face_candidates enable row level security;
alter table public.background_presets enable row level security;
alter table public.stills enable row level security;
alter table public.upscales enable row level security;
alter table public.videos enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.moderation_log enable row level security;
alter table public.blocklist_terms enable row level security;
