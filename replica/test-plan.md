# Test plan: Naarad Discover

Build: `e50cd0e` (Discover rebuild)  Date: 2026-10-04  Env: local static server, seed data, real Leaflet, stubbed geocoder

Scope: the flows in `replica/recon.md` that the build covers: **F01** find a hike near me, **F02** search somewhere else.
**F06** (plan a route and take it with me) is Naarad's existing Plan mode, which the rebuild did not touch. It is tested here because
its export is a "partial" row in `features.csv` and nothing had tested it. **F03** (paging), **F04** and **F05** (Highlights) are not
built, so they have no cases. The seed and the schema are not the live Supabase project, so row level security is covered by
`replica/schema.test.sql`, not here.

How the cases run: `e2e/*.spec.js`, Playwright, one spec per flow, role and label selectors. Every test fails on a console
error or a 5xx (the known `LOGO_PLACEHOLDER` 404 is ignored). Case IDs are in the test titles.

Legend. auto: `e2e` runs in the suite. `manual` needs a person or a real service. `n/a` does not apply. result: pass, fail (BUG id),
`xfail` (a known bug, the test is kept and expected to fail until it is fixed).

## F01 Find a hike near me

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F01-H1 | happy | open the planner, read the list, select a route, open its route page, press Back | 21 routes, one selected card, the route page opens, Back returns to Discover with the list intact | e2e | pass (desktop, phone) |
| F01-H2 | happy | set sport, theme, difficulty and longest route | counts match the data, the URL carries every filter | e2e | pass (desktop, phone) |
| F01-H3 | happy | reload a filtered URL | the same filters and results come back | e2e | pass (desktop, phone) |
| F01-H4 | happy | Use my location, with permission | results sorted nearest first, each card says how far away | e2e | pass |
| F01-E1 | edge: empty input | press Enter in an empty place field after a place was set | back to all of India | e2e | pass |
| F01-E2 | edge: very long input | type 5,000 characters in the place field and press Enter | the input is capped, the request stays short | e2e | pass |
| F01-E3 | edge: emoji and accents | search "Pondichéry 🏔️" | shown intact, survives a reload through the URL | e2e | pass |
| F01-E4 | edge: markup in text | put `<img onerror>` in the place field and in the `q` URL parameter | shown as text, nothing runs | e2e | pass |
| F01-E5 | edge: two tabs | two tabs with different filters | neither affects the other | e2e | pass |
| F01-E6 | edge: double submit | press Enter twice in a row on a slow geocoder | one geocoder request (the policy is 1 per second) | e2e | pass |
| F01-E7 | edge: rapid toggling | toggle three chips quickly | the final state, and only that, is shown | e2e | pass (desktop, phone) |
| F01-E8 | edge: back button mid-flow | filter, go to another page, press the browser's Back | Discover with the same filters | e2e | pass |
| F01-E9 | edge: refresh mid-flow | filter, select a card, refresh | filters kept | e2e | pass |
| F01-E10 | edge: slow search | a slow search is overtaken by a fast one | the newer result stays | e2e | pass |
| F01-E11 | edge: offline | load once with the service worker, go offline, reload | Discover still lists the routes | e2e | pass |
| F01-E12 | edge: mobile width | 390px and 320px | no horizontal scroll, every control reachable | e2e | pass |
| F01-E13 | edge: keyboard only | do the whole flow with the keyboard | every control reachable in order, visible focus, focus never drops to the page | e2e | pass (desktop, phone) |
| F01-E14 | edge: screen reader labels | axe on every state; the status line is a live region | no violations | e2e | pass (desktop, phone) |
| F01-E15 | edge: tampered URL | bad `lat`, `lng`, `r`, `max`, `sport`, `theme`, `diff` | sensible defaults, no errors | e2e | pass |
| F01-E16 | edge: window resize | cross the 900px breakpoint both ways | the layout follows, nothing lost | e2e | pass |
| F01-E17 | edge: selection removed | select a card, then filter it out | no stale highlight | e2e | pass (desktop, phone) |
| F01-E18 | edge: map and list agree | click a marker | its card is selected and scrolled into view | e2e | pass (desktop, phone) |
| F01-E19 | edge: sheet drag | drag the results sheet handle with the mouse on a phone | the sheet grows and shrinks, within its limits | e2e | pass |
| F01-E20 | edge: focus after an action | press Clear filters or Try again from the keyboard | focus stays inside Discover on a control that exists | e2e | pass (desktop, phone) |
| F01-E21 | edge: slow geocoder | the geocoder takes 1.5 s | a visible sign that the search is running | e2e | pass |
| F01-E22 | edge: landscape phone | 844x390 | no overflow, the sheet fits its space, the map and results have room | e2e | pass |
| F01-N1 | negative: location denied | Use my location without permission | a message that says what to do | e2e | pass |
| F01-N2 | negative: geocoder down | the geocoder answers 500 | a message, no crash | e2e | pass |
| F01-N3 | negative: place not found | search for nonsense | a message, the old results stay | e2e | pass |
| F01-N4 | negative: data fails | the seed answers 500 | an alert with Try again, and Try again works | e2e | pass (desktop, phone) |
| F01-N5 | negative: map library missing | Leaflet fails to load | the list works and says the map is missing | e2e | pass |
| F01-N6 | negative: nothing matches | a filter combination with no routes | an empty state with the reason and a way out | e2e | pass (desktop, phone) |
| F01-N7 | negative: deleted record | the selected route is no longer in the results | selection clears | e2e | pass (covered by F01-E17) |

## F02 Search somewhere else

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F02-H1 | happy | search Chennai, then Mysuru | results and map follow each place | e2e | pass |
| F02-H2 | happy | change the distance from the place | the result set changes with it | e2e | pass |
| F02-E1 | edge: same place twice | search the same place again | nothing breaks, same results | e2e | pass |
| F02-E2 | edge: error then success | a not-found message, then a valid place | the message goes away | e2e | pass |
| F02-E3 | edge: far from any route | a place with nothing within 200 km | an empty state naming the distance | e2e | pass |
| F02-E4 | edge: near a pole | `lat=89&lng=0&r=200` | no crash | e2e | pass |
| F02-E5 | edge: radius extremes | 5 km and 200 km | both work | e2e | pass |
| F02-E6 | edge: accents and case | "chennai", "CHENNAI", "Chennai " | the same place | e2e | pass |
| F02-N1 | negative: geocoder returns nonsense | coordinates that are not numbers | treated as not found | e2e | pass |

## F06 Plan a route and take it with me (Plan mode, existing)

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| F06-H1 | happy | add two waypoints on the map, Export GPX | a `.gpx` download with both waypoints and a track | e2e | pass |
| F06-E1 | edge: too few points | export with none or one | a clear message, no file | e2e | pass |
| F06-E2 | edge: clear and redo | add, clear, add again | the list resets | e2e | pass |
| F06-E3 | edge: mobile width | open Plan mode at 390px | the map and the waypoint panel are both usable | e2e | pass |
| F06-E4 | edge: follow the on-screen instruction | the empty list says "click the map to begin": click the map | a waypoint is added | e2e | xfail BUG-006 |
| F06-N1 | negative: search in Plan mode | type a city in the planner bar and press Enter | the map moves there | e2e | xfail BUG-007 |

## Cross-cutting

| case | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- |
| X-1 | smoke | open every page of the site | no console error, no 5xx | e2e | pass |
| X-1b | smoke | call showRoutePage with an id that does not exist | no exception | e2e | pass |
| X-2 | regression | home page difficulty pills | unchanged colours | e2e | pass |
| X-3 | manual | real phone, real tiles, real Nominatim, Safari and Firefox, a screen reader | works | manual | not run |
| X-4 | manual | drag the sheet with a finger | smooth, no scroll fight with the page | manual | not run |
| X-5 | n/a | paging, Highlights, tour detail page | not built | n/a | |

