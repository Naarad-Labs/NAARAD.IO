# Architecture: Naarad Discover (a rebuild of Komoot Discover's core features)

> **Built on a draft recon.** `replica/recon.md` was written from search
> summaries because Komoot's pages were blocked. Two things this document
> depends on are unconfirmed there: that a tour detail page exists (S04, a
> guess) and what Komoot's `max_distance` URL parameter means. The schema is
> built so either answer works. Read the recon's "Needs a first-hand look"
> list before building past milestone 1.

Reads `replica/recon.md` and `replica/features.csv`. Schema in
`replica/schema.sql`, tests in `replica/schema.test.sql`.

## Stack

The pack's default is Next.js on Vercel with Supabase. Naarad already has a
stack, so this keeps it. The clone needs Discover's features, not a rewrite.

| layer | choice | why |
| --- | --- | --- |
| web | the existing static site: one `index.html`, vanilla JS, Leaflet, on GitHub Pages (`CNAME` is `naarad.io`) | Discover already exists and works there. A framework move would rebuild every other page for no Discover gain. |
| database | Postgres on the **existing Supabase project**, plus PostGIS | Auth already runs on that project. PostGIS gives radius search and real distances. One database. |
| search | two Postgres functions called through `supabase-js` (`search_tours`, `get_tour`) | GitHub Pages cannot run server code, so the query logic lives next to the data. |
| auth | Supabase Auth, as now (email and password, Google) | Already built in `index.html`. Nothing to change for Discover, which is public. |
| payments | Razorpay, as now. **Not touched by this slice.** | Discover lists routes. Locking routes behind a pass is a separate change (see the last section). |
| email | none needed | No emails in this slice. |
| jobs | none. One manual ingest script (`scripts/ingest-tours.mjs`, not written) | Routes change rarely and arrive as files. |
| geocoding | Nominatim from the browser, on **Enter only**, with a client cache, as the code does today | Matches the usage policy (below). No proxy: a proxy would put every user behind one IP and one 1 request/second budget. |
| map tiles | **decision needed**, see "Parts that bite" | `tile.openstreetmap.org` is not meant for production traffic or offline use. |
| files | Supabase Storage, milestone 3 only (highlight photos) | Same project as the database. |
| hosting | GitHub Pages for the site, Supabase for data | No change. |

## Documentation checked

The documentation hosts were blocked (see the recon), so each row was read
**as a search-result summary of the page**, not the page. Anything marked
*unverified* is from memory or inference and should be checked before it is
relied on.

| topic | page | what it settled | still unverified |
| --- | --- | --- | --- |
| PostGIS on Supabase | https://supabase.com/docs/guides/database/extensions/postgis | enable the extension into a separate schema; `extensions.geography(POINT)` columns; a `GIST` index; `st_dwithin` for nearby rows | the dashboard steps. The SQL here was run on **PostgreSQL 16 with PostGIS 3.4.2 locally**, not on Supabase. |
| Row level security | https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/docs/guides/database/postgres/row-level-security-performance | name the role with `to`; write `(select auth.uid())`; index every column a policy filters on; avoid joins in policies | nothing known |
| Nominatim policy | https://operations.osmfoundation.org/policies/nominatim/ | 1 request per second at most; a valid Referer or User-Agent; **no client-side autocomplete**; cache results | whether a browser's automatic Referer is enough in practice |
| OSM tile policy | https://operations.osmfoundation.org/policies/tiles/ | heavy use is not allowed and may be blocked without notice; attribution is required; no bulk or offline prefetch on the OSM servers; heavy users should use their own or a third-party server | the numeric thresholds. They were not in the summary. |
| Razorpay webhooks | https://razorpay.com/docs/webhooks/validate-test/ | `X-Razorpay-Signature` is HMAC-SHA256 of the **raw** body with the webhook secret | how to de-duplicate repeated events. The summary did not cover it. |
| `supabase-js` GET-style RPC | not read | n/a | *unverified, from memory*: that `rpc()` has a `get: true` option. Check before relying on it (see offline, below). |

Not read at all: Supabase API rate limits, Supabase Storage limits, Komoot's
own docs.

## Schema

Six tables, row level security on every one, tested locally.

| table | what | written by |
| --- | --- | --- |
| `tours` | one row per route: sport, difficulty, route type, surface, distance, duration, ascent, the line, the start point, a simplified line for the map | service role (ingest script) only |
| `tour_stops` | the named stops along a tour (Naarad's `waypoints`) | service role only |
| `highlights` | community places and stretches. Milestone 3. | signed-in users, as `pending` |
| `tour_highlights` | which highlights a tour passes | service role only |
| `highlight_tips` | a tip on a highlight. Milestone 3. | signed-in users, as `pending` |
| `highlight_photos` | a photo on a highlight, stored in Storage. Milestone 3. | signed-in users, as `pending` |

Access rules: **row level security**, not data-layer checks, because the anon
key ships in `index.html` and is public by design, so the policies are the only
wall.

- Logged-out and logged-in visitors read `published` tours and their stops.
- Nobody writes `tours`, `tour_stops` or `tour_highlights` from the browser:
  no policy allows it and the table grants are revoked as well.
- User-written rows start `pending`, are visible only to their author, and
  only the service role (a moderator) publishes them. Authors cannot
  self-publish, and cannot write as another user.
- `search_tours` and `get_tour` run as the caller, so these policies apply to
  them. A draft is visible to its owner only.

Decisions in the schema:

- **`distance_m`, `start_point` and `path_preview` are derived from `path` by a
  trigger** and cannot be set by hand. A tour's distance must agree with its
  line. This is why the 12 curated routes cannot be ingested yet (see below).
- **`path` is 2D.** Elevation is reduced to `ascent_m` and `descent_m` by the
  ingest script. A 3D line does not fit the column type.
- **`sport` and `theme` are separate columns.** Naarad's current `type` mixes
  them (`cycling` is a sport; `heritage-walk`, `temple-trail`, `nature-hike`,
  `cultural-tour`, `photography` and `coastal-walk` are themes). The track files
  label routes `nature-hike`, `heritage-walk`, `coastal-walk` or `walk`, and the
  seed uses those labels for sport and theme rather than inventing any.
- **Difficulty has three values**, `easy`, `moderate`, `hard`. One of the 12
  curated routes (Coorg) is already `hard`, and the card's CSS has a `diff-hard`
  class.
- **Search is "starts within a radius"**, with `p_radius_m` (how far from the
  centre a tour may start) and `p_max_distance_m` (how long it may be) as two
  separate parameters. The recon could not confirm which one Komoot's
  `max_distance=30000` is, so the client decides.
- **Deleting a user keeps what they wrote** and clears the author
  (`on delete set null`). Removing content on request is done by the service
  role. This is a product decision, not legal advice.
- Money, time zones: not in this slice. All timestamps are `timestamptz`.

### Tested

`replica/schema.test.sql` applies `schema.sql` to a throwaway PostgreSQL 16 +
PostGIS 3.4.2 with the Supabase pieces stubbed (the `auth` schema, `auth.uid()`,
the `anon`, `authenticated` and `service_role` roles). 66 assertions, all
passing: derived columns, every filter, ordering, paging, bad input, what each
role can and cannot read, write attempts denied, moderation, constraints, delete
rules, and the plan using the spatial index on 20,000 generated tours.

Naarad's real track files also import cleanly. Distances derived from the line
agree with the files' own `dist_km` to within 0.4%, and the simplified map
lines come to about 2 KB per tour (about 40 KB for a 20-result page).

**Not tested:** the live Supabase project. Its existing tables and policies are
unknown to this recon and were not queried. Check them before applying.

## API

All calls are from the browser through `supabase-js`, using the public anon key.

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| `POST /rest/v1/rpc/search_tours` | tours that start near a point, filtered, nearest first. With no point it means "anywhere": best rated first. | anyone | optional `p_lat` and `p_lng` (both or neither), `p_radius_m`, optional `p_sport`, `p_difficulty[]`, `p_themes[]`, min and max distance, duration and ascent, `p_surface`, `p_route_type`, `p_limit` (max 50), `p_offset` | rows with stats, start point, a GeoJSON line, distance from the centre, `total_count`. **Written and tested.** | F01 F02 F03 |
| `POST /rest/v1/rpc/get_tour` | one tour with its full line and ordered stops | anyone (a draft only to its owner) | `p_slug` | one JSON value, or `null` | F01 F04 |
| `POST /rest/v1/rpc/highlights_in_bbox` | highlights inside the map view | anyone | bounds, optional sport | rows with GeoJSON | F04. **Planned, not written** (milestone 3) |
| `POST /rest/v1/rpc/propose_highlight` | add a highlight as `pending` | signed in | name, kind, sports, point or segment | the new id | F05. **Planned, not written** |
| `POST /rest/v1/highlight_tips` | add a tip as `pending` | signed in | `highlight_id`, `body` | the row | F05. Policy written, client not |
| `POST /storage/v1/object/highlight-photos/...` | upload a photo | signed in | an image, size and type limited by the bucket | the path | F05. **Planned**, bucket not defined |
| browser only | place search: Nominatim on Enter, no server | anyone | text | up to 5 places | F02 |
| browser only | "use my location": the browser's geolocation | anyone | n/a | a point | F01 |
| browser only | GPX export: built from `get_tour`'s GeoJSON | anyone | n/a | a `.gpx` file | F06 |
| `scripts/ingest-tours.mjs` | read `routes/*` track files, dedupe, compute ascent, upsert `tours` by slug | a maintainer, with the service key from the environment, never committed | track files | rows. **Not written** | n/a |

Webhooks in: none for this slice. When payments are tied to routes, Razorpay
calls an Edge Function that checks `X-Razorpay-Signature` (HMAC-SHA256 over the
raw body) before trusting anything.
Webhooks out: none. Jobs: none.

## The parts that bite

- **The recon is unverified.** A wrong guess about S04 or `max_distance` costs
  rework in milestone 2. Do the first-hand look before then.
- **The live Supabase project is unknown.** Applying `schema.sql` there could
  collide with existing tables, and any existing table without row level
  security is readable by anyone, because the anon key is public. Inspect
  first. Apply to a staging copy first.
- **Map tiles.** The site loads `tile.openstreetmap.org` directly. Its policy
  says heavy use may be blocked without notice and offline prefetch is not
  allowed there. Naarad's pricing also promises offline maps. Both need your own tile source
  or a paid provider before launch. Which one and its cost: not researched.
  The Sarvam blueprint in `docs/` already plans downloadable vector-tile
  bundles, which is the direction to follow.
- **Geocoding.** Nominatim allows 1 request per second and no search-as-you-type.
  Keep place search on Enter only (it is today). If traffic grows, move to a
  hosted geocoder behind an Edge Function.
- **Offline.** `sw.js` runs `networkFirst` on every `supabase.co` response and
  calls `cache.put` on it. A browser's Cache API only stores GET requests, and
  `search_tours` is a POST, so that put fails (unhandled, only noisy) and
  Discover has no offline fallback from the RPC. Give Discover a bundled JSON
  fallback, and make `networkFirst` skip non-GET. A GET-style RPC may also work
  (see the unverified row above).
- **The URL.** `404.html` rewrites unknown paths to `/?page=<name>` and
  **drops every other query parameter**. Path-style URLs like Komoot's
  (`/discover/.../tours?sport=hike`) would lose their state on refresh. Keep the
  search state on `/?page=planner&mode=discover&lat=&lng=&sport=&...`, which
  `index.html` serves directly. (Discover lives in the planner page, not the
  separate `routes` page.)
- **Duplicate tracks.** `routes/geo-tracks.json` and `routes/gpx-tracks.json`
  hold the same routes under different names: 16 entries are 9 unique tracks
  (matched on point count and first and last point). Discover merges both
  today, so users see duplicates. Ingest must dedupe.
- **The 12 curated routes have placeholder paths.** Discover lists the inline
  `ROUTES` array in `index.html` (12 routes; 6 of them are also in
  `routes.json`). Each `path` is 4 or 5 points, and its length is 21 to 40% of
  the stated distance. Because the database derives distance from the line,
  ingesting them would print distances 2.5 to 5 times too short. They need real
  GPS tracks before they can become tours.
- **Moderation.** Highlights, tips and photos are user content. The schema
  forces `pending`, but someone has to review the queue, and there is no report
  flow yet.
- **Difficulty and ascent are editorial or ingest-time**, not computed from the
  line in the database. Classifying difficulty from geometry is hard and is not
  attempted.
- **Ranking is nearest first, then best rated.** There is no personalisation
  (Komoot's depends on its user data). Fine at tens of routes, thin at
  thousands.
- Race conditions, idempotency: the ingest upserts by slug in one transaction
  per tour. Nothing else here is write-heavy.

## Build order

1. **Vertical slice.** Apply the schema to a staging copy of the Supabase
   project. Write the ingest script and load the 9 unique real tracks. Point
   Discover's list and map at `search_tours` (with the current JSON as the
   fallback), keeping the sport, max-length and difficulty filters it has or
   nearly has. Open the existing route page from a card. Put the search state
   on `/?page=planner&mode=discover&...`.
   Screens S01, S02 (partial), and the existing route page standing in for S04.
   Tables `tours`, `tour_stops`. Routes `search_tours`.
   Proves: PostGIS on the real project, row level security with the public key,
   the RPC from the GitHub Pages origin, and the service worker not breaking it.
2. **Must-haves** (7 in `features.csv`). Place search on Enter (S03). A hard
   level and difficulty filter. A real tour detail page from `get_tour` (S04, once
   confirmed). Card and split-view parity. Routes `get_tour`.
3. **Should-haves** (11). Duration and elevation filters, difficulty-coloured
   lines, start labels, result count, full URL state. Highlights on the map
   (S05, S06) with moderation and Storage. GPX import and export (S08). Offline
   needs the tile decision first. Tables `highlights`, `tour_highlights`,
   `highlight_tips`, `highlight_photos`. Routes `highlights_in_bbox`,
   `propose_highlight`.
4. **Could-haves** (10). Pagination UI, surface and route type filters,
   direction markers, the map on/off toggle, multi-day stages.
5. **The fixes** `/replica-entrepreneur` finds. It has not run.

## Decisions for you

1. **Keep Naarad's static stack** instead of the pack's Next.js default?
   Recommended: yes.
2. **Who applies the schema?** This session cannot reach the Supabase project.
   Someone with access runs `schema.sql` on a staging copy first.
3. **Which tile source** replaces `tile.openstreetmap.org` before launch, and
   what budget?
4. **Real GPS tracks** for the 12 curated routes, or leave them out of Discover.
5. **Tie routes to payments** (the "1 free route, District Pass" model in
   `data/pricing.json`)? That needs an entitlements table and the Razorpay
   webhook. It is not in this slice, and not in the recon.
