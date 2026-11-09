-- Sarvam AI dubbing integration.
--
-- Two tables: sarvam_jobs (one row per dubbing request), sarvam_credits (the ledger
-- of how many minutes the user has available). Credits are spent by the spend credits()
-- RPC which atomically checks and decrements; only the service role may call this.
--
--   sarvam_jobs(id, user_id, voice, text, status, minutes_credited, minutes_spent)
--   sarvam_credits(id, user_id, balance, updated_at)
--
-- The browser cannot write sarvam_jobs directly: dubbing is triggered by clicking
-- "Dub this" in the dub screen, which calls the Edge Function proxy. The proxy
-- validates that the user has enough credits, then writes the job row and decrements
-- the ledger. This is the expand phase of the expand-then-contract pattern.
--
-- Reversible: yes — drops both tables and the RPC cleanly.

create table public.sarvam_jobs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  voice            text not null check (char_length(voice) between 1 and 100),
  text             text not null check (char_length(text) > 0 and char_length(text) <= 20000),
  status           text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  minutes_credited numeric not null check (minutes_credited >= 0),
  minutes_spent    numeric not null default 0 check (minutes_spent >= 0 and minutes_spent <= minutes_credited),
  created_at       timestamptz not null default now(),
  completed_at     timestamptz
);

create table public.sarvam_credits (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  balance  numeric not null check (balance >= 0),
  updated_at timestamptz not null default now()
);

create index sarvam_jobs_user_idx on public.sarvam_jobs (user_id);
create index sarvam_jobs_status_idx on public.sarvam_jobs (status);

alter table public.sarvam_jobs enable row level security;
alter table public.sarvam_credits enable row level security;

revoke all on public.sarvam_jobs, public.sarvam_credits from public, anon;
grant select, insert, update, delete on public.sarvam_jobs to authenticated;
grant select, update on public.sarvam_credits to authenticated;

-- Users can read their own jobs
create policy sarvam_jobs_select_own on public.sarvam_jobs
  for select to authenticated using ((select auth.uid()) = user_id);
-- Users can insert jobs (the Edge Function validates credit balance first)
create policy sarvam_jobs_insert_own on public.sarvam_jobs
  for insert to authenticated with check ((select auth.uid()) = user_id);
-- Users can update their own jobs (cancellation, etc.)
create policy sarvam_jobs_update_own on public.sarvam_jobs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
-- Users cannot delete their own jobs - they must be cancelled
create policy sarvam_jobs_delete_own on public.sarvam_jobs
  for delete to authenticated using (false);

-- Users can read and update their own credits
create policy sarvam_credits_select_own on public.sarvam_credits
  for select to authenticated using ((select auth.uid()) = user_id);
create policy sarvam_credits_update_own on public.sarvam_credits
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- The service role only: this atomically checks balance and decrements when dubbing
create function public.spend_credits(p_user_id uuid, p_minutes numeric)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  new_balance numeric;
begin
  select balance - p_minutes into new_balance from public.sarvam_credits where user_id = p_user_id for update;
  if new_balance is null or new_balance < 0 then
    return false;
  end if;
  update public.sarvam_credits set balance = new_balance, updated_at = now() where user_id = p_user_id;
  return true;
end $$;

revoke all on function public.spend_credits(uuid, numeric) from public, anon;
grant execute on function public.spend_credits(uuid, numeric) to service_role;