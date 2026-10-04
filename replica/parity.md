# Parity: Naarad Discover against Komoot Discover

Date: 2026-10-04  Build: `947b6c1` (S01 to S03 shipped in `discover/`)

**The original side of this report is thin.** Komoot's own pages were blocked in this environment, so `replica/recon.md` is a draft
built from search summaries (help, press, the URL you gave). No screenshot of the original exists. Every "the original does"
below is from that draft and is unverified. Re-run this report after the recon is verified (`recon.md`, "Needs a first-hand look").

## Verdict: not shippable (by the pack's rule)

- 2 of 7 must-have features are not done: **dropped-pin search** (partial) and the **tour detail page** (S04, partial).
- Open S1 bugs: none. Open S2: none. Two S3 bugs are open, both in Plan mode (`replica/bugs.md`).
- The pack calls a clone shippable at **feature score 80 or more** with every must-have done. The score is **48.1**.

Three things this verdict does not say:

- It does not say PR #3 is unsafe to merge. It scores the clone as a *replacement for Komoot Discover*. PR #3 replaces
  Naarad's own earlier Discover, and its tests pass.
- It does not say 80 is within reach of this slice. Closing the 2 missing must-haves gets 53.8. Every must-have and should-have
  except Highlights and offline maps gets **74.5**. Adding either one gets 78.3. Reaching 80 takes both (82.1), and the recon
  put both outside the Discover slice (`features.csv`, areas `highlights` and `offline`). That bar is a decision for you, not a bug.
- It does not measure whether Naarad's Discover is *good*. Its extra theme filter and its link to the full route page score nothing.

## Scores

| measure | score | how |
| --- | --- | --- |
| Feature parity | **48.1 / 100** | `parity.py` over `replica/features.csv`: 28 features counted, must 3, should 2, could 1, partial counts half |
| Layout parity | **not computed** | `replica/screens/` does not exist. Layout mode compares against the original's screenshots and there are none. This is not a score of zero. |
| Overall | **48.1 / 100** | feature score only |

## Feature parity by area, weakest first
- highlights                     0.0  (3 features)
- offline                        0.0  (1 features)
- planning                      27.8  (6 features)
- tour detail                   50.0  (1 features)
- map                           55.6  (5 features)
- search                        63.5  (12 features)

## Missing, in build order
- [must] search: Search tours by place: current location, address or dropped pin, partial  (Built: address search on Enter (Nominatim) and Use my location. Missing: dropped pin. Verified by check-discover.js)
- [must] tour detail: Tour detail page: map, distance, duration, elevation, difficulty, description, partial  (Not built as S04. The 6 curated routes that have a route page get an Open route page button. Tracks and the other 6 have no page)
- [should] highlights: Highlights on the map: points and segments with photos and tips, no  (Source: help summary. Closest in Naarad: waypoints and audio stops)
- [should] offline: Offline maps for chosen regions, no  (Source: help summary. Naarad's pricing.json and routes.json claim offline, implementation not audited)
- [should] planning: Import GPX, TCX or FIT, no  (Source: help summary. Naarad only has an offline build script (convert-gpx.js), not a user feature)
- [should] search: Filter by duration range, 30 minutes to 10 hours, no  (Source: help summary. routes.json has duration_min)
- [should] search: Filter by elevation gain range, no  (Source: help summary. routes.json has one elevation_m, meaning of the number unconfirmed)
- [should] map: Labelled start points on the map, partial  (Built: start markers ringed in the difficulty colour. Not built: text labels)
- [should] map: Tour lines on the map coloured by difficulty, partial  (Built: colour and dash per difficulty. But only the 9 real tracks have a line and none has a difficulty, so today they are drawn in the neutral colour)
- [should] planning: Export a route as GPX (line only, no waypoints), partial  (Plan mode exports the route you draw as GPX: waypoints and a track (test F06-H1). A route found in Discover cannot be exported.)
- [should] planning: Plan a route on the web from waypoints, partial  (Naarad's Plan mode, untouched by the rebuild. Tested: add, remove, clear, export all work (F06). Two open bugs: BUG-006 (the empty list says click the map, but a button press is needed first), BUG-007 (its search box does nothing).)
- [should] search: Search state lives in the URL: place, centre point, sport, max distance, page, partial  (Built on /?page=planner&...: place, centre, radius, sport, theme, difficulty, max length. No page (there is no pagination). Restores on load)
- [could] highlights: Create a Highlight: pin, name, sport, tip, photos, no  (Source: help summary. Closest in Naarad: the Creator audio annotations)
- [could] highlights: Rate Highlights after an activity and add a tip or photo, no  (Source: help summary. Needs activity recording, so depends on a feature outside this slice)
- [could] map: Animated direction markers on tour lines, no  (Source: press summary)
- [could] map: Map view can be switched on or off, no  (Source: only the map=true URL parameter. Unconfirmed that there is a control)
- [could] planning: Add Highlights and places of interest as waypoints, no  (Source: help summary)
- [could] planning: Plan multi-day routes as stages, no  (Source: help summary. A Premium feature in the original)
- [could] search: Filter by route type: loop or out and back, no  (Source: press summary. No such field in Naarad's data)
- [could] search: Filter by surface: no preference, paved, off-road, no  (Source: help summary. No surface field in Naarad's data)
- [could] search: Paginated results, no  (Source: pageNumber in the URL. Only worth it with more than a few dozen routes. Naarad has about 20 (12 curated, 9 unique tracks))
- [could] planning: Add a waypoint by clicking the map, auto-placed in the best position, partial  (A click adds a waypoint at the end of the list, one per press of the Add button. It is never re-ordered into the best position (F06-H1, BUG-006).)

## Left out on purpose (not scored)
- Ranked or personalised recommendation order: Needs their user data. Use a plain relevance order (distance from the centre, then rating) instead
- Community network of millions of tours and user Highlights: The network and its content are not a feature you can rebuild. Seed with Naarad's own routes
- Heatmaps: Aggregate data they own
- 3D maps, live tracking, weather on route: Outside the Discover slice
- Turn-by-turn navigation and activity recording: A separate project, outside the Discover slice
- Garmin and watch sync: Partner integrations, not part of the product you can rebuild
- One free region, then Maps or Premium purchase: Naarad has its own pricing model (data/pricing.json)

## Yours, not in the original (not scored)
- Filter by theme: heritage walk, temple trail, nature hike, cultural tour, coastal walk, photography
- Open the full route page from a result card (story, map and tabs)

## Layout diff

Not possible: no screenshots of the original. To do it, save the original at 1440x900 and 390x844 (logged out, filled, filter panel
open, no results) as `replica/screens/S01.png` and so on, then:

```bash
python3 .claude/skills/replica-diff/imgdiff.py replica/screens/S01.png replica/clone-screens/S01-desktop.png --out replica/diffs/S01.png
```

Colour is ignored by layout mode on purpose, so the brand colours do not count against the clone.

**Self-regression instead** (pixel mode, the clone's screenshots at `e50cd0e` against now, tolerance 24). This says nothing about
the original. It says whether anything moved after the test fixes in `f761f99`.

| screen | match | note |
| --- | --- | --- |
| S01 desktop, S01 mobile | 100.0 | unchanged |
| S01 error, desktop and mobile | 100.0 | unchanged |
| S02 filters, mobile | 100.0 | unchanged |
| S03 place, desktop and mobile | 100.0 | unchanged |
| S01 empty, desktop | 98.9 | the "Clear filters" button moved from the bar into the empty state (the BUG-005 fix). Intended. |
| S01 empty, mobile | 99.4 | same change |

## Behaviour diff

Flow, what the original does, what the clone does, fix or keep. "Original" is unverified in every row unless it says otherwise.

| flow | original does | clone does | fix or keep |
| --- | --- | --- | --- |
| Reach results (F01) | Arriving on a pre-filled link shows results with no clicks (read from the URL). Happy-path click count unknown. | Opening the planner shows 21 routes with no clicks (all of India). One click per filter chip. A place is type plus Enter. | Keep. Count the original's clicks when it can be seen. |
| Where state lives (F01, F03) | Path URL: `/discover/{place}/@{lat},{lng}/tours?sport=hike&map=true&max_distance=30000&pageNumber=1` | `/?page=planner&mode=discover&lat=&lng=&q=&r=&sport=&theme=&diff=&max=`. Reload and Back restore it (tests F01-H3, F01-E8). | Keep. `404.html` drops the query string, so path URLs need the router changed. |
| What `max_distance` means | Unknown: a length cap or a search radius | Two controls: "Within" (radius from the place) and "Longest route" (length cap) | Confirm, then drop one if the original has one. |
| Choose a place (S03) | A picker with a search field, "use my location" and a dropped pin (press summary) | Search field (Enter only) and "Use my location". **No dropped pin.** | Fix: dropped pin. Keep Enter-only: Nominatim forbids search-as-you-type. |
| Place not found, search down, location denied | Not seen | A message that says what to do, the old results stay (F01-N1 to N3) | Keep. |
| Nothing matches | Not seen | An empty state with the reason and a button back out (F01-N6) | Keep. |
| Open a result (S04) | Probably a tour page (guess, not evidenced) | The card selects and its marker highlights. 6 of the 12 curated routes also get "Open route page". The 9 tracks and the other 6 have no page. | Fix: build S04 for all routes. |
| Map and list agree | Unknown (recon item 7) | Clicking a marker selects its card and scrolls to it. Selecting a card highlights the marker (F01-E18). | Confirm what the original does. |
| Paging (F03) | `pageNumber` in the URL | None. 21 routes fit on one page. | Keep until there are about 50 routes. |
| Remembered between visits | Unknown | Nothing, apart from the URL. The service worker caches the files, so the list works offline after one visit (F01-E11). | Confirm. |
| Take a route with me (F06) | Export is GPX with the line only, no waypoints (press summary) | Plan mode exports waypoints and a track (F06-H1). **A route found in Discover cannot be exported at all.** | Fix: export from a Discover route. Keep the waypoints (more than the original, if the summary is right). |
| Click the map in Plan mode | Auto-places the point in the best position (help summary) | Needs a press of "Add waypoint by clicking map" first, once per point (BUG-006, open). Appends at the end, never re-orders. | Fix. |
| Sport "Run" | Not seen | Offered, but no route has it, so choosing it always empties the list | Hide sports with no routes, or add routes. |
| Emails | Not seen | Discover sends none | n/a in this slice. |

## Top five to build next

Score effects are `parity.py` on a copy of `features.csv` with those rows set to done, applied in this order.

| # | build | why | score after |
| --- | --- | --- | --- |
| 1 | **Dropped-pin search.** Click the map to set the place. | A must-have. Needs a map click mode. Skip reverse geocoding (Nominatim's limit is 1 request a second, shared with search): label it "Dropped pin" and show the coordinates. | 50.9 |
| 2 | **S04 tour detail,** for all 21 routes. `get_tour` is already in `discover/data.js`. | A must-have. Decide whether it replaces the 6 existing route pages or links to them. | 53.8, all 7 must-haves done |
| 3 | **Duration and elevation filters.** | Two should-haves in the search area. The data has `duration_min` and one `elevation_m` whose meaning is unconfirmed: check the data first. | 61.3 |
| 4 | **Real GPS tracks for the 12 curated routes, and a difficulty for the 9 tracks.** | Today the 12 show a start marker only and the 9 tracks are all drawn in the neutral colour. Needs data from whoever owns the routes, not code. | 65.1 |
| 5 | **A tile source for launch, and the Supabase backend** (`/replica-backend`). | Not a parity feature, so it does not move the score. OSM's public tiles are not for production use, and `schema.sql` is not applied anywhere. | 65.1 |

After these: Highlights, offline maps and GPX import are what stand between 65 and 80.

## Next

`/replica-build` for the gaps above. `/replica-entrepreneur` is not run yet: it needs real, linked reviews of the original, quoted
verbatim. Reddit, Trustpilot, Google Play, the App Store and komoot.com did not connect from this environment (checked 2026-10-04),
so any review quoted from here would be from memory. Either allow those hosts or paste in the reviews you want mined.
