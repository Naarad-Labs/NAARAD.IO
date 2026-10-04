# Build log: Naarad Discover

One line per screen, then what was found along the way. Dates are 2026-10-04.

## Screens

| ID | screen | status | what is missing | what was harder than expected |
| --- | --- | --- | --- | --- |
| shell | tokens, primitives, data layer | done | the data layer is the local seed, not Supabase. `schema.sql` is not applied anywhere. | the stylesheet was already damaged (see below), so the shell avoids it instead of building on it |
| S01 | Discover results and map | done | pagination (21 routes fit on one page). Route lines for the 12 curated routes: they have no real GPS track, so they show a start marker only. | the map. A rule of mine broke every SVG Leaflet draws, and the tests passed anyway (see below) |
| S02 | filters | partial | duration and elevation ranges, surface, loop or out-and-back. The data has no values for them. | filters on a phone: the open panel ran under the results sheet and its lower controls were unreachable |
| S03 | place search | partial | a dropped pin. Place name suggestions as you type: the geocoder's policy forbids them, so search runs on Enter only. | nothing, apart from deciding what to do about two search boxes (the planner bar's now hides in Discover mode) |
| S04 | tour detail | not started | everything. 6 of the 12 curated routes get an "Open route page" button to the page they already had. | n/a |
| S05 to S08 | highlight, create highlight, planner, import and export | not started | n/a | n/a |

Feature matrix: `features.csv`. Parity 45.3 of 100, must-haves 5 of 7 done (the other two are partial). Not shippable by the
pack's own rule until place search has a dropped pin and S04 exists.

## How it was checked

`replica/build/check-discover.js` loads the real `index.html` in Chromium at 1440x900 and 390x844 with real Leaflet and a stub
geocoder. 27 scenarios, all passing:

- filled, filters, empty, loading (skeletons), error and retry, long content, URL state, selecting, place found, not found,
  search down, location granted and denied
- every control reachable with the filters open; text 12px or more; no clipping; no horizontal scroll
- axe-core on the Discover region at both widths: no violations
- keyboard only: place field, sport radios, chips, card, and (phone) the sheet handle
- Plan mode still opens and its map starts; other pages load; the home page's difficulty pills keep their colours; with Leaflet
  missing the list still works and says so
- typing in the place field makes no geocoder call (Nominatim forbids search-as-you-type)

Also: `discover/data.test.js` (11 tests, ported from `schema.test.sql`), `schema.test.sql` (66 assertions, on PostgreSQL 16 with
PostGIS), `replica/design/check-preview.js`, `contrast.py` (20 pairs, 0 failing AA).

The proper regression suite is `e2e/` (62 tests, run by `/replica-test`; plan in `replica/test-plan.md`, findings in
`replica/bugs.md`). It found 9 bugs the checks above missed, 7 of them fixed (including the route page Back button, which left the
site). `check-discover.js` is kept as a quick script.

Not checked: real map tiles (blocked in the test environment), real Nominatim, a real phone, Safari and Firefox, any screen reader.

## Lessons from the build

- **The tests passed while the map was broken.** The first version asserted that start markers existed in the DOM. They did, and
  the map looked empty. A preview rule, `.nd-map svg { width: 100%; height: 100% }`, stretched every SVG Leaflet draws, including
  the attribution flag, which filled a corner of the screen. Found only by looking at a screenshot. The check now asserts that the
  markers are on screen and that the flag is small, and I re-introduced the bug to confirm the check fails on it (flag 119px).
- **The filter panel fix needed its own test.** "Every control is reachable with the filters open" now runs at both widths. It
  failed first, which is how the cause was found: with the filters open the sheet kept its old height, grew upward and covered
  the Difficulty chips. It is capped to its container now.

## Found along the way, not fixed

These are in the existing site. I did not change them, except where noted.

1. **The stylesheet has selector-less blocks.** About 8 blocks (37 flagged spots, lines about 1332 to 1495) are declarations with their
   selector lines missing, and the stray `}` closes `@media (max-width: 899px)` early. Commit `dde6106` ("Planner overhaul:
   Discover-only mode") deleted the selector lines and left the bodies; the commit before it, `d6f43e5`, has none. This is why the
   old Discover showed a full-width bottom sheet at every width, which the first design pass read as a design choice. The old
   Discover's own rules in that block are now dead code. What the removed selectors were: `.pvt-bar`, `.pvt-btn`, `.pvt-btn.active`,
   `.act-chip`, and (by symmetry with the Discover rules, not recoverable from history) the mobile `.plan-split`, `#plan-map`,
   `.plan-panel` and its `::before`. Plan mode's mobile bottom-sheet styles therefore cannot apply (not checked on a real phone).
   Repairing them means choosing those selectors, which is a decision for whoever owns Plan mode.
2. **`<img src="LOGO_PLACEHOLDER">` is a 404 on every page load.** A script swaps in the real logo afterwards, but the browser has
   already asked for the placeholder. Same in the original site.
3. **The planner page is 26px taller than the viewport** at both 390x844 and 1440x900 (page bottom 870 on 844), so the document
   scrolls a little. Same in the original site.
4. **The planner bar's search box does nothing.** Its handler geocodes and then pans `window.discMap`, which nothing ever set.
   It is now hidden in Discover mode (Discover has its own place field) and unchanged in Plan mode, where it still does nothing.
5. **Duplicate data.** The curated routes live in the inline `ROUTES` array in `index.html` and, for 6 of them, `routes.json`.
   The two track files hold the same 9 routes under 16 names. `scripts/make-seed-tours.mjs` de-duplicates for Discover.
6. **`sw.js` tries to cache POST responses** from Supabase (`cache.put` only accepts GET). Harmless today because Discover does not
   call Supabase yet. It matters when `search_tours` goes through `supabase.rpc`: make `networkFirst` skip non-GET first.

## Decisions I made that you may want to reverse

1. **The 12 curated routes lose their drawn line.** Their `path` is a 4 or 5 point sketch that is 21 to 40 per cent of the stated
   distance. The old Discover drew it as if it were the route. The new one shows a start marker only. The change is one line in
   `scripts/make-seed-tours.mjs` (give them `path` and `path_preview` again).
2. **Sport is inferred for the curated routes** (`heritage-walk`, `temple-trail`, `cultural-tour`, `photography` become Walk;
   `nature-hike` becomes Hike; `cycling` becomes Cycle). For the 9 tracks it comes from the track files' own `type` label.
   Nothing about difficulty, duration or rating is invented for the tracks: they show distance only.
3. **Discover's default view is all of India, not a place.** That is what the old one did, so I kept it. It needed a "no centre
   means anywhere" mode in `search_tours`, which is now in `schema.sql` and tested.
4. **Map tiles are unchanged** (`tile.openstreetmap.org`). `architecture.md` explains why that is not enough for launch.
5. **Pages stay at `/?page=planner&...`** rather than path URLs, because `404.html` drops the query string.

## To ship this

- Merge [PR #3](https://github.com/Naarad-Labs/NAARAD.IO/pull/3). It changes `index.html` and `sw.js`, so it changes the live site.
  The service worker cache name is now `naarad-v6` so existing visitors pick the new files up. **Bump it again whenever a cached
  file changes.**
- Not required to ship, but next: apply `schema.sql` to a staging copy of the Supabase project, write `scripts/ingest-tours.mjs`,
  and swap `discover/data.js` for `supabase.rpc` calls (`/replica-backend`).
