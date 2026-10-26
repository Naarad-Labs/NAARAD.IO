-- Reverses 0001_creator_accounts.sql.
-- WARNING: ERASES all creator submissions and profiles.

drop table if exists public.creator_submissions;
drop table if exists public.profiles;

drop type if exists public.submission_status;

drop function if exists public.creator_submissions_guard();
drop function if exists public.delete_my_account();

do $$
begin
  if to_regclass('public._naarad_migrations') is not null then
    delete from public._naarad_migrations where name = '0001_creator_accounts.sql';
  end if;
end $$;
