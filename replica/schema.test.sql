-- LOCAL ONLY. Never run this against Supabase.
--
-- Checks replica/schema.sql on a throwaway Postgres with PostGIS, with the few
-- Supabase pieces stubbed (the auth schema, auth.uid(), the anon, authenticated
-- and service_role roles). It tests the schema and its access rules. It does
-- not test the live Supabase project, whose existing tables and policies are
-- unknown.
--
--   pg_createcluster 16 naaradtest -p 54329 --start      (needs postgresql-16-postgis-3)
--   su postgres -c "cd <repo root> && psql -p 54329 -v ON_ERROR_STOP=1 -f replica/schema.test.sql"
--   pg_dropcluster --stop 16 naaradtest
--
-- Run from the repo root (the \i below is relative). Ends with ALL CHECKS PASSED.

\set ON_ERROR_STOP on
\set QUIET on

drop schema if exists public cascade;
drop schema if exists auth cascade;
drop schema if exists extensions cascade;
create schema public;
create schema auth;
create schema extensions;
set search_path = public, extensions;   -- PostGIS lives in `extensions`

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant usage on schema public, extensions, auth to anon, authenticated, service_role;
-- Supabase's default: new objects in public are open to the API roles, and
-- row level security is what restricts them.
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

\i replica/schema.sql

-- ---------------------------------------------------------------------------
-- fixtures (as superuser, so row level security does not apply)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'u1@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'u2@example.test');

-- distance_m, start_point and path_preview are left out on purpose: the trigger
-- must fill them.
insert into public.tours (slug, name, location_label, sport, theme, difficulty, route_type, duration_min, ascent_m, rating_avg, status, owner_id, path) values
  ('marina-loop',  'Marina Loop',  'Chennai', 'hike',  'heritage-walk', 'easy',     'loop',          40, 10, 4.5, 'published', null,
     st_geogfromtext('SRID=4326;LINESTRING(80.2383 12.9826, 80.2450 12.9900, 80.2520 12.9950)')),
  ('far-hills',    'Far Hills',    'Bengaluru', 'hike', 'nature-hike', 'hard',    'out_and_back', 300, 900, 4.9, 'published', null,
     st_geogfromtext('SRID=4326;LINESTRING(77.5900 12.9700, 77.6000 12.9800)')),
  ('ecr-ride',     'ECR Ride',     'Chennai', 'cycle', null, 'moderate', 'point_to_point', 90, 40, 4.0, 'published', null,
     st_geogfromtext('SRID=4326;LINESTRING(80.2500 13.0000, 80.3000 13.1000, 80.3500 13.2000)')),
  ('draft-trail',  'Draft Trail',  'Chennai', 'walk',  null, 'easy',     'loop',          30, 0, null, 'draft', '11111111-1111-1111-1111-111111111111',
     st_geogfromtext('SRID=4326;LINESTRING(80.2400 12.9830, 80.2410 12.9840)'));

insert into public.tour_stops (tour_id, position, name, point)
select id, p, n, st_geogfromtext(w) from public.tours,
  (values (0, 'Start',  'SRID=4326;POINT(80.2383 12.9826)'),
          (1, 'Viewpoint', 'SRID=4326;POINT(80.2450 12.9900)')) as s(p, n, w)
where slug in ('marina-loop', 'draft-trail');

-- Naarad's data has a 'photography' route type (Udaipur). It must be accepted,
-- and an unknown theme must still be rejected.
do $$
declare ok boolean := false;
begin
  insert into public.tours (slug, name, location_label, sport, theme, difficulty, route_type, duration_min, status, path)
  values ('photo-walk', 'Photo Walk', 'Udaipur', 'walk', 'photography', 'moderate', 'loop', 60, 'draft',
          st_geogfromtext('SRID=4326;LINESTRING(73.68 24.57, 73.69 24.58)'));
  begin
    insert into public.tours (slug, name, location_label, sport, theme, difficulty, route_type, duration_min, status, path)
    values ('bogus-theme', 'Bogus Theme', 'x', 'walk', 'skydiving', 'easy', 'loop', 10, 'draft',
            st_geogfromtext('SRID=4326;LINESTRING(73.68 24.57, 73.69 24.58)'));
  exception when check_violation then ok := true;
  end;
  assert ok, 'an unknown theme must be rejected';
  delete from public.tours where slug = 'photo-walk';
  -- the track files also use 'coastal-walk'
  insert into public.tours (slug, name, location_label, sport, theme, difficulty, route_type, duration_min, status, path)
  values ('beach-walk', 'Beach Walk', 'Chennai', 'walk', 'coastal-walk', 'easy', 'loop', 60, 'draft',
          st_geogfromtext('SRID=4326;LINESTRING(80.27 13.0, 80.28 13.01)'));
  delete from public.tours where slug = 'beach-walk';
end $$;

-- ---------------------------------------------------------------------------
-- derived columns
-- ---------------------------------------------------------------------------

do $$
declare t record;
begin
  select * into t from public.tours where slug = 'marina-loop';
  assert t.distance_m between 1000 and 2500,
    format('derived distance_m should be about 1.8 km, got %s', t.distance_m);
  assert abs(st_x(t.start_point::geometry) - 80.2383) < 1e-6, 'start_point should be the first vertex';
  assert t.path_preview is not null, 'path_preview should be derived';
end $$;

-- ---------------------------------------------------------------------------
-- search, as the anonymous (logged out) role
-- ---------------------------------------------------------------------------

begin;
set local role anon;
do $$
declare n int; first_slug text; r record;
begin
  select count(*), min(slug) filter (where centre_distance_m = 0) into n, first_slug
    from public.search_tours(12.9826, 80.2383);
  assert n = 2, format('default search near Chennai should find 2 published tours, got %s', n);
  assert first_slug = 'marina-loop', 'the tour starting at the centre should have distance 0';

  assert (select slug from public.search_tours(12.9826, 80.2383) limit 1) = 'marina-loop', 'nearest should sort first';

  assert (select count(*) from public.search_tours(12.9826, 80.2383, p_sport => 'cycle')) = 1, 'sport filter';
  assert (select slug from public.search_tours(12.9826, 80.2383, p_sport => 'cycle')) = 'ecr-ride', 'sport filter result';
  assert (select count(*) from public.search_tours(12.9826, 80.2383, p_difficulty => array['easy'])) = 1, 'difficulty filter';
  assert (select count(*) from public.search_tours(12.9826, 80.2383, p_max_distance_m => 5000)) = 1, 'max length filter';
  assert (select count(*) from public.search_tours(12.9826, 80.2383, p_min_distance_m => 5000)) = 1, 'min length filter';
  assert (select count(*) from public.search_tours(12.9826, 80.2383, p_radius_m => 1000)) = 1, 'radius filter';
  assert (select count(*) from public.search_tours(12.9826, 80.2383, p_route_type => 'loop')) = 1, 'route type filter';
  assert (select count(*) from public.search_tours(12.9826, 80.2383, p_surface => 'paved')) = 0, 'surface filter (nothing is paved)';
  assert (select count(*) from public.search_tours(12.9826, 80.2383, p_max_duration_min => 60)) = 1, 'duration filter';
  assert (select count(*) from public.search_tours(12.9826, 80.2383, p_min_ascent_m => 20)) = 1, 'ascent filter';

  -- theme filter (marina is heritage-walk, far-hills is nature-hike, the ride has none)
  assert (select slug from public.search_tours(12.9826, 80.2383, p_themes => array['heritage-walk'])) = 'marina-loop', 'theme filter';
  assert (select count(*) from public.search_tours(12.9826, 80.2383, p_themes => array['nature-hike'])) = 0, 'theme far away is out of radius';
  assert (select count(*) from public.search_tours(p_themes => array['heritage-walk', 'nature-hike'])) = 2, 'several themes at once, anywhere';

  -- far away: only the Bengaluru tour
  assert (select slug from public.search_tours(12.9716, 77.5946)) = 'far-hills', 'search near Bengaluru';

  -- paging: total_count is the whole match, not the page; the pages do not overlap
  select * into r from public.search_tours(12.9826, 80.2383, p_limit => 1);
  assert r.total_count = 2, 'total_count should be 2 with limit 1';
  assert (select slug from public.search_tours(12.9826, 80.2383, p_limit => 1, p_offset => 1)) = 'ecr-ride', 'page 2';
  assert (select count(*) from public.search_tours(12.9826, 80.2383, p_limit => 1, p_offset => 5)) = 0, 'past the end is empty, not an error';

  -- the map line is GeoJSON the browser can draw
  select * into r from public.search_tours(12.9826, 80.2383, p_limit => 1);
  assert r.path_preview ->> 'type' = 'LineString', 'path_preview should be a GeoJSON LineString';
  assert r.start_lat between 12.98 and 12.99, 'start_lat';
end $$;

-- "anywhere": no centre means no distance filter, best rated first
do $$
declare r record;
begin
  assert (select count(*) from public.search_tours()) = 3, 'anywhere finds every published tour, not the draft';
  assert (select array_agg(slug order by rating_avg desc) from public.search_tours()) = array['far-hills', 'marina-loop', 'ecr-ride'],
    'anywhere is ordered best rated first';
  select * into r from public.search_tours() limit 1;
  assert r.centre_distance_m is null, 'anywhere has no distance from a centre';
  assert (select count(*) from public.search_tours(p_sport => 'cycle')) = 1, 'filters still work anywhere';
  assert (select count(*) from public.search_tours(p_radius_m => 1)) = 3, 'radius is ignored without a centre';
end $$;

-- bad input is an error, not a silent empty result
do $$
declare ok boolean := false;
begin
  begin
    perform * from public.search_tours(95, 0);
  exception when sqlstate '22023' then ok := true;
  end;
  assert ok, 'latitude 95 should raise 22023';
  ok := false;
  begin
    perform * from public.search_tours(p_lat => 12.98);
  exception when sqlstate '22023' then ok := true;
  end;
  assert ok, 'a latitude without a longitude should raise 22023';
  ok := false;
  begin
    perform * from public.search_tours(p_lng => 80.2);
  exception when sqlstate '22023' then ok := true;
  end;
  assert ok, 'a longitude without a latitude should raise 22023';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- row level security on tours and stops
-- ---------------------------------------------------------------------------

begin;
set local role anon;
do $$
begin
  assert (select count(*) from public.tours) = 3, 'anon sees the 3 published tours, not the draft';
  assert (select count(*) from public.tour_stops) = 2, 'anon sees stops of the published tour only';
  assert public.get_tour('marina-loop') is not null, 'get_tour on a published tour';
  assert public.get_tour('draft-trail') is null, 'get_tour on a draft returns null for anon';
  assert public.get_tour('nope') is null, 'get_tour on a missing slug returns null';
  assert jsonb_array_length(public.get_tour('marina-loop') -> 'stops') = 2, 'get_tour returns the stops';
  assert public.get_tour('marina-loop') #>> '{path,type}' = 'LineString', 'get_tour returns the full path as GeoJSON';
  assert (public.get_tour('marina-loop') -> 'stops' -> 0 ->> 'name') = 'Start', 'stops come back in order';
end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
do $$
begin
  assert (select count(*) from public.tours) = 4, 'the owner also sees their own draft';
  assert public.get_tour('draft-trail') is not null, 'owner can open their draft';
  assert (select count(*) from public.tour_stops) = 4, 'owner sees the stops of their draft';
end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
do $$
begin
  assert (select count(*) from public.tours) = 3, 'another user does not see the draft';
  assert public.get_tour('draft-trail') is null, 'another user cannot open the draft';
end $$;
rollback;

-- the catalogue cannot be written from the browser, signed in or not
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
do $$
declare ok boolean := false;
begin
  begin
    insert into public.tours (slug, name, location_label, sport, difficulty, route_type, duration_min, status, owner_id, path)
    values ('mine', 'Mine Mine', 'x', 'hike', 'easy', 'loop', 10, 'published', '11111111-1111-1111-1111-111111111111',
            st_geogfromtext('SRID=4326;LINESTRING(80 13, 80.1 13.1)'));
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'signed-in insert into tours must be denied';
  ok := false;
  begin
    update public.tours set name = 'hijacked' where slug = 'draft-trail';
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'owner update of tours must be denied';
  ok := false;
  begin
    delete from public.tours where slug = 'draft-trail';
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'owner delete of tours must be denied';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- highlights, tips: user-written, moderated
-- ---------------------------------------------------------------------------

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
do $$
declare ok boolean := false; hid uuid;
begin
  insert into public.highlights (created_by, name, kind, sports, point)
  values ('11111111-1111-1111-1111-111111111111', 'Sunrise Point', 'point', array['hike'],
          st_geogfromtext('SRID=4326;POINT(80.24 12.99)'))
  returning id into hid;
  assert (select count(*) from public.highlights) = 1, 'author sees their pending highlight';

  begin  -- cannot claim to be someone else
    insert into public.highlights (created_by, name, kind, sports, point)
    values ('22222222-2222-2222-2222-222222222222', 'Forged', 'point', array['hike'],
            st_geogfromtext('SRID=4326;POINT(80.24 12.99)'));
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'inserting a highlight as another user must be denied';

  ok := false;
  begin  -- cannot publish your own
    insert into public.highlights (created_by, name, kind, sports, point, status)
    values ('11111111-1111-1111-1111-111111111111', 'Self Published', 'point', array['hike'],
            st_geogfromtext('SRID=4326;POINT(80.24 12.99)'), 'published');
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'self-publishing must be denied';

  ok := false;
  begin  -- geometry must match the kind
    insert into public.highlights (created_by, name, kind, sports, point, segment)
    values ('11111111-1111-1111-1111-111111111111', 'Both Shapes', 'point', array['hike'],
            st_geogfromtext('SRID=4326;POINT(80.24 12.99)'),
            st_geogfromtext('SRID=4326;LINESTRING(80 13, 80.1 13.1)'));
  exception when check_violation then ok := true;
  end;
  assert ok, 'a point highlight with a segment must be rejected';

  ok := false;
  begin  -- sports must be from the list
    insert into public.highlights (created_by, name, kind, sports, point)
    values ('11111111-1111-1111-1111-111111111111', 'Bad Sport', 'point', array['skydive'],
            st_geogfromtext('SRID=4326;POINT(80.24 12.99)'));
  exception when check_violation then ok := true;
  end;
  assert ok, 'an unknown sport must be rejected';
end $$;
commit;

-- moderation: nobody else sees it until it is published (the service role does that)
begin;
set local role anon;
do $$ begin
  assert (select count(*) from public.highlights) = 0, 'anon must not see a pending highlight';
end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
do $$
declare ok boolean := false; hid uuid;
begin
  assert (select count(*) from public.highlights) = 0, 'another user must not see a pending highlight';
  select id into hid from public.highlights limit 1;
  assert hid is null, 'no id leaks';
end $$;
rollback;

update public.highlights set status = 'published';  -- superuser acts as the moderator

begin;
set local role anon;
do $$ begin
  assert (select count(*) from public.highlights) = 1, 'anon sees the published highlight';
end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
do $$
declare ok boolean := false; hid uuid;
begin
  select id into hid from public.highlights;
  insert into public.highlight_tips (highlight_id, author_id, body)
    values (hid, '22222222-2222-2222-2222-222222222222', 'Go before 6am.');
  assert (select count(*) from public.highlight_tips) = 1, 'author sees their pending tip';

  begin  -- cannot edit the status, even on their own tip
    update public.highlight_tips set status = 'published' where highlight_id = hid;
  exception when insufficient_privilege then ok := true;
  end;
  -- an UPDATE whose new row fails WITH CHECK raises 42501; one that matches no row is silent
  assert ok, 'an author must not be able to publish their own tip';
end $$;
commit;

begin;
set local role anon;
do $$ begin
  assert (select count(*) from public.highlight_tips) = 0, 'anon must not see a pending tip';
end $$;
rollback;

update public.highlight_tips set status = 'published';

begin;
set local role anon;
do $$ begin
  assert (select count(*) from public.highlight_tips) = 1, 'anon sees the published tip';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- foreign key rules
-- ---------------------------------------------------------------------------

do $$
begin
  delete from public.tours where slug = 'draft-trail';
  assert (select count(*) from public.tour_stops) = 2, 'deleting a tour deletes its stops';

  delete from auth.users where id = '22222222-2222-2222-2222-222222222222';
  assert (select author_id from public.highlight_tips limit 1) is null,
    'deleting a user keeps their tip and clears the author';
end $$;

-- ---------------------------------------------------------------------------
-- does the radius search use the spatial index at a realistic size?
-- 20,000 generated tours across India, then the same predicates search_tours
-- uses, with the planner left alone. (Runs last: it adds rows.)
-- ---------------------------------------------------------------------------

insert into public.tours (slug, name, location_label, sport, difficulty, route_type, duration_min, status, path)
select
  'gen-' || i,
  'Generated ' || i,
  'India',
  (array['hike', 'walk', 'cycle', 'run'])[1 + (i % 4)],
  (array['easy', 'moderate', 'hard'])[1 + (i % 3)],
  'loop',
  30 + (i % 200),
  'published',
  st_setsrid(st_makeline(array[
    st_makepoint(x, y),
    st_makepoint(x + 0.01, y + 0.01),
    st_makepoint(x + 0.02, y + 0.005)
  ]), 4326)::geography
from (
  select i, 68 + random() * 29 as x, 8 + random() * 27 as y from generate_series(1, 20000) as i
) g;

analyze public.tours;

do $$
declare l text; used boolean := false;
begin
  for l in execute $q$
    explain (costs off)
    select t.id from public.tours t
    where t.status = 'published'
      and st_dwithin(t.start_point, st_setsrid(st_makepoint(80.2383, 12.9826), 4326)::geography, 30000)
      and (t.sport = 'hike')
    order by st_distance(t.start_point, st_setsrid(st_makepoint(80.2383, 12.9826), 4326)::geography), t.rating_avg desc nulls last, t.id
    limit 20
  $q$
  loop
    raise notice 'plan: %', l;
    if l like '%tours_start_point_gix%' then used := true; end if;
  end loop;
  assert used, 'the GIST index on start_point should serve the radius search at 20,000 rows';
end $$;

\echo ALL CHECKS PASSED
