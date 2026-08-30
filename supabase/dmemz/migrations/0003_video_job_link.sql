-- Same job->result linkage as 0002, extended to videos so a re-poll
-- of an already-succeeded video_generation job can find its exact
-- result instead of guessing from recency.
alter table public.videos add column generation_job_id uuid references public.generation_jobs(id);
create index videos_generation_job_id_idx on public.videos (generation_job_id);
