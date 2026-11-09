-- Reverses 0003_dubbing.sql.
--
-- Drops the policies and indexes first, then the tables.
-- The sarvam_jobs and sarvam_credits tables remain (from 0002).

drop index if exists public.voice_clone_consents_job_idx;
drop index if exists public.voice_clone_consents_user_idx;
drop index if exists public.dubbing_jobs_status_idx;
drop index if exists public.dubbing_jobs_user_idx;

drop table if exists public.voice_clone_consents;
drop table if exists public.dubbing_jobs;