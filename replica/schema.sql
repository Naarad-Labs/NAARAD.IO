-- Naarad Discover slice: tours, stops, highlights, search.
-- Target: Naarad's existing Supabase project (Postgres + PostGIS).
--
-- Status: written from replica/architecture.md. See the header of
-- replica/schema.test.sql for how it was (or was not) run.
-- NOT applied to the live Supabase project. Before applying, list the tables
-- that already exist there and check none of these names collide, and check
-- which of them already have row level security on.
--
-- Assumes PostGIS lives in the `extensions` schema (what Supabase creates when
-- you enable it from the dashboard). If the live project already has PostGIS in
-- another schema, `create extension if not exists` below does nothing and the
-- `extensions.geography` column types fail: change the prefix to match.

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- tours: the thing Discover lists. One row per published route.
--
-- `path` is 2D. Elevation is reduced to ascent_m / descent_m by the ingest
-- script, because a 3D line does not fit geography(LineString) and the client
-- only needs the totals.
-- Writes come from the service role only (the ingest script). No insert,
-- update or delete policy exists for anon or authenticated, on purpose.
-- ---------------------------------------------------------------------------

create table public.tours (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  owner_id        uuid references auth.users (id) on delete set null,
  name            text not null check (char_length(name) between 3 and 120),
  summary         text not null default '',
  location_label  text not null,
  sport           text not null check (sport in ('hike', 'walk', 'cycle', 'run')),
  theme           text check (theme in ('heritage-walk', 'temple-trail', 'nature-hike', 'cultural-tour', 'photography')),
  difficulty      text not null check (difficulty in ('easy', 'moderate', 'hard')),
  route_type      text not null check (route_type in ('loop', 'out_and_back', 'point_to_point')),
  surface         text not null default 'mixed' check (surface in ('paved', 'mixed', 'off_road')),
  -- distance_m, start_point and path_preview are derived from `path` by trigger
  distance_m      integer not null check (distance_m > 0),
  duration_min    integer not null check (duration_min > 0),
  ascent_m        integer not null default 0 check (ascent_m >= 0),
  descent_m       integer not null default 0 check (descent_m >= 0),
  path            extensions.geography (LineString, 4326) not null,
  start_point     extensions.geography (Point, 4326) not null,
  path_preview    extensions.geography (LineString, 4326) not null,
  cover_image_path text,
  languages       text[] not null default '{}',
  tags            text[] not null default '{}',
  rating_avg      numeric(2, 1) check (rating_avg between 0 and 5),
  rating_count    integer not null default 0 check (rating_count >= 0),
  status          text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Search is "start point within a radius", then plain filters.
create index tours_start_point_gix on public.tours using gist (start_point);
-- Filter columns. Partial, because every public query is on published rows.
create index tours_published_sport_difficulty_idx
  on public.tours (sport, difficulty) where status = 'published';
create index tours_published_distance_idx
  on public.tours (distance_m) where status = 'published';
create index tours_owner_idx on public.tours (owner_id);

create or replace function public.tours_derive()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.start_point  := st_startpoint(new.path::geometry)::geography;
  new.distance_m   := greatest(round(st_length(new.path))::integer, 1);
  -- ~33 m tolerance. Tune after measuring the payload of a 20-result page.
  new.path_preview := coalesce(
    st_simplifypreservetopology(new.path::geometry, 0.0003),
    new.path::geometry
  )::geography;
  new.updated_at   := now();
  return new;
end;
$$;

create trigger tours_derive
  before insert or update on public.tours
  for each row execute function public.tours_derive();

-- ---------------------------------------------------------------------------
-- tour_stops: the named stops along a tour (Naarad's `waypoints`).
-- ---------------------------------------------------------------------------

create table public.tour_stops (
  id          uuid primary key default gen_random_uuid(),
  tour_id     uuid not null references public.tours (id) on delete cascade,
  position    integer not null check (position >= 0),
  name        text not null check (char_length(name) between 1 and 120),
  point       extensions.geography (Point, 4326) not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tour_id, position)   -- also the index on tour_id
);

create trigger tour_stops_updated_at
  before update on public.tour_stops
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- highlights: community places and stretches, with tips and photos.
-- Ships in milestone 3. User-written, so every row is moderated: new rows are
-- 'pending' and only 'published' ones are public.
-- ---------------------------------------------------------------------------

create table public.highlights (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid references auth.users (id) on delete set null,
  name        text not null check (char_length(name) between 3 and 80),
  kind        text not null check (kind in ('point', 'segment')),
  sports      text[] not null check (
                cardinality(sports) > 0
                and sports <@ array['hike', 'walk', 'cycle', 'run']
              ),
  point       extensions.geography (Point, 4326),
  segment     extensions.geography (LineString, 4326),
  status      text not null default 'pending' check (status in ('pending', 'published', 'removed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint highlight_geometry_matches_kind check (
    (kind = 'point'   and point   is not null and segment is null) or
    (kind = 'segment' and segment is not null and point   is null)
  )
);

create index highlights_point_gix   on public.highlights using gist (point)   where point   is not null;
create index highlights_segment_gix on public.highlights using gist (segment) where segment is not null;
create index highlights_created_by_idx on public.highlights (created_by);

create trigger highlights_updated_at
  before update on public.highlights
  for each row execute function public.set_updated_at();

-- Which highlights a tour passes. Curated by hand or by the ingest script.
create table public.tour_highlights (
  tour_id       uuid not null references public.tours (id) on delete cascade,
  highlight_id  uuid not null references public.highlights (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (tour_id, highlight_id)
);

create index tour_highlights_highlight_idx on public.tour_highlights (highlight_id);

create table public.highlight_tips (
  id            uuid primary key default gen_random_uuid(),
  highlight_id  uuid not null references public.highlights (id) on delete cascade,
  author_id     uuid references auth.users (id) on delete set null,
  body          text not null check (char_length(body) between 1 and 1000),
  status        text not null default 'pending' check (status in ('pending', 'published', 'removed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index highlight_tips_highlight_idx on public.highlight_tips (highlight_id);
create index highlight_tips_author_idx    on public.highlight_tips (author_id);

create trigger highlight_tips_updated_at
  before update on public.highlight_tips
  for each row execute function public.set_updated_at();

-- Photo files live in Supabase Storage. This row points at one.
create table public.highlight_photos (
  id            uuid primary key default gen_random_uuid(),
  highlight_id  uuid not null references public.highlights (id) on delete cascade,
  author_id     uuid references auth.users (id) on delete set null,
  storage_path  text not null unique,
  caption       text not null default '' check (char_length(caption) <= 200),
  status        text not null default 'pending' check (status in ('pending', 'published', 'removed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index highlight_photos_highlight_idx on public.highlight_photos (highlight_id);
create index highlight_photos_author_idx    on public.highlight_photos (author_id);

create trigger highlight_photos_updated_at
  before update on public.highlight_photos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Access rules: row level security on every table. The anon key is public by
-- design (it ships in index.html), so these policies are the only wall.
-- A table with RLS on and no policy for an operation denies it.
-- ---------------------------------------------------------------------------

alter table public.tours            enable row level security;
alter table public.tour_stops       enable row level security;
alter table public.highlights       enable row level security;
alter table public.tour_highlights  enable row level security;
alter table public.highlight_tips   enable row level security;
alter table public.highlight_photos enable row level security;

-- Catalogue tables are written by the service role only. Take the grants away
-- as well, so a mistaken policy later still cannot open a write path.
revoke insert, update, delete on public.tours, public.tour_stops, public.tour_highlights
  from anon, authenticated;

-- tours
create policy "published tours are public"
  on public.tours for select to anon, authenticated
  using (status = 'published');

create policy "owners read their own tours"
  on public.tours for select to authenticated
  using ((select auth.uid()) = owner_id);

-- tour_stops: visible exactly when the parent tour is visible to the caller
-- (the sub-select is itself filtered by the tours policies above).
create policy "stops follow their tour"
  on public.tour_stops for select to anon, authenticated
  using (tour_id in (select id from public.tours));

-- highlights
create policy "published highlights are public"
  on public.highlights for select to anon, authenticated
  using (status = 'published');

create policy "authors read their own highlights"
  on public.highlights for select to authenticated
  using ((select auth.uid()) = created_by);

create policy "signed-in users propose highlights"
  on public.highlights for insert to authenticated
  with check ((select auth.uid()) = created_by and status = 'pending');

create policy "authors edit their pending highlights"
  on public.highlights for update to authenticated
  using      ((select auth.uid()) = created_by and status = 'pending')
  with check ((select auth.uid()) = created_by and status = 'pending');

create policy "authors delete their pending highlights"
  on public.highlights for delete to authenticated
  using ((select auth.uid()) = created_by and status = 'pending');

-- tour_highlights: read-only, follows both sides
create policy "tour highlights follow tour and highlight"
  on public.tour_highlights for select to anon, authenticated
  using (
    tour_id in (select id from public.tours)
    and highlight_id in (select id from public.highlights)
  );

-- highlight_tips
create policy "published tips are public"
  on public.highlight_tips for select to anon, authenticated
  using (status = 'published' and highlight_id in (select id from public.highlights));

create policy "authors read their own tips"
  on public.highlight_tips for select to authenticated
  using ((select auth.uid()) = author_id);

create policy "signed-in users add tips"
  on public.highlight_tips for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and status = 'pending'
    and highlight_id in (select id from public.highlights)
  );

create policy "authors edit their pending tips"
  on public.highlight_tips for update to authenticated
  using      ((select auth.uid()) = author_id and status = 'pending')
  with check ((select auth.uid()) = author_id and status = 'pending');

create policy "authors delete their pending tips"
  on public.highlight_tips for delete to authenticated
  using ((select auth.uid()) = author_id and status = 'pending');

-- highlight_photos
create policy "published photos are public"
  on public.highlight_photos for select to anon, authenticated
  using (status = 'published' and highlight_id in (select id from public.highlights));

create policy "authors read their own photos"
  on public.highlight_photos for select to authenticated
  using ((select auth.uid()) = author_id);

create policy "signed-in users add photos"
  on public.highlight_photos for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and status = 'pending'
    and highlight_id in (select id from public.highlights)
  );

create policy "authors delete their pending photos"
  on public.highlight_photos for delete to authenticated
  using ((select auth.uid()) = author_id and status = 'pending');

-- ---------------------------------------------------------------------------
-- search_tours: F01, F02, F03 in one call.
--
-- PostgREST returns geography columns as hex WKB, which the browser cannot
-- draw, so the map line comes back as GeoJSON from this function.
-- security invoker (the default): row level security applies to the caller.
--
-- p_radius_m is how far from the centre a tour may START. p_max_distance_m is
-- how long the tour may be. The recon could not confirm which of the two
-- Komoot's `max_distance` URL parameter means, so both exist and the client
-- decides. See architecture.md.
-- ---------------------------------------------------------------------------

create or replace function public.search_tours(
  p_lat              double precision,
  p_lng              double precision,
  p_radius_m         integer default 30000,
  p_sport            text    default null,
  p_difficulty       text[]  default null,
  p_min_distance_m   integer default null,
  p_max_distance_m   integer default null,
  p_min_duration_min integer default null,
  p_max_duration_min integer default null,
  p_min_ascent_m     integer default null,
  p_max_ascent_m     integer default null,
  p_surface          text    default null,
  p_route_type       text    default null,
  p_limit            integer default 20,
  p_offset           integer default 0
)
returns table (
  id                uuid,
  slug              text,
  name              text,
  location_label    text,
  sport             text,
  theme             text,
  difficulty        text,
  route_type        text,
  surface           text,
  distance_m        integer,
  duration_min      integer,
  ascent_m          integer,
  rating_avg        numeric,
  rating_count      integer,
  cover_image_path  text,
  start_lat         double precision,
  start_lng         double precision,
  path_preview      jsonb,
  centre_distance_m integer,
  total_count       bigint
)
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_centre extensions.geography;
  v_radius integer := least(greatest(coalesce(p_radius_m, 30000), 1), 200000);
  v_limit  integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if p_lat is null or p_lng is null
     or p_lat not between -90 and 90
     or p_lng not between -180 and 180 then
    raise exception 'search_tours: centre must be a valid latitude and longitude'
      using errcode = '22023';
  end if;

  v_centre := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;

  return query
  select
    t.id, t.slug, t.name, t.location_label, t.sport, t.theme, t.difficulty,
    t.route_type, t.surface, t.distance_m, t.duration_min, t.ascent_m,
    t.rating_avg, t.rating_count, t.cover_image_path,
    st_y(t.start_point::geometry),
    st_x(t.start_point::geometry),
    st_asgeojson(t.path_preview)::jsonb,
    round(st_distance(t.start_point, v_centre))::integer,
    count(*) over ()
  from public.tours t
  where t.status = 'published'
    and st_dwithin(t.start_point, v_centre, v_radius)
    and (p_sport is null           or t.sport = p_sport)
    and (p_difficulty is null      or t.difficulty = any (p_difficulty))
    and (p_min_distance_m is null  or t.distance_m   >= p_min_distance_m)
    and (p_max_distance_m is null  or t.distance_m   <= p_max_distance_m)
    and (p_min_duration_min is null or t.duration_min >= p_min_duration_min)
    and (p_max_duration_min is null or t.duration_min <= p_max_duration_min)
    and (p_min_ascent_m is null    or t.ascent_m     >= p_min_ascent_m)
    and (p_max_ascent_m is null    or t.ascent_m     <= p_max_ascent_m)
    and (p_surface is null         or t.surface      = p_surface)
    and (p_route_type is null      or t.route_type   = p_route_type)
  -- Nearest first, then best rated. t.id makes the order total, so pages
  -- never repeat or skip a row.
  order by st_distance(t.start_point, v_centre), t.rating_avg desc nulls last, t.id
  limit v_limit offset v_offset;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_tour: S04. One tour with its full line and its stops, as one JSON value.
-- Returns null when there is no such tour or the caller may not see it.
-- ---------------------------------------------------------------------------

create or replace function public.get_tour(p_slug text)
returns jsonb
language sql
stable
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'id', t.id,
    'slug', t.slug,
    'name', t.name,
    'summary', t.summary,
    'location_label', t.location_label,
    'sport', t.sport,
    'theme', t.theme,
    'difficulty', t.difficulty,
    'route_type', t.route_type,
    'surface', t.surface,
    'distance_m', t.distance_m,
    'duration_min', t.duration_min,
    'ascent_m', t.ascent_m,
    'descent_m', t.descent_m,
    'rating_avg', t.rating_avg,
    'rating_count', t.rating_count,
    'cover_image_path', t.cover_image_path,
    'languages', to_jsonb(t.languages),
    'tags', to_jsonb(t.tags),
    'path', st_asgeojson(t.path)::jsonb,
    'stops', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'position', s.position,
          'name', s.name,
          'lat', st_y(s.point::geometry),
          'lng', st_x(s.point::geometry)
        ) order by s.position
      )
      from public.tour_stops s
      where s.tour_id = t.id
    ), '[]'::jsonb)
  )
  from public.tours t
  where t.slug = p_slug;
$$;
