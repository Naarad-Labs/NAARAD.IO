# Build log: Naarad Discover

One line per screen, then what was found along the way. Dates are 2026-10-04.

## Screens

| ID | screen | status | what is missing | what was harder than expected |
| --- | --- | --- | --- | --- |
| shell | tokens, primitives, data layer | done | the data layer is the local seed, not Supabase. `schema.sql` is not applied anywhere. | the stylesheet was already damaged (see below), so the shell avoids it instead of building on it |
| S01 | Discover results and map | done, **rebuilt** after the screenshots | pagination (21 routes fit on one page). Route lines for the 12 curated routes. Photos on cards. A people count. "Search this area". | the phone layout: three chips that each open a panel, and keeping them on one row at 390px |
| S02 | filters | partial: on a phone, three chips (Sport, Within, Filters) | duration and elevation ranges, surface, loop or out-and-back. The data has no values for them. | one panel open at a time, and closing it with Escape, a tap outside or a pick, without breaking arrow keys on the sport list |
| S03 | place search | partial | a dropped pin. Place name suggestions as you type: the geocoder's policy forbids them, so search runs on Enter only. | a hint that must not sit on the chips while you type |
| S04 | tour detail | not started | everything. 6 of the 12 curated routes get an "Open route page" button to the page they already had. | n/a |
| S05 to S08 | highlight, create highlight, planner, import and export | not started | n/a | n/a |

Feature matrix: `features.csv`. Parity **45.2 of 100** (`parity.md` says why that is lower than the 48.1 first reported, and
what raises it), must-haves 4 of 7 done. Not shippable by the pack's own rule until place search has a dropped pin, S04 exists and
cards have photos.

### What changed in the second pass (same day)

The user supplied seven screenshots of Komoot's Android app, the pitch deck and the brand kit.

- **Layout.** Below 900px Discover is map-first: a search pill and three chips float over the map, the results rise from the bottom
  in a sheet with a centred count, a tap on the handle opens the full-height list, and a Map button comes back. Cards follow the
  original's order: media with the difficulty badge over it, rating, title, place, then time, length and climb with icons.
  From 900px up it is the same bar as before with every control open, restyled.
- **Look.** Palette from the brand kit and the deck, serif card titles, pill controls, outline icons, a contour pattern behind routes
  with no photo, a mandala line drawing in the empty state. `replica/brand-review.md` says what came from where, where the kit, deck
  and site disagree, and what was not taken (Cinzel, the kit's navy, mustard).
- **Evidence.** `replica/screens-notes.md`; the recon's open questions 4, 6 and 7 are answered (partly) in `recon.md`.
- **Privacy.** The repo is public and served by GitHub Pages, so the screenshots are kept out of it (`replica/screens/.gitignore`).
- **Service worker** cache name bumped to `naarad-v7`.

## How it was checked

`replica/build/check-discover.js` loads the real `index.html` in Chromium at 1440x900 and 390x844 with real Leaflet and a stub
geocoder. 27 scenarios, all passing, rerun after the rebuild (on a phone each control is reached through its chip):

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

The proper regression suite is `e2e/` (71 tests; plan in `replica/test-plan.md`, findings in `replica/bugs.md`). It found 9 bugs
the checks above missed, 7 of them fixed (including the route page Back button, which left the site), and the rebuild added 9
tests, two of which caught bugs of its own (BUG-010, BUG-011). `check-discover.js` is kept as a quick script, and it takes the
screenshots in `replica/clone-screens/`. `replica/build/diff-screens.js` takes the ones for the layout diff.

Not checked: real map tiles (blocked in the test environment), the real serif face, real Nominatim, a real phone, Safari and Firefox, any screen reader.

## Lessons from the build

- **The tests passed while the map was broken.** The first version asserted that start markers existed in the DOM. They did, and
  the map looked empty. A preview rule, `.nd-map svg { width: 100%; height: 100% }`, stretched every SVG Leaflet draws, including
  the attribution flag, which filled a corner of the screen. Found only by looking at a screenshot. The check now asserts that the
  markers are on screen and that the flag is small, and I re-introduced the bug to confirm the check fails on it (flag 119px).
- **The filter panel fix needed its own test.** "Every control is reachable with the filters open" now runs at both widths. It
  failed first, which is how the cause was found: with the filters open the sheet kept its old height, grew upward and covered
  the Difficulty chips. It is capped to its container now.

- **An auto-sized grid column made the whole page wider than the screen.** The three chips in one line were wider than 390px, so the
  column grew to fit them and the pill and every card went with it (BUG-010). Seen first in a screenshot after a place search, then
  pinned by `F01-E23`, which I confirmed fails with the old CSS. Both grids now use `minmax(0, 1fr)`.
- **A control's name can collide with a field's label.** The first clear button was called "Clear place", and the test that finds the
  field by its label "Place" matched both. "Clear search" says what it does and does not clash; a voice-control user saying "Place"
  gets the field.
- **The brand kit's secondary button fails the deck's own accessibility promise.** White on the kit's orange is 3.06:1. Orange fills
  carry a navy label (4.7:1) instead.
- **Fitting three chips on one row was a design decision, not a styling one.** At 390px it took shorter labels ("Sport", not "Any
  sport"), no chevron on the radius chip, and tighter padding.

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

6. **The brand kit's heading face (Cinzel) is not used; Playfair Display is.** The deck and the live site use Playfair, and Cinzel
   has no lowercase. Reverse it if the kit is the authority and the site should change. `brand-review.md`, section 1.
7. **Navy stays the site's `#172752`, not the kit's `#0B1D3A`.** The planner's own navy bar sits right above Discover, and the deck
   matches the site. One token to change, plus `--navy` in `index.html` to change everywhere.
8. **Orange is a fill with a navy label, never white text on it.** The kit's own secondary button (white on orange) is 3.06:1 and fails
   the deck's WCAG 2.1 AA promise.
9. **"Within N km" is the main distance control; "Longest route" moved into Filters.** The original's control row has a radius chip and
   no length cap. Longest route is Naarad's own extra, and the original's Filters panel was not seen.
10. **No "Plan New" in the search pill and no bottom tab bar.** The planner's own tab bar (Discover Routes, Plan Route) is above it.
11. **The Map button is orange**, as in the original, which makes it the one element that is a near copy. See `brand-review.md`,
    "How close is too close".

## Landing page and About page (2026-10-10)

Asked for by the founder, in the same change that puts the new Discover UI on `main`.

- **Hero headline** is now "Know a new world. Know it with Naarad." and nothing else on the site says it (the old `hero-sub`
  line that held a version of it is gone). The size follows the column so it stays on two lines from 320 px to a wide desktop.
- **About page removed**: the page, its nav and sidebar buttons, its script, its CSS, its `pages`, route and title entries, the
  `sitemap.xml` entry and the `404.html` whitelist entry. The six footer links labelled "About Naarad" went too (they pointed at
  Updates, not at the About page). `/about` and `/?page=about` now land on home; `initUrlPage` and the `popstate` handler check
  that the page exists, so an old link can no longer leave a blank screen.
- Service worker cache is `naarad-v8`.
- Not touched, on purpose: the old slogan "Stop Touring. Start Traveling." in `<title>`, the Open Graph and Twitter titles, the
  footer tagline and the home entry of the tab-title map; the About-page photos in `Images/`.
- Tests: `X-3`, `X-3b`, `X-4`, `X-5` in `e2e/site-smoke.spec.js`. `e2e/serve.js` now answers an unknown path with `404.html` and a
  404 status, as GitHub Pages does.

## Routes page removed; route lines only when selected (2026-10-10)

- **Routes page removed**: the page, its nav and sidebar buttons, its filter buttons and swipe track (JS and CSS), the `/routes`
  entry in `sitemap.xml` and the `routes` path in `404.html`. "Browse all routes" on the home page and the five footer links
  "Heritage Routes" now open the planner. The six route pages (`/routes/hampi` and the rest) stay: Discover cards and the home
  carousel open them. `/routes` and `/?page=routes` land on home.
- **Discover map**: every start pin is shown; a route's line (white casing and coloured line) is drawn only while the route is
  selected, from a card or a pin. Selecting another route replaces it. A tap on empty map puts the selection down. The selected
  pin turns solid with a white ring and pins stay above the line. Before this, all nine tracks were drawn at once.
- Service worker cache is `naarad-v9`.
- Tests: `F01-E19` (both widths) and `X-6`; `F01-E8` now leaves Discover through Features instead of Routes.

## To ship this

- [PR #3](https://github.com/Naarad-Labs/NAARAD.IO/pull/3) was merged on 2026-10-04 with the skill pack only, so none of the
  Discover work reached `main` until the pull request that carries this log. Merging that one is what puts it on the live site.
  It changes `index.html` and `sw.js`. The service worker cache name is `naarad-v8` so existing visitors pick the new files up.
  **Bump it again whenever a cached file changes.**
- Not required to ship, but next: apply `schema.sql` to a staging copy of the Supabase project, write `scripts/ingest-tours.mjs`,
  and swap `discover/data.js` for `supabase.rpc` calls (`/replica-backend`).
