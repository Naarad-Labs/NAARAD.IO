-- Dubbing job tracking and voice clone consent management.
--
-- Creates tables for managing dubbing requests and voice clone consent.
-- The key schema fix: sarvam_jobs.id is uuid, so voice_clone_consents.job_id
-- must also be uuid (was incorrectly bigint in an earlier version).
--
--   dubbing_jobs(id, sarvam_job_id, dubbing_job_id, user_id, voice, target_locale, status)
--   voice_clone_consents(id, user_id, job_id, voice, granted_at, withdrawn_at)
--
-- The sarvam_jobs table (from 0002) tracks the dubbing request to Sarvam AI.
-- This table tracks the local state of the dubbing process, linking to both
-- the sarvam job and any dubbing-specific metadata.
--
-- Voice clones require explicit consent - users can grant a one-time permission
-- for their voice to be used for cloning, which is tracked in voice_clone_consents.
--
-- Reversible: yes — both tables drop cleanly.

create table public.dubbing_jobs (
  id              uuid primary key default gen_random_uuid(),
  sarvam_job_id   uuid references public.sarvam_jobs (id) on delete cascade,
  dubbing_job_id  text,
  user_id         uuid not null references auth.users (id) on delete cascade,
  voice           text not null check (char_length(voice) between 1 and 100),
  target_locale   text not null check (char_length(target_locale) between 2 and 20),
  status          text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create table public.voice_clone_consents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  job_id      uuid not null references public.sarvam_jobs (id) on delete cascade,
  voice       text not null check (char_length(voice) between 1 and 100),
  granted_at  timestamptz not null default now(),
  withdrawn_at timestamptz
);

create index dubbing_jobs_user_idx on public.dubbing_jobs (user_id);
create index dubbing_jobs_status_idx on public.dubbing_jobs (status);
create index voice_clone_consents_user_idx on public.voice_clone_consents (user_id);
create index voice_clone_consents_job_idx on public.voice_clone_consents (job_id);

alter table public.dubbing_jobs enable row level security;
alter table public.voice_clone_consents enable row level security;

revoke all on public.dubbing_jobs, public.voice_clone_consents from public, anon;
grant select, insert, update, delete on public.dubbing_jobs to authenticated;
grant select, insert, update, delete on public.voice_clone_consents to authenticated;

-- Users can read and write their own dubbing jobs
create policy dubbing_jobs_select_own on public.dubbing_jobs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy dubbing_jobs_insert_own on public.dubbing_jobs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy dubbing_jobs_update_own on public.dubbing_jobs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy dubbing_jobs_delete_own on public.dubbing_jobs
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Users can read and write their own voice clone consents
create policy voice_clone_consents_select_own on public.voice_clone_consents
  for select to authenticated using ((select auth.uid()) = user_id);
create policy voice_clone_consents_insert_own on public.voice_clone_consents
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy voice_clone_consents_update_own on public.voice_clone_consents
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy voice_clone_consents_delete_own on public.voice_clone_consents
  for delete to authenticated using ((select auth.uid()) = user_id);