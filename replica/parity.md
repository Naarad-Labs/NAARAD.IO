# Parity: Naarad Discover against Komoot Discover

Date: 2026-10-04 (second pass, after the user's screenshots, the pitch deck and the brand kit)

**What the original side rests on now.** Seven screenshots of **Komoot's Android app** from the user's own account (the map
and list views are first-hand; the images stay on their machine, see `replica/screens-notes.md`), two cropped app screens in
the user's deck, and the earlier search summaries. Nothing was seen of the **website**. Every "the original does" below is
labelled with which of these it comes from.

## Verdict: not shippable (by the pack's rule)

- 3 of 7 must-have features are not done: **dropped-pin search** (partial), the **tour detail page** (S04, partial), and
  **result cards** (partial: the original's card has a photo and a people count, Naarad has no photos in its data).
- Open S1 bugs: none. Open S2: none. Two S3 bugs are open, both in Plan mode (`replica/bugs.md`).
- The pack calls a clone shippable at **feature score 80 or more** with every must-have done. The score is **45.2**.

What this verdict does not say:

- It does not say PR #3 is unsafe to merge. It scores the clone as a replacement for Komoot Discover. PR #3 replaces
  Naarad's own earlier Discover, and its 71 end-to-end tests pass.
- It does not say 80 is within reach of this slice. Every must-have and should-have except Highlights and offline maps gets
  **76.2**; reaching 80 takes both of those too (82.5), and the recon put them outside the Discover slice. That bar is yours to set.

**How the score moved, and why it fell before it rose.** The first report said 48.1. Your screenshots then showed more in the
original than the summaries had (a map-first phone layout, a map/list switch, a locate button, a map layers button, a
"search this area" button, an elevation profile) and showed that the card needs a photo, so the benchmark got harder and the
same clone scored **38.9**. Rebuilding the phone layout from the screenshots brought it to **45.2**. The clone got better; the
yardstick got more honest.

## Scores

| measure | score | how |
| --- | --- | --- |
| Feature parity | **45.2 / 100** | `parity.py` over `replica/features.csv`: 34 features counted, must 3, should 2, could 1, partial counts half |
| Layout parity, as the tool computes it | 18.6 / 100 | `imgdiff.py` edge maps, 3 screens. **Not used, see below.** |
| Layout parity, measured | 10 of 15 parts match, 4 differ, 1 by design | the table below: positions read from the original, positions read from the clone |
| Overall | **45.2 / 100** | feature score. The tool's own blend (80% features, 20% edge-map layout) would print 39.9. |

## Layout diff

### The tool's score (18.6) is not a measure of layout here

`imgdiff.py` turns both screenshots into edge maps and compares which grid cells hold edges. The original's map is full of road,
label and coastline edges in every cell, and its cards hold photos and map images. **The clone's map has no tiles in the test
environment** (the tile host is blocked) and Naarad has no photos. So the score is the difference between a full map and an empty
one, not between two layouts. Same states, same crop, same width:

| pair (original, clone) | edge-map score |
| --- | --- |
| map view, zoomed out, no place (`orig-m-map-wide`, `D-map-wide`) | 19.0 |
| map view, searched Chennai (`orig-m-map-chennai`, `D-map-place`) | 17.9 |
| list view, top of the list (`orig-m-routes-list-top`, `D-list`) | 19.0 |

To rerun: `replica/build/diff-screens.js` takes the clone's side and `replica/screens/README.md` lists the originals (crop recipe in
the script header). Redo it when the clone's map has tiles: that is the first time this number will mean anything.

### Measured instead

Original: read off the screenshots at 390 CSS px wide, good to about 3 px. Clone: read from the DOM by `diff-screens.js`
(`replica/diffs/clone-geometry.json`) in the same states. Both measured from the top of the map area, below the app's status bar
and the site's header. All in CSS px.

| part | original | clone | verdict |
| --- | --- | --- | --- |
| Search pill: side margin, height | 17, 58 | 16, 56 | match |
| Pill to chips | 13 | 12 | match |
| Chip row: height, gap | 48, 11 | 48, 8 | match (gap 3 tighter, so three chips fit one row) |
| Chip widths (sport, radius, filters) | 78, 151, 99 | 107, 121 (140 with a place), 92 | differ: ours says "Sport" in words; the original shows an icon |
| Order of the controls | sport, within N km, Filters | Sport, All of India / Within N km, Filters | match |
| Collapsed sheet: height, count position, handle | 74, centred 43 below its top, 40 wide | 80, centred 43 below its top, 40 wide | match |
| List: cards start | 18 under the chips | 65 under the chips (handle and count sit above the first card) | **differ**: the original's list view is its own screen, ours is the sheet at full height |
| Card: side margin, media height | 17, 140 | 16, 140 | match |
| Card: badge over the media, top left | 17 in, 17 down, 22 tall | 12 in, 12 down, 24 tall | match |
| Card: rating row under the media | 12 below | 12 below | match |
| Card: rows | rating, title, stats | rating, title, **place and distance**, stats | differ: ours adds a place line |
| Stats order and icons | time, length, climb; icons | time, length, climb; icons | match |
| Map button in the list | 96 x 49, centred, 23 from the bottom | 106 x 48, centred, 16 from the bottom | match |
| Map controls | offline, locate, layers | zoom buttons, credit | **differ** (see the features list) |
| Bottom tab bar | five tabs | none (the site's own navigation) | by design: the site is not the app |

### Colour and type are not compared

The pack's layout mode ignores colour on purpose. Naarad's palette and type are its own (`replica/brand-review.md`).

## Behaviour diff

"Original" says where it comes from: **screenshot** (first-hand, the app), **deck** (one cropped frame), **summary** (the earlier
search summaries, unverified).

| flow | original does | clone does | fix or keep |
| --- | --- | --- | --- |
| Reach results (F01) | The Routes tab opens on a map with a count ("14 runs"); the list is one tap away (screenshot). | Opens on all of India with the sheet at 40%, 21 routes; a tap on the handle opens the list. No clicks to see results. | Keep. |
| Where state lives | Path URL on the web (given by the user). The app: not visible. | `/?page=planner&mode=discover&lat=&lng=&q=&r=&sport=&theme=&diff=&max=`. Reload and Back restore it. | Keep: `404.html` drops the query string, so path URLs need the router changed. |
| What the distance control means | A chip "within 46 km" beside the place: a **radius** (screenshot). | Within (radius) is now a chip; Longest route (a length cap) is Naarad's own extra, inside Filters. | Keep both. The original's Filters panel was not seen: it may have its own length control. |
| Sport | A dropdown chip, icon and chevron (screenshot). Options not seen. | A dropdown chip that says "Sport" or the sport, with Any, Walk, Hike, Cycle, Run. Run is offered but no route has it. | Hide sports with no routes, or add routes. |
| Choose a place | A pill reading "Map area" or the place; "+ Plan New" at its right (screenshot). A picker with a dropped pin (summary). | A pill (Enter to search) with clear and locate buttons. **No dropped pin.** No "Plan New" (the planner's own tab bar sits above). | Fix: dropped pin. Keep Enter-only: Nominatim forbids search-as-you-type. |
| Panning the map | A "Search this area" button appears (deck). | The map can be panned; nothing offers to search there. | Fix (cheap, and it covers part of the dropped-pin gap). |
| Count | "14 runs", "2 runs", centred in the sheet (screenshot). | "21 routes", "10 routes within 30 km of Chennai, Tamil Nadu", centred. | Keep. |
| List and map | Separate views; a floating Map button returns (screenshot). | One sheet that grows to a full-height list; a Map button returns. | Keep. |
| Open a result | Probably a tour page (a tour screen exists, deck). | The card selects and its marker highlights. 6 of the 12 curated routes have "Open route page". | Fix: build S04 for all routes. |
| Take a route with me | Export is GPX with the line only (summary). | Plan mode exports waypoints and a track. **A route found in Discover cannot be exported.** | Fix. |
| Offline | An offline button on the map; maps for a region (screenshot, summary). | Discover lists from the cached seed with no network. No offline maps. | Later: Highlights and offline are outside the slice. |
| Errors | Not seen. | Alerts with Try again, a message under the pill, an empty state that names the distance and offers one button. | Keep. |
| Remembered between visits | Not seen. | Nothing but the URL. | Confirm. |

## Feature parity by area, weakest first
- highlights                     0.0  (3 features)
- offline                        0.0  (1 features)
- tour detail                   25.0  (3 features)
- planning                      27.8  (6 features)
- search                        53.6  (13 features)
- map                           67.9  (8 features)

## Missing, in build order
- [must] search: Results as cards with key stats, partial  (First-hand (app): card has a photo or route map, a difficulty badge, rating and people count, title, duration, length and ascent. Naarad's card has the stats, badge and rating but no photo (none in the data) and no people count)
- [must] search: Search tours by place: current location, address or dropped pin, partial  (Built: address search on Enter (Nominatim) and Use my location. Missing: dropped pin. Verified by check-discover.js)
- [must] tour detail: Tour detail page: map, distance, duration, elevation, difficulty, description, partial  (Not built as S04. The 6 curated routes that have a route page get an Open route page button. Tracks and the other 6 have no page)
- [should] highlights: Highlights on the map: points and segments with photos and tips, no  (Source: help summary. Closest in Naarad: waypoints and audio stops)
- [should] offline: Offline maps for chosen regions, no  (Source: help summary. Naarad's pricing.json and routes.json claim offline, implementation not audited)
- [should] planning: Import GPX, TCX or FIT, no  (Source: help summary. Naarad only has an offline build script (convert-gpx.js), not a user feature)
- [should] search: Filter by duration range, 30 minutes to 10 hours, no  (Source: help summary. routes.json has duration_min)
- [should] search: Filter by elevation gain range, no  (Source: help summary. routes.json has one elevation_m, meaning of the number unconfirmed)
- [should] search: Search this area: a button over a panned map that searches where the map is now, no  (Deck slide 4 (one frame). Not in the screenshots the user took)
- [should] tour detail: Elevation profile on the tour page, with stops marked, no  (Deck slides 4 and 12 (app screens, cropped). Naarad's route pages have no elevation profile chart)
- [should] map: Labelled start points on the map, partial  (Built: start markers ringed in the difficulty colour. Not built: text labels)
- [should] map: Tour lines on the map coloured by difficulty, partial  (Built: colour and dash per difficulty. But only the 9 real tracks have a line and none has a difficulty, so today they are drawn in the neutral colour)
- [should] planning: Export a route as GPX (line only, no waypoints), partial  (Plan mode exports the route you draw as GPX: waypoints and a track (test F06-H1). A route found in Discover cannot be exported.)
- [should] planning: Plan a route on the web from waypoints, partial  (Naarad's Plan mode, untouched by the rebuild. Tested: add, remove, clear, export all work (F06). Two open bugs: BUG-006 (the empty list says click the map, but a button press is needed first), BUG-007 (its search box does nothing).)
- [should] search: Search state lives in the URL: place, centre point, sport, max distance, page, partial  (Built on /?page=planner&...: place, centre, radius, sport, theme, difficulty, max length. No page (there is no pagination). Restores on load)
- [could] highlights: Create a Highlight: pin, name, sport, tip, photos, no  (Source: help summary. Closest in Naarad: the Creator audio annotations)
- [could] highlights: Rate Highlights after an activity and add a tip or photo, no  (Source: help summary. Needs activity recording, so depends on a feature outside this slice)
- [could] map: Animated direction markers on tour lines, no  (Source: press summary)
- [could] map: Map layers switcher, no  (First-hand (app): a Map layers pill. Layer choices not seen)
- [could] planning: Add Highlights and places of interest as waypoints, no  (Source: help summary)
- [could] planning: Plan multi-day routes as stages, no  (Source: help summary. A Premium feature in the original)
- [could] search: Filter by route type: loop or out and back, no  (Source: press summary. No such field in Naarad's data)
- [could] search: Filter by surface: no preference, paved, off-road, no  (Source: help summary. No surface field in Naarad's data)
- [could] search: Paginated results, no  (Source: pageNumber in the URL. Only worth it with more than a few dozen routes. Naarad has about 20 (12 curated, 9 unique tracks))
- [could] tour detail: Numbered stops along the route on the tour page, no  (Deck slides 4 and 12. Closest in Naarad: audio stops with numbered markers on the route pages)
- [could] map: Locate-me button on the map, partial  (First-hand (app): a round button on the map. Naarad's is an icon button inside the search pill (Use my location), not on the map)
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

## Top five to build next

Score effects are `parity.py` on a copy of `features.csv` with those rows set to done, applied in this order.

| # | build | why | score after |
| --- | --- | --- | --- |
| 1 | **Dropped-pin search** (and "Search this area" with it) | A must-have. Click the map to set the place, or press a button over a panned map: both reuse one map-click mode. Skip reverse geocoding (Nominatim's limit is 1 request a second, shared with search): label it "Dropped pin" and show the coordinates. | 47.6, then 50.8 with "Search this area" |
| 2 | **S04 tour detail,** for all 21 routes, with an elevation profile and numbered stops | A must-have, and the screens are in the deck. `get_tour` is already in `discover/data.js`. Naarad's route pages have audio stops: reuse them. Decide whether it replaces the 6 existing pages or links to them. | 57.9 |
| 3 | **Photos and a people count on cards** | The last must-have. Needs content, not code: a photo per route, and a count of who has done it. Until then the contour-and-route drawing stands in. | 60.3 |
| 4 | **Duration and elevation filters** | Two should-haves. The data has `duration_min` and one `elevation_m` whose meaning is unconfirmed: check the data first. | 66.7 |
| 5 | **Real GPS tracks for the 12 curated routes, and a difficulty for the 9 tracks; then a tile source and the Supabase backend** | Today the 12 show a start marker only. Tracks need data from whoever owns the routes. OSM's public tiles are not for production use, and without tiles in the test environment the layout score cannot mean anything. | 69.8 |

After these: Highlights, offline maps and GPX import are what stand between 70 and 80.

## Next

`/replica-build` for the gaps above. `/replica-entrepreneur` is still not run: it needs real, linked reviews of the original, quoted
verbatim. Reddit, Trustpilot, Google Play, the App Store and komoot.com did not connect from this environment (checked
2026-10-04), so any review quoted from here would be from memory. Either allow those hosts or paste in the reviews you want mined.
The deck's "Anti-Google Map" slide (crowd density, open hours, tier) is the best candidate for a point of difference, and it needs
data first.
