-- Creator accounts and Studio submissions.
--
-- Additive only: it creates two tables, one type, one trigger and one function,
-- and touches nothing that already exists. Row level security is on for every
-- table because the anon key ships in the browser and is public by design, so
-- these policies are the only wall.
--
--   profiles             one row per signed-in person; they read and edit only their own
--   creator_submissions  what a creator drafts in the Studio and sends for review;
--                        an author sees and edits only their own while it is a draft
--                        or submitted. Approving, rejecting and the reviewer's note
--                        belong to the service role (a moderator), never the browser.
--   delete_my_account()  erasure: removes the caller and, by cascade, everything
--                        they wrote. Whether approved, published work should instead
--                        be anonymised is a product and legal decision for the founder.

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 80),
  created_at   timestamptz not null default now()
);

create type public.submission_status as enum ('draft', 'submitted', 'approved', 'rejected');

create table public.creator_submissions (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 160),
  draft       jsonb not null check (jsonb_typeof(draft) = 'object' and pg_column_size(draft) <= 200000),
  status      public.submission_status not null default 'draft',
  review_note text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index creator_submissions_author_idx on public.creator_submissions (author_id, updated_at desc);

alter table public.profiles enable row level security;
alter table public.creator_submissions enable row level security;

revoke all on public.profiles, public.creator_submissions from public, anon;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.creator_submissions to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy submissions_select_own on public.creator_submissions
  for select to authenticated using ((select auth.uid()) = author_id);
create policy submissions_insert_own on public.creator_submissions
  for insert to authenticated
  with check ((select auth.uid()) = author_id and status in ('draft', 'submitted'));
create policy submissions_update_own on public.creator_submissions
  for update to authenticated
  using ((select auth.uid()) = author_id and status in ('draft', 'submitted'))
  with check ((select auth.uid()) = author_id and status in ('draft', 'submitted'));
create policy submissions_delete_own on public.creator_submissions
  for delete to authenticated
  using ((select auth.uid()) = author_id and status in ('draft', 'submitted'));

-- Row level security cannot compare old and new values, so this does it: only the
-- service role may change the reviewer's note or the author, and the clock is the
-- server's, not the browser's.
create function public.creator_submissions_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    new.author_id   := old.author_id;
    new.review_note := old.review_note;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger creator_submissions_guard
  before update on public.creator_submissions
  for each row execute function public.creator_submissions_guard();

create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = (select auth.uid());
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
