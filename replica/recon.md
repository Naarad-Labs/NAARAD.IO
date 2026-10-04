# Recon map: Komoot Discover (web)

> **DRAFT. Built from search-result summaries only.** Every komoot.com host
> (`www`, `support`, `newsroom`, `static.komoot.de`) and `apps.apple.com` was
> blocked by this environment's network policy on 2026-10-04, so **no page was
> actually read or seen**. Nothing below is a first-hand observation of the UI.
> Each row says where it came from and how sure it is. The "Needs a first-hand
> look" section lists what to confirm before `/replica-design` or
> `/replica-build` rely on this.

Scope: Discover on the web: find hike tours near a place, filter them, compare
them on a map, open one. Plus the pieces that feed it (Highlights, GPX
import/export). Not the navigation, recording or watch apps.
For: Naarad (this repo), a heritage and nature route platform. It already has
a basic Discover view (`index.html`, `#pmode-discover`).
Date: 2026-10-04

The scope and audience above are proposed defaults from the URL given and the
repo. They are not confirmed with the user.

## Sources

Status: **summary** = read only as a search-engine summary. **blocked** = fetch
attempted and refused by the network policy. **memory** = URL not from a search
result, so it may be wrong.

| # | source | URL | status | notes |
| --- | --- | --- | --- | --- |
| 1 | Discover page, as given by the user | https://www.komoot.com/discover/Current_location/@12.9826190,80.2383070/tours?sport=hike&map=true&max_distance=30000&pageNumber=1 | blocked | The URL itself is evidence of the search-state model (see S01) |
| 2 | Help: find route suggestions | https://support.komoot.com/hc/en-us/articles/4402815332250-Discover-Find-Tour-suggestions | summary + blocked | Filters and their ranges |
| 3 | Newsroom: new Discover and map interface | https://newsroom.komoot.com/226177-komoot-launches-new-discover-features-finding-personalised-tours-is-easier-than-ever | summary + blocked | Location choice, map behaviour. Launch-era numbers, undated here |
| 4 | Press: Cycling Weekly | https://www.cyclingweekly.com/products/komoot-launches-new-discover-features-to-make-finding-new-routes-easy | summary | Filters, loop vs out-and-back |
| 5 | Press: BikeRadar | https://www.bikeradar.com/news/komoot-tour-discover | summary | |
| 6 | Help: Highlights | https://support.komoot.com/hc/en-us/articles/10194639751450-Highlights | summary | |
| 7 | Help: create and contribute to Highlights | https://support.komoot.com/hc/en-us/articles/10364710659994-Create-and-contribute-to-Highlights | summary | |
| 8 | Help: plans, Maps and Premium | https://support.komoot.com/hc/en-us/articles/10163258809626-komoot-plans-Maps-and-Premium | summary | Prices below are from the summary, unverified |
| 9 | Help: plan routes on the website | https://support.komoot.com/hc/en-us/articles/10194270667034-Plan-routes-on-the-website | summary | |
| 10 | Help: export and import routes | https://support.komoot.com/hc/en-us/articles/10115477099674-Export-and-import-Routes-and-Activities | summary | |
| 11 | Marketing: hiking trail app | https://www.komoot.com/hiking-app/hiking-trail-app | summary | |
| 12 | Terms of use | https://www.komoot.com/terms-of-use | blocked, memory | **Not read. Terms not checked.** |
| 13 | Public API docs | https://static.komoot.de/doc/external-api/v007/index.html | blocked, memory | Unverified that this is the current docs URL |
| 14 | App Store listing | https://apps.apple.com/us/app/komoot-hike-bike-run/id447374873 | blocked, memory | |

Not read at all: Google Play listing, changelog, walkthrough videos, Komoot's
own account.

Terms check: not done (row 12). This recon used public search summaries only,
which is the safe side of the pack's rules. Before anyone drives a Komoot
account for the next pass, read the terms for any clause against building a
competing product.

## Core loop

A walker picks a place, narrows by sport, difficulty, length and elevation, and
compares ready-made tours on one map before choosing one to follow.

The product's paid value (navigation, offline maps, Premium) sits after this
loop and is out of this slice.

## Screens

Evidence column: **url** = visible in the URL the user gave, **help** = a help
article summary, **press** = a press summary, **guess** = not evidenced, from
general knowledge of how such pages work.

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Discover: results list and map | `/discover/{place}/@{lat},{lng}/tours?sport=hike&map=true&max_distance=30000&pageNumber=1` (url) | Show tours near a point, compare them on a map | tour card list, map, filter bar, location field, pagination | none seen. Needs: loading, filled, no results, error, mobile, logged out vs in |
| S02 | Discover filters | opened from S01 (help) | Narrow results | sport, difficulty, distance, duration, elevation, surface, route type | none seen |
| S03 | Location picker | S01 (press) | Choose where to search: current location, an address, or a dropped pin | search field, "use my location", map pin | none seen. Needs: location permission denied |
| S04 | Tour detail | click a card in S01 (guess) | Decide if this tour is for me | map, distance, duration, elevation, difficulty, description | none seen. Not evidenced in any source read |
| S05 | Highlight detail | `/highlight/{id}` (a result URL exists, press/help) | Photos and tips for one place on a route | name, photos, tips, sport | none seen |
| S06 | Create or contribute to a Highlight | map click, then Create Highlight (help) | Add a place, tip, photos | pin, name, sport, tip, photos | none seen. Needs an account |
| S07 | Route planner (web) | "Plan new" (help) | Build a route from waypoints | map, waypoint list, sport selector, surface, POI layer | none seen |
| S08 | Import and export | planner or tour menu (help) | GPX, TCX or FIT in, GPX out | file picker, export button | none seen |

Not in this slice, so no ID: sign in and sign up, plans and checkout (source 8),
multi-day planner, collections, navigation, recording, watch sync.

## Flows

```
F01 Find a hike near me
    S01 (location from the URL or the device) -> S02 set filters -> S01 results update -> S04 open a tour
    happy path clicks: NOT COUNTED. The page was not seen, so any number would be invented.
    From the URL alone: arriving on a pre-filled link needs 0 clicks to see results.
    edge: no results for the filters, location permission denied, filters that
          contradict each other, a tour with no photos

F02 Search somewhere else
    S01 -> S03 pick an address or drop a pin -> S01 results for the new centre
    edge: address not found, pin in the sea or outside coverage

F03 Page through results
    S01 pageNumber=1 -> pageNumber=2
    edge: page past the end, filters changed while on page 3 (does it reset to 1?)

F04 Read about a place on a tour
    S01 or S04 map -> S05 Highlight
    edge: a Highlight with no photos or tips

F05 Contribute a Highlight
    S04 or map -> S06 -> S05
    edge: needs an account, photo upload failure

F06 Plan my own route and take it with me
    S07 add waypoints -> S08 export GPX
    edge: waypoints are not in the exported GPX, only the line (source 10)
```

## Components

All variants and states below are unverified. Rows marked guess are not evidenced.

| component | variants | states | used on |
| --- | --- | --- | --- |
| Map | tour lines coloured by difficulty, direction markers that animate, labelled start points (press) | loading, pan and zoom, selected tour: needs confirming | S01, S04, S07 |
| Tour card | needs confirming (guess: image, title, distance, duration, elevation, difficulty) | needs confirming | S01 |
| Difficulty badge | easy (blue), intermediate (red), expert (black) (help) | n/a | S01, S04 |
| Range slider (two handles) | duration 30 min to 10 h; elevation gain in metres (help) | needs confirming | S02 |
| Distance control | 0 m to 200 km (help). The URL carries `max_distance=30000`, so metres, max only | needs confirming | S02 |
| Segmented or option filter | surface: No preference, Road or paved, Off-road (help); route type: loop, out and back (press) | needs confirming | S02 |
| Sport selector | hike (url); also cycling and running (press) | needs confirming | S01, S07 |
| Location field | current location, address, dropped pin (press) | permission denied, not found: needs confirming | S03 |
| Pagination | `pageNumber` in the URL (url). Control not seen | needs confirming | S01 |
| Highlight marker | point (viewpoint, peak, cafe, park) or segment (scenic single track) (help) | needs confirming | S01, S04, S07 |
| Photo and tip list | needs confirming | empty | S05 |
| Pin drop | needs confirming | needs confirming | S06, S07 |

## Inferred data model

```
SearchQuery  place_label, center_lat, center_lng, sport, max_distance_m,
             duration_min..max, elevation_min..max, difficulty[], surface,
             route_type, page
             evidence: S01 URL (place, centre, sport, max_distance, page: high);
                       help for the other filters (high that they exist, guess on how they are stored)
             confidence: high for the five URL fields, medium for the rest

Tour         id, sport, geometry (ordered points), distance_m, duration_s,
             elevation_up_m, difficulty (easy|intermediate|expert),
             surface (paved|off-road mix), route_type (loop|out_and_back),
             start_point
             evidence: filters in S02, tour lines and start labels on the map (press)
             confidence: medium. Fields are inferred from what can be filtered.
             Name, description and photos are guesses.

Highlight    id, name, sport, kind (point|segment), location or geometry,
             tips[], photos[], ratings
             evidence: help articles 6 and 7
             confidence: high for name, sport, tip, photos; guess for ratings storage

Tip          highlight_id, author, text, photos[]
             evidence: help article 7
             confidence: medium

Region       id, name; user owns one free region plus purchases
             evidence: help article 8
             confidence: medium. Commercial, probably out of this slice.
```

Relationships: Tour passes many Highlights (n-n). Highlight has many Tips and
Photos. SearchQuery returns an ordered set of Tours. The ranking order is
personalised (press) and **unknown**.

### Naarad's current data, for the architect

`routes.json` already has `distance_km`, `duration_min`, `elevation_m`,
`difficulty`, `type`, `lat/lng`, `bbox`, `path`, `waypoints`, `rating`. Gaps
against the list above:

- difficulty is `easy` or `moderate` in the current data. Komoot has three
  levels, so `hard` is missing.
- no loop or out-and-back flag, no surface field, no sport field (`type`
  mixes sport and theme: `heritage-walk`, `cycling`).
- elevation is a single number. Komoot's filter implies elevation gain.
- 6 routes only, plus 14 GPX and GeoJSON files in `routes/` not yet in the
  list. Pagination and ranking only matter once there is volume.

## Feature matrix

See `features.csv`. Must: 7, should: 11, could: 10, skip: 7 (35 rows). Clone column: 0 yes, 6 partial, rest no. Partial means seen in Naarad's code, not run.

## Out of scope (cannot or should not be cloned)

- **Komoot's tour and Highlight database and the photos in it.** Millions of
  community routes (press figures, undated, differ between sources). This is
  the network, not a feature. Naarad's routes come from Naarad's own creators
  and GPX files.
- **Personalised recommendations** that depend on their user data.
- **Heatmaps** (aggregate data they own), **3D maps**, **live tracking**,
  **weather on route**, **Garmin and watch sync** (partner integrations).
- **Turn-by-turn navigation and activity recording**: a separate project.
- **Their pricing.** Naarad has its own model in `data/pricing.json`. For
  reference only, from source 8's summary (unverified, 2026-10-04): one free
  region, Maps as one-time purchases ($3.99 to $29.99), Premium at EUR 59.99 a year.
- **Their map styling, logo, icons, copy and difficulty colour scheme as a
  brand identity.** Difficulty colour coding as a pattern is fine. Use your
  own palette in `/replica-design`.

## Needs a first-hand look

Do these before `/replica-design` and `/replica-build`. Most need only the
screenshots in `replica/screens/` and the user's own browser:

1. **Allow the hosts** so recon can read the real pages:
   `www.komoot.com`, `support.komoot.com`, `newsroom.komoot.com`,
   `static.komoot.de`, `apps.apple.com`, `play.google.com`. Edit the cloud
   environment's Network access (Custom, add these under Allowed domains).
   Then rerun `/replica-recon` and this draft gets verified instead of replaced.
2. Or: the user opens S01 in their own browser and saves screenshots to
   `replica/screens/`: logged out, logged in, the filter panel open, a card
   selected, no results, a narrow phone width. Then this map can be checked
   against what is on screen.
3. Read the **terms of use** (row 12) before using any account.
4. Confirm S04, the tour detail page, exists as guessed, and what is on it.
5. Count the happy-path clicks for F01. The number to beat is unknown.
6. Confirm whether the list reacts to the map (pan to search this area,
   hover or select a card to highlight its line). Nothing read says so.

## Size

Screens 8, flows 6, entities 5 (SearchQuery, Tour, Highlight, Tip, Region).
Hard parts: ranking and relevance without Komoot's data, the route-quality
and content volume problem (6 routes versus millions), geocoding and
reverse-geocoding for the location field, drawing and clustering many tour
lines on a map without lag, difficulty classification from geometry.
Size: **S** to **M** for the Discover slice on top of Naarad's existing view
(a few weeks if S04 and Highlights are included). The content, not the code,
is what takes longer.
