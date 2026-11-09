-- Consent ledger table.
--
-- Additive only: one table, one index. Touches nothing that already exists.
--
--   consents(user_id, purpose, version, granted_at, withdrawn_at)
--
-- Purpose values: account, recording_publish, training_use. Each is a separate
-- optional row so that a user can withdraw from training_use without losing
-- the recording_publish consent. The version is the timestamp when consent
-- was given, which is important for GDPR compliance and for determining
-- what data can be processed.
--
-- Reversible: yes — the table drops cleanly.

create table public.consents (
  user_id    uuid references auth.users (id) on delete cascade,
  purpose    text not null check (purpose in ('account', 'recording_publish', 'training_use')),
  version    text not null check (char_length(version) > 0),
  granted_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  primary key (user_id, purpose)
);

create index consents_user_purpose_idx on public.consents (user_id, purpose);
create index consents_purpose_idx on public.consents (purpose);

alter table public.consents enable row level security;

revoke all on public.consents from public, anon;
grant select, insert, update, delete on public.consents to authenticated;

-- A user can read and write only their own consents.
create policy consents_select_own on public.consents
  for select to authenticated using ((select auth.uid()) = user_id);
create policy consents_insert_own on public.consents
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy consents_update_own on public.consents
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy consents_delete_own on public.consents
  for delete to authenticated using ((select auth.uid()) = user_id);