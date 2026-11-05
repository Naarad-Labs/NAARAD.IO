-- Sarvam AI proxy and credit accounting.
--
-- Additive only: two tables, one type, two functions and one trigger. Touches
-- nothing that already exists. Every table is RLS-on, because the anon key
-- ships in the browser and is public by design -- these policies are the only
-- wall between a visitor and the token ledger.
--
--   sarvam_jobs      one row per outbound Sarvam call, written by the proxy
--                    before the call is made, updated with the outcome. This
--                    is the usage record and the basis for the budget.
--   sarvam_credits   the founder's budget, one row. The proxy reads it to say
--                    yes or no, and spends from it atomically.
--
-- The key never leaves the server. app/config.js has no Sarvam secret; the
-- Edge Function reads it from the deployment's own environment, and the
-- browser only ever sees a job id.

create type public.sarvam_endpoint as enum ('saarika', 'mayura', 'bulbul', 'sarvam-m');

create table public.sarvam_jobs (
  id            uuid primary key default gen_random_uuid(),
  caller_id     uuid references auth.users (id) on delete set null,
  endpoint      public.sarvam_endpoint not null,
  route_slug    text,
  stop_order    integer,
  input_chars   integer,
  input_tokens  integer,
  output_tokens integer,
  audio_seconds numeric,
  cost_inr      numeric(10, 2) not null default 0,
  status        text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'refused')),
  error         text,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create index sarvam_jobs_created_idx on public.sarvam_jobs (created_at desc);
create index sarvam_jobs_caller_idx   on public.sarvam_jobs (caller_id, created_at desc);

create table public.sarvam_credits (
  id            bigint primary key check (id = 1),   -- exactly one row, ever
  balance_inr   numeric(12, 2) not null default 0,
  spent_inr     numeric(12, 2) not null default 0,
  updated_at    timestamptz not null default now()
);

insert into public.sarvam_credits (id, balance_inr) values (1, 0)
  on conflict (id) do nothing;

alter table public.sarvam_jobs enable row level security;
alter table public.sarvam_credits enable row level security;

revoke all on public.sarvam_jobs, public.sarvam_credits from public, anon;

-- A signed-in person sees the calls they made. Nobody sees anyone else's.
create policy sarvam_jobs_select_own on public.sarvam_jobs
  for select to authenticated using ((select auth.uid()) = caller_id);

-- The browser never writes a job: only the proxy does, as the service role.
-- The insert policy is intentionally absent for authenticated.

-- The ledger is founder-only. The proxy runs as the service role, which
-- bypasses RLS, so these policies only shield the table from the browser.
create policy sarvam_credits_read on public.sarvam_credits
  for select to authenticated using (false);

/* One atomic spend: refuse when the balance is gone, debit when it is not.
   Returns { ok, balance, spent, refused }. Called by the proxy as the service
   role, so it can read and write despite the table being RLS-on. */
create function public.sarvam_spend(amount_inr numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  row public.sarvam_credits;
begin
  select * into row from public.sarvam_credits where id = 1 for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no-ledger', 'balance', 0, 'spent', 0);
  end if;
  if row.balance_inr < amount_inr then
    return jsonb_build_object('ok', false, 'reason', 'out-of-budget',
                              'balance', row.balance_inr, 'spent', row.spent_inr);
  end if;
  update public.sarvam_credits
     set balance_inr = balance_inr - amount_inr, spent_inr = spent_inr + amount_inr, updated_at = now()
     where id = 1;
  return jsonb_build_object('ok', true, 'balance', row.balance_inr - amount_inr,
                            'spent', row.spent_inr + amount_inr);
end $$;

revoke all on function public.sarvam_spend(numeric) from public, anon;
grant execute on function public.sarvam_spend(numeric) to service_role;

/* The founder tops the ledger up. service_role only. */
create function public.sarvam_topup(amount_inr numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  update public.sarvam_credits set balance_inr = balance_inr + amount_inr, updated_at = now() where id = 1;
  return jsonb_build_object('ok', true, 'added', amount_inr);
end $$;

revoke all on function public.sarvam_topup(numeric) from public, anon;
grant execute on function public.sarvam_topup(numeric) to service_role;