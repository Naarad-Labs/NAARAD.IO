-- Reverses 0002_sarvam.sql.
--
-- Drops the policy and function first, then the tables. The jobs created
-- by dubbing remain but become read-only if the table is gone.

revoke execute on function public.spend_credits(uuid, numeric) from service_role;
drop function if exists public.spend_credits(uuid, numeric);

drop table if exists public.sarvam_credits;
drop table if exists public.sarvam_jobs;