-- Phase 3 additions: still generation and upscale jobs need to carry
-- their request params (background/outfit) across the async gap
-- between submission and finalization, and the resulting rows need a
-- direct link back to the job that produced them so a re-poll of an
-- already-succeeded job can find its results without guessing.

alter table public.generation_jobs add column params jsonb;

alter table public.stills add column generation_job_id uuid references public.generation_jobs(id);
alter table public.upscales add column generation_job_id uuid references public.generation_jobs(id);

create index stills_generation_job_id_idx on public.stills (generation_job_id);
create index upscales_generation_job_id_idx on public.upscales (generation_job_id);
