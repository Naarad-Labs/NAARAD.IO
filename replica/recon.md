# Recon map: Komoot (Android app)

Scope: **the whole Komoot Android app as it is on Google Play**, mapped now and built in phases (see "Phases" at the
end). This replaces the 2026-10-04 map, which covered only Discover on the web. Screen IDs S01 to S08 and flow IDs
F01 to F06 keep their meaning, so `architecture.md`, `parity.md`, `bugs.md` and the build log still point at the right
things. Everything from S09 and F07 on is new.
For: Naarad (this repo), a platform for heritage and nature routes. The clone ships as an **Android app built from
Naarad's web code with Capacitor** (the user's choice, 2026-10-20), under Naarad's own brand.
Evidence: **public sources only** (the user's choice, 2026-10-20). No account was used, nothing was decompiled.
Date: 2026-10-20

## How this map was made, and what it is not

- **The APK was declined.** The user offered the 180 MB APK. The pack does not allow decompiling an app, unpacking its
  resources counts as decompiling, and Komoot's terms (§12, below) don't allow it either. Nothing in this file comes
  from the app's binary, code or network traffic.
- **First-hand for the app** means one of three things: the 17 screenshots on the Play listing (Komoot's own marketing
  images, some of them older tablet screens), the user's 7 Android screenshots from 2026-10-04 (`screens-notes.md`),
  or the app screens in the user's pitch deck. Nothing was driven or clicked in a real app this time.
- **Komoot's help centre could not be read.** `support.komoot.com` returns a Cloudflare bot check (HTTP 403,
  `cf-mitigated: challenge`) to anything that is not a browser. The pack forbids getting past that by any trick, so
  help articles appear here only as search-engine summaries, marked **summary**.
- **Empty, error and permission states are mostly not seen.** Store screenshots show filled, happy states only. Where
  a state is listed under "needs", it has to be designed from scratch or confirmed by someone with the app.

## Sources

Status: **read** = the page was fetched and read. **image** = a screenshot was viewed. **first-hand** = the user's own
screenshots. **summary** = only a search-engine summary was read. **blocked** = refused (named why).

| # | source | URL | status | notes |
| --- | --- | --- | --- | --- |
| 1 | Google Play listing | https://play.google.com/store/apps/details?id=de.komoot.android | read | Pitch, feature list, 4.45 from 438,562 ratings, updated 2026-10-15, data safety, three reviews |
| 2 | Play screenshots, phone (1 to 8) | same page | image | Saved as `replica/screens/play-01.jpg` to `play-08.jpg` (not committed). Current design |
| 3 | Play screenshots, tablet (9 to 12) | same page | image | `play-09` to `play-12`. **Older design** (green buttons, a Premium tab). Layout hints only |
| 4 | Play screenshots, Wear OS (13 to 17) | same page | image | `play-13` to `play-17`. Watch app, out of scope |
| 5 | User's Android screenshots | `replica/screens-notes.md` | first-hand | 7 screens from 2026-10-04: Routes map and list, Home, Profile, Record paused |
| 6 | User's pitch deck, slides 4 and 12 | `replica/screens-notes.md` | first-hand | Tour detail and "Search this area", cropped |
| 7 | Features page | https://www.komoot.com/features | read | Discover, Plan, Navigate, Share, Contribute, Record. "8M+ routes, 850M+ photos and Highlights" |
| 8 | What's New (changelog) | https://www.komoot.com/whats-new | read | Posts from 2026-06-09 to 2026-10-01 (first page only) |
| 9 | Product Updates | https://www.komoot.com/product-updates | blocked | The page is empty until their JavaScript runs. Reading it would mean running their bundle, so not read |
| 10 | Premium page | https://www.komoot.com/premium | read | The eight Premium features. No price in the page |
| 11 | Shop | https://www.komoot.com/shop | read | Single Region: Free. World Pack: $29.99. Premium: free trial (price loads by script, not seen) |
| 12 | Event Live Tracking | https://www.komoot.com/live-tracking | read | Organiser dashboard, join link, spectator link. In beta |
| 13 | Public tour page | https://www.komoot.com/smarttour/e1102715460/fairyland-loop-trail | read | The web version of S04: every section of a tour, the difficulty scale |
| 14 | Public Highlight page | https://www.komoot.com/highlight/5029615 | read | The web version of S05 |
| 15 | Terms of Service | https://www.komoot.com/terms-of-service | read | English translation. The German version is binding |
| 16 | Newsroom: the 2025 redesign | https://newsroom.komoot.com/254252-komoot-unveils-modern-design-as-part-of-ambitious-product-roadmap/ | read | 2025-09-15. New look; "core navigation and workflows remain the same" |
| 17 | Help centre | https://support.komoot.com/hc/en-us | blocked | Cloudflare bot check |
| 18 | Help: plans, Maps and Premium | https://support.komoot.com/hc/articles/10163258809626 | summary | One free region; regions and World Pack are lifetime purchases; Premium includes the World Pack |
| 19 | Help: download routes and maps for offline use | https://support.komoot.com/hc/articles/10356476920986 | summary | |
| 20 | Help: privacy | https://support.komoot.com/hc/articles/10197721520794 | summary | Public or private profile, close friends, visibility per tour, privacy zones (web only), hidden from search |
| 21 | Help: off-grid navigation | https://support.komoot.com/hc/articles/360024733651 | summary | Voice stops on off-grid segments, a compass shows the way, off-route warnings continue |
| 22 | Press: pricing change | https://www.bikeradar.com/news/new-komoot-users-send-to-devices | summary | Since 2025-02-27 new users need Premium to send routes to devices. Premium $4.99 a month or $59.99 a year |
| 23 | Multi-day planner | https://www.komoot.com/premium/multiday-planner | summary | Stages by daily moving time, places to stay, reverse direction |
| 24 | Onboarding teardown (third party) | https://screensdesign.com/showcase/komoot-hike-bike-run | summary | 7 steps: email sign-up, profile, location, notification and health permissions. Unverified |
| 25 | Recording how-to (German) | https://www.netzwelt.de/anleitung/241214-komoot-so-fahrradtouren-aufzeichnen.html | summary | Record button, pick a sport, start, stop, save, name, share |
| 26 | road.cc review | https://road.cc/content/review/258817-komoot-app | summary | Voice guidance: road names and numbers, roundabout exits |
| 27 | Sources 2 to 11 of the 2026-10-04 recon | in this file's git history (`git show f055a35:replica/recon.md`) | summary | Help and press summaries behind S02, S05, S06, S08 |

Not read: YouTube walkthroughs (a video can't be watched here, and no transcript was read); the App Store listing (the
target is Android); the public API docs (`static.komoot.de/doc/external-api/...`, not tried this time); the user's
account (by choice).

**Terms check.** §12 of the Terms of Service: "the user may not use content and features in any other way except those
described under package overview and solutions", and must "refrain from any actions which are likely to affect the
functionality of the platform". The English translation has no clause naming competitors, reverse engineering or
decompiling. Decompiling is still not a described use, so the APK stays out. Public pages read at human speed are what
this map rests on. The German text is binding and was not read.

## Core loop

Pick a route (Komoot's or your own, planned for your sport), follow it with turn-by-turn voice navigation that works
offline, and record it as a tour you keep and share. The paid part is the **reach**: one region is free, and offline
maps and navigation everywhere else are Premium (or the $29.99 World Pack).

## The app's shell

- **Bottom navigation, five tabs.** The user's Android screenshots (2026-10-04, current design): **Home, Routes, Record,
  Profile, Offline**. The older tablet screenshots: Home, Routes, Record, Profile, **Premium**. The fifth tab probably
  depends on the version or the plan (guess: Offline for a user who owns maps). Routes is the green active tab.
- **Look (current design).** A warm off-white page, white rounded cards and pills, dark olive primary buttons ("Save"),
  tan secondary buttons ("Navigate"), orange for live and offline state, purple for Premium. Measured colours are in
  `screens-notes.md`. **Not to be copied:** `replica/brand-review.md` already warns that Naarad's orange is close to
  Komoot's.
- **Dark mode** exists since 2026-06-18 (source 8).
- A store review (source 1, 2026-04-21) says the app **intercepts Android's back gesture**. That annoys people, so the
  clone should let back behave normally.

## Screens

Evidence: **play-NN** = Play screenshot (sources 2 to 4). **user** = the user's screenshots (5). **deck** = source 6.
**web** = the public web page (13, 14). **whatsnew** = source 8. **help** / **press** = summaries. **guess** = not
evidenced, from how apps like this usually work. Phase = the build phase it belongs to (see "Phases").

| ID | screen | route / how to reach | purpose | key components | states seen | evidence | phase |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S01 | Routes tab: Discover, map and list | Routes tab | Find ready-made routes near a place and compare them on a map | search pill with "+ Plan New", chips (sport, "within N km", Filters), map pins, results sheet with a count, list of tour cards, floating Map pill | map filled, list filled, offline (orange button). Needs: loading, no results, location denied | user, deck | 1 |
| S02 | Discover filters | Filters chip on S01 | Narrow the results | sport, difficulty, distance, duration, elevation, surface, route type | none seen | help (27) | 1 |
| S03 | Place search | search pill on S01 | Search near current location, an address or a dropped pin | search field, locate-me, pin drop | filled ("Chennai"). Needs: not found, location denied | user, press | 1 |
| S04 | Tour detail | a card in S01, a feed item, a link | Decide whether to do this route | photo carousel with a count ("884"), back, share, more; difficulty badge, rating, people count; title; route type ("One Way") and sport; description; tabs **Map, Tips & Info, Waypoints, Elevation, Weather** (web adds Comments); start point with distance from a town and **Get Directions**; waypoint list (A, numbered Highlights with their km, B); stats (duration, length, elevation gain and loss); way types bar; elevation profile with waypoint markers; bottom bar **Save, Navigate, edit (pencil)**; "Save offline" | filled only | play-02, play-04, deck, web | 1 |
| S05 | Highlight detail | a Highlight on a map or in S04 | Photos, tips and recommendations for one place | breadcrumbs (category > country > region), photos with "add your photos", type ("Highlight • Viewpoint"), sport, recommend percentage and count, tips with author, people who recommended it (Follow / Request to follow) | filled (web) | web, play-11 | 1 |
| S06 | Create or contribute to a Highlight | map long-press or after an activity | Add a place, a tip or photos | pin, name, sport, tip, photos | none seen. Needs an account | help (27) | 4 |
| S07 | Route planner | "+ Plan New" on S01, edit (pencil) on S04 | Build a route from waypoints | map with A, numbered waypoints and B, direction arrows on the line, sport badge, stats (distance, estimated time with an info tip, elevation gain and loss), Save, Navigate, "Adjust route". **Rebuilt on Android 2026-09-03**: Trail View, Street View, route preferences | filled | play-05, play-09, whatsnew | 2 |
| S08 | Import and export | tour menu, planner | GPX, TCX or FIT in, GPX out | file picker, export | none seen | help (27) | 2 |
| S09 | Welcome, sign up, log in | first launch | Get an account | sign-up options (email; others unconfirmed), "Sign up or log in to explore the great outdoors" | none seen | summary (24) | 0 |
| S10 | Onboarding permissions | after sign-up | Ask for location, notifications, health data | permission explainers, then the system dialogs | none seen. Needs: each permission denied | summary (24) | 0 |
| S11 | Home tab | Home tab | Inspiration and friends' activity | segments **Explore / Challenges / Events** (user); feed cards: "Pál went mountain biking", time and place, title, text, photo grid, stats, like, comment, share (play-08, play-12) | filled | user, play-08, play-12 | 4 |
| S12 | Planner: sport and route settings | sport badge on S07 | Set what the route is planned for | sport icon strip (hike, bike, MTB, road bike, run and more), E-bike checkbox, fitness level ("In good shape"), route type (One Way or loop) | filled (old design) | play-09 | 2 |
| S13 | Planner: route summary | scroll the planner sheet, or "Details" | Judge the route before saving | difficulty badge and sentence, technical difficulty and fitness bars, elevation profile with Highlight markers, uphill, downhill, highest and lowest point, average speed, **way types** and **surfaces** as stacked bars with a legend in km | filled (old design) | play-10, play-02 | 2 |
| S14 | Planner: point sheet | tap a Highlight or the map in S07 | Use a place in the route | photo, name, type ("Mountain Biking Highlight"), **Start here**, **Set as end point**, add as waypoint (guess), **Follow ways** checkbox (snap to paths or draw straight) | filled (old design) | play-11 | 2 |
| S15 | Planner: avoid areas and route preferences | planner menu | Skip a road, a path or an area | avoid markers, preference toggles | none seen. Web only for avoid areas (2026-08-31); preferences are on Android | whatsnew | 2 |
| S16 | Navigation | Navigate on S04 or S07 | Follow a route turn by turn | instruction card (turn icon, "100 m", "Via Albertstadt"), "Offline" pill, map with the route and your arrow, round buttons (camera, compass, layers), scale bar, stats panel (distance, elevation gained, average speed, current elevation, duration) that pages and expands | filled, offline | play-03 | 3 |
| S17 | Off-route, detour and climbs | during S16 | Get back on route, go around an obstacle, see climbs ahead | off-route warning, reroute, **detour around a blocked route** (2026-08-31), climb progress (2026-06-09), off-grid compass | none seen | whatsnew, help (21) | 3 |
| S18 | Record tab, idle | Record tab | Start recording without a plan | sport choice, start button, map | none seen | press (25) | 3 |
| S19 | Recording, running and paused | start on S18, or during S16 | Track the activity | live stats, pause and resume, stop, map | **paused** (user) | user | 3 |
| S20 | Save activity | stop on S19 | Keep it as a tour | name, photos, rate the Highlights you passed, visibility, save, discard | none seen | press (25), help (27) | 3 |
| S21 | Activity detail | Profile, a feed card | Look back at a finished tour | like S04 plus: time in motion, average speed, who was with you, likes and comments (translate, report, @mentions), share | filled (feed card) | play-08, play-12 | 4 |
| S22 | Crop activity | menu on S21 | Remove distance recorded after you stopped | handles on the track, recalculated stats. Plus a reminder at unrealistic speed or when you're still recording at the end | none seen (2026-10-01) | whatsnew | 3 |
| S23 | 3D flyover video | share on S21 | Replay a finished route as a satellite video | flyover, animated elevation, stat card, export | none seen (2026-09-30) | whatsnew | 5 |
| S24 | Profile tab | Profile tab | You: sports, followers, stats, tours | name, sports, followers and following, 4 stat tiles, then tours, Collections, Highlights (guess for the last three) | filled | user | 4 |
| S25 | Your tours: planned and completed | Profile | Find a saved route or past activity | list with filters, cards | none seen | guess | 4 |
| S26 | Collections | Profile, "add to collection" | Bundle tours and Highlights with a cover and intro | list, detail with map and tours | none seen. Premium | premium page, summary | 5 |
| S27 | Another person's profile | a name anywhere | See someone's tours, follow them | Follow or Request to follow (private profile), tours, Collections | none seen in the app | web (14), help (20) | 4 |
| S28 | Followers and close friends | Profile | Manage who sees what | followers, following, close friends list, approve requests | none seen | help (20) | 4 |
| S29 | Notifications | bell or Home (guess) | Likes, comments, follows, reminders | list | none seen | guess | 4 |
| S30 | Settings | Profile menu | Account, privacy, units, voice, dark mode | profile public or private, hide from search, default tour visibility, units, navigation voice, appearance, connected devices | none seen | help (20), whatsnew | 4 |
| S31 | Offline tab | Offline tab | What is on the device for no-signal use | downloaded tours and map regions, sizes, delete | none seen (the tab exists: user) | user, play-01, help (19) | 3 |
| S32 | Maps and regions | Offline tab, shop | Pick the free region, unlock the world | region picker on a map, Single Region (free), World Pack ($29.99) | none seen in the app | web (11), help (18) | 5 |
| S33 | Premium upgrade | any Premium feature, the Premium tab | Sell Premium | feature list, free trial, price | none seen in the app | web (10, 11) | 5 |
| S34 | Multi-day planner | planner, Premium | Split a long route into stages | stages by daily moving time, a slider, per-day distance, climb and time, places to stay, reverse direction | none seen | summary (23) | 5 |
| S35 | Weather on route | Weather tab of S04 | See the forecast along the route | weather card (now, high, low, "Cloudy"), start-time picker, forecast limited to the next 46 hours | filled | play-04, web | 5 |
| S36 | Map layers | layers button on S01, S07, S16 | Choose the map | standard, satellite (guess), sport-specific maps, 3D, heatmap, **official topo maps** (Swisstopo, OS, USGS, IGN; 2026-07-17) | none seen | user, premium page, whatsnew | 5 |
| S37 | Events | Home > Events | Find or host a group outing | browse with sport and distance filters, join; turn a planned route into an event (date, meeting point, details) | segment seen, contents not | user, whatsnew | 5 |
| S38 | Challenges | Home > Challenges | Unknown | unknown | segment seen, contents not | user | 5 |
| S39 | Live tracking | while recording, Premium | Share your live position with family and friends | share link, battery, ETA; for events, an organiser dashboard | none seen in the app | web (10, 12) | 5 |
| S40 | Trail View and Street View | planner (2026-07-13) | See the ground before you commit | street-level imagery along the route | none seen | whatsnew | 5 |
| S41 | Connected devices | Settings | Send routes to Garmin, Wahoo, Sigma, Bosch, Hammerhead | connect and disconnect per brand | none seen | play listing | skip |
| S42 | Wear OS app | the watch | Pick a sport, planned tours, record, navigate, finish | sport list, planned tour list with distances, turn prompt, "Tour completed" | filled | play-13 to play-17 | skip |

**42 screens**: 40 on the phone, 2 skipped (partner devices, the watch app).

## Flows

Clicks on the happy path are **not counted** for any flow: no flow was recorded click by click. The number to beat has
to come from someone using the app (see "Needs a first-hand look").

```
F01 Find a route near me                                       (2026-10-04, unchanged)
    S01 -> S02 set filters -> S01 results update -> S04 open a tour
    edge: no results, location permission denied, a tour with no photos

F02 Search somewhere else                                      (unchanged)
    S01 -> S03 address or dropped pin -> S01
    edge: address not found, pin in the sea or outside coverage

F03 Page through results                                       (unchanged; may not apply to the app, which scrolls)

F04 Read about a place on a tour                               (unchanged)
    S01 or S04 -> S05
    edge: a Highlight with no photos or tips

F05 Contribute a Highlight                                     (unchanged)
    S04, S21 or map -> S06 -> S05
    edge: no account, photo upload fails, no signal

F06 Plan a route and take it elsewhere                         (unchanged)
    S07 -> S08 export GPX
    edge: waypoints are not in the export, only the line

F07 First launch to first route
    S09 sign up -> S10 permissions -> S01 (or S32 pick the free region)
    edge: location denied (S01 has no "near me"), sign-up abandoned, already has an account

F08 Plan my own route
    S01 "+ Plan New" -> S07 -> S12 sport and fitness -> tap the map to add waypoints, S14 use a Highlight
      -> S13 check the summary -> Save
    edge: no path between two points (straight-line or off-grid segment), a waypoint in the water,
          the route crosses an area marked to avoid (S15), no signal while planning

F09 Follow a route
    S04 -> Navigate -> S16 -> arrive -> S20 save the activity -> S21
    edge: off route (S17 warning, reroute), blocked path (S17 detour), off-grid segment (voice stops,
          compass), signal lost (needs the tour offline, F12), phone locked or app in the background,
          battery saver kills GPS, GPS permission only "while using"

F10 Record without a plan
    S18 -> start -> S19 pause and resume -> stop -> S20 -> S21
    edge: forgot to stop (S22 reminder, crop), app killed by the system, no GPS fix yet,
          an activity too short to save

F11 Fix an activity                                            (2026-10-01)
    S21 -> S22 crop -> stats recalculated

F12 Take a route offline
    S04 "Save offline" (or S31) -> the tour and its map area download -> F09 works with no signal
    edge: outside your free region (S32 or S33), storage full, download interrupted, maps updated

F13 Share an adventure
    S21 -> share link, or S23 flyover video -> export
    S11 -> like, comment, @mention, translate, report
    edge: tour is private (share asks to change visibility), the viewer is not logged in

F14 Follow someone
    S05, S11 or S21 -> S27 -> Follow (public) or Request to follow (private) -> they approve in S28
    edge: request declined, blocked, profile hidden from search

F15 Organise
    S04 Save -> S26 add to a Collection (Premium) -> share the Collection

F16 Go Premium
    any gated feature (S26, S34, S35, S36, S39) -> S33 -> free trial -> back to the feature
    edge: trial already used, payment fails, cancelled subscription keeps bought regions

F17 Plan a multi-day trip
    S07 -> S34 split into stages -> pick places to stay -> save each stage
    edge: a stage longer than a day's moving time, no place to stay near the end of a stage

F18 Join or host an event                                      (2026-08-31)
    S11 Events -> S37 -> join;   or S25 a planned route -> S37 make it an event -> publish

F19 Check the weather before leaving
    S04 -> S35 -> change the start time
    edge: start more than 46 hours ahead (no forecast)

F20 Share my live position
    S19 -> S39 -> send a link -> it stops when the tour ends
```

**20 flows** (6 carried over, 14 new).

## Components

All from images or page text. Nothing was measured on a device this time except what `screens-notes.md` already has.

| component | variants | states | used on |
| --- | --- | --- | --- |
| Bottom navigation | 5 tabs, the fifth Offline or Premium | active (green), inactive | all tabs |
| Search pill | with "+ Plan New" action | empty ("Map area"), with a place | S01, S03 |
| Chip | dropdown (sport), value ("within 46 km"), action (Filters) | default, open, set | S01, S37 |
| Bottom sheet | collapsed with a count, half, full list | dragging | S01, S14, S16 |
| Tour card | photo with a map inset, or a route-map image | filled; no-photo variant | S01, S25, S27 |
| Difficulty badge | Easy, Moderate (Intermediate), Hard (Expert). **The labels differ between sources:** the web tour page and the user's Android screenshot say Easy / Moderate / Hard, the store screenshots show "Expert" and "Intermediate" | n/a | S01, S04, S13 |
| Rating and people count | star and average; people icon and count ("1,618 hikers" on the web: the count is people who did it) | no rating: count only | S01, S04 |
| Photo carousel | with a total count | single photo, none | S04, S05, S21 |
| Tab bar (in a page) | Map, Tips & Info, Waypoints, Elevation, Weather, Comments | selected | S04, S21 |
| Waypoint row | A (start, with "Parking"), numbered Highlight with km and type, B (end) | n/a | S04, S07 |
| Stat tile and stat grid | 2 x 2 (duration, length, gain, loss); stats panel in navigation | paged (two pages), expanded | S04, S07, S16, S24 |
| Elevation profile | with waypoint markers on top; with Highlight markers | interactive (guess) | S04, S13, S16 (guess) |
| Stacked breakdown bar | way types, surfaces; legend with km per type | n/a | S04, S13 |
| Button | primary dark olive ("Save" with bookmark icon), secondary tan ("Navigate" with arrow), icon (edit, share, more), green (old design: "Start here", "Set as end point") | disabled and loading not seen | everywhere |
| Round map button | locate-me, compass, layers, camera, offline (orange) | active | S01, S07, S16 |
| Turn instruction card | turn icon, distance, street | off-route, off-grid (not seen) | S16 |
| Status pill | "Offline" (orange, crossed cloud) | n/a | S16, S01 |
| Weather card | temperature, high and low, condition | no forecast beyond 46 h | S04, S35 |
| Sport picker | icon strip with a selected circle, E-bike checkbox | selected | S12, S18, S02 |
| Feed card | "Name went hiking", time ago, place, title, text, photo grid, stats row, like, comment, share | liked | S11, S27 |
| Comment | avatar, name, time, text, like, "See Translation", "Report", input with @ | showing original | S04, S21 |
| Difficulty explainer | per sport tabs (Hiking, Bike, MTB, Road, Running), Easy / Moderate / Hard with hours, climb and the SAC scale | n/a | S04 (web) |
| Start-time picker | day and time, Save, Cancel | n/a | S35 |
| Paywall | feature list, free trial button | trial used (not seen) | S33 |
| Region picker | map of regions, free region | owned, not owned | S32 |

## Inferred data model

Komoot calls both a planned route and a recorded activity a **Tour**. The model keeps that: one entity with a `kind`.

```
User          id, display_name, avatar, sports[], fitness_level (untrained .. pro),
              profile_visibility (public | private), searchable (bool), units, created_at
              evidence: S24 (user), S12 fitness level, help 20
              confidence: high for visibility and searchable; medium for the rest

Tour          id, owner_id, kind (planned | recorded), name, sport, e_bike (bool),
              route_type (one_way | loop), visibility (private | close_friends | followers | public),
              geometry (line), distance_m, duration_s (planned estimate or time in motion),
              ascent_m, descent_m, highest_m, lowest_m, avg_speed, difficulty (easy | moderate | hard),
              technical_grade, fitness_grade, description, start_point, cover_photo,
              way_types {type: metres}, surfaces {type: metres},
              recorded_at, cropped_from (for S22), created_at, updated_at
              evidence: S04, S07, S13 (play-02/04/05/10), web tour page, help 20 (visibility
              per tour, private by default)
              confidence: high for the stats and breakdowns, medium for the grades, guess for storage

Waypoint      tour_id, position (A, 1..n, B), kind (start | end | via | highlight),
              highlight_id?, location, label ("Parking"), distance_along_m
              evidence: S04 waypoint list, S07, S14
              confidence: high

TrackPoint    tour_id, t, lat, lng, elevation, speed     (recorded tours only)
              evidence: S19, S22 crop, export (help)
              confidence: medium (fields are a guess, the need is not)

Highlight     id, name, kind (point | segment), category (viewpoint, natural monument, cafe, ...),
              sport, location or geometry, recommend_count, recommend_pct, creator_id
              evidence: S05 (web), play-11, help (27)
              confidence: high

Tip           id, highlight_id, author_id, text, created_at, upvotes
              evidence: web tour page ("Tip by"), Pioneers (listing)
              confidence: high for text and author, medium for upvotes

Photo         id, owner_id, tour_id? highlight_id?, url, taken_at, location
              evidence: carousels on S04, S05, S21; "add your photos" (web)
              confidence: high

Rating        user_id, tour_id or highlight_id, value (stars for tours, recommend yes/no for Highlights)
              evidence: S01 rating, S05 recommend count, S20 rate Highlights
              confidence: medium

Comment       id, tour_id, author_id, text, mentions[], language, created_at
Like          user_id, tour_id
              evidence: play-08, play-12
              confidence: high

Follow        follower_id, followee_id, status (pending | accepted), close_friend (bool)
              evidence: help 20, "Request to follow" (web)
              confidence: high

Collection    id, owner_id, name, intro, cover_photo, visibility, items [tour | highlight]
              evidence: premium page, summary
              confidence: medium

Region        id, name, geometry (polygon), purchasable (bool)
Entitlement   user_id, kind (free_region | region | world_pack | premium), region_id?,
              source (purchase | subscription | trial | event), starts_at, ends_at?
              evidence: shop (11), help 18, press 22
              confidence: medium

OfflinePack   (on the device) tour_id or region_id, bytes, downloaded_at, map_version
              evidence: S31, help 19
              confidence: medium

Event         id, host_id, tour_id, starts_at, meeting_point, details, sport, participants[]
              evidence: whatsnew 2026-08-31
              confidence: medium

LiveSession   id, user_id or event_id, share_token, started_at, ends_at, last_position, battery
              evidence: premium page, live-tracking page
              confidence: medium

Notification  id, user_id, kind (like | comment | follow | request | reminder), subject_id, read_at
              evidence: none (guess)
              confidence: guess
```

Relationships: User 1-n Tour; Tour 1-n Waypoint; Tour 1-n TrackPoint (recorded only); Tour n-n Highlight (through
Waypoint, and the Highlights a recorded tour passed); Highlight 1-n Tip, 1-n Photo; Tour 1-n Photo, Comment, Like;
User n-n User through Follow; User 1-n Collection, Collection n-n Tour and Highlight; User 1-n Entitlement;
Event 1-1 Tour, n-n User.

### What Naarad has today, for the architect

The 2026-10-13 rebuild replaced the site, and with it the 2026-10-04 Discover build that `features.csv` used to score.

- **Routes.** `content/routes.json` has **3** routes with real geometry, stops, elevation, `sport`, `routeType`,
  `surface`, `difficulty`, `ascentM`, `descentM`. `discover/seed-tours.json` has **21** inherited catalogue rows.
- **Map.** Leaflet with OpenStreetMap's standard tiles and Esri World Imagery (`app/map.js`). **Neither may be
  bulk-downloaded for offline use** (OSM's tile usage policy forbids it, Esri's terms restrict it). F12 needs a tile
  source that allows offline packs.
- **Elevation** from NASA SRTM 30 m (README). Close to what S04 and S13 need.
- **Audio.** The listening bar reads stop text with the device's speech synthesis. That is the seed of S16's voice.
- **My Journey** (`app/journey-store.js`) keeps saved routes, finished walks, a journal, downloads and badges in
  `localStorage`. It is the clone's S24 and S25 without an account behind it.
- **No accounts, no backend, no routing engine.** S09, S11, S21 social parts, S27 and S28 all need a backend.
  `replica/schema.sql` (Supabase and PostGIS, written for Discover) is a start.

## Feature matrix

See `features.csv`: **123 rows**. Must 26, should 44, could 45, skip 8 (the first three leave out the skip rows). Two
rows are Naarad's own extras (`original` = no), which the score leaves out, so it counts 113.

- **41 rows from the Discover recon are kept with the same wording.** Their `clone` column is reset to `no`, because the
  build it described was replaced on 2026-10-13. Each note says what it was. `/replica-diff` should re-check them
  against the current site.
- **Two old rows are gone**, because they were `skip` only for being outside the Discover slice: "Turn-by-turn
  navigation and activity recording" and "3D maps, live tracking, weather on route". Each is now split into separate
  rows that are in scope.
- **82 rows are new**, all at `no`.

## Out of scope (cannot or should not be cloned)

- **Komoot's content and community**: 8 million routes, 850 million photos and Highlights, tips, ratings, users. That
  is the network, not a feature. Naarad's routes come from Naarad's creators.
- **Heatmaps and personalised ranking**: built from their users' recorded activity.
- **Device partners**: Garmin, Wahoo, Sigma, Bosch, Hammerhead, the Komoot map on Garmin. Partner deals.
- **The Wear OS app**: a separate platform. Could come later.
- **Official topographic maps** (Swisstopo, Ordnance Survey, USGS, IGN): licensed per country.
- **Their prices and plans.** Naarad sets its own (`data/pricing.json`). For reference: one free region, World Pack
  $29.99, Premium $4.99 a month or $59.99 a year (press, 2025; the shop loads the price by script).
- **Their look, name, icons, illustrations and copy.** Rebuild the patterns in Naarad's brand (`/replica-brand`).

## Needs a first-hand look

The user chose public sources only. These are the gaps that choice leaves; each is fine to design from scratch, but
it will be Naarad's design, not a match:

1. **Click counts** for F01, F08, F09, F10. No flow was walked.
2. **Every empty, error and permission state**: no results, no GPS, location denied, storage full, offline outside your
   region, trial used.
3. **Record (S18 to S20)**: only one paused screenshot. The save screen is not seen at all.
4. **Navigation edge states (S17)**: off-route, reroute, detour, off-grid. Only the happy screen is seen.
5. **Profile and social (S24 to S30)**: one Profile screenshot; settings, notifications and follower management unseen.
6. **Home's Challenges segment (S38)**: what it is.
7. **Which difficulty labels the current Android app uses** (Moderate or Intermediate, Hard or Expert).
8. **Why the fifth tab differs** (Offline or Premium).
9. **The help centre** would answer most of 2 to 5. It needs a real browser: the user can open
   `support.komoot.com` and paste or screenshot articles, which counts as public reading.

## Size

Screens 42 (40 to build), flows 20, entities 18.

Hard parts, hardest first:

1. **Navigation and recording in the background.** Android stops a web page's GPS when the screen is off. The
   Capacitor app needs a foreground service with a background-location plugin, voice prompts through native
   text-to-speech, off-route detection, rerouting and the detour, and must survive battery savers.
2. **A routing engine that knows the sport.** S07 to S15 need routes that snap to paths by sport, report way types
   and surfaces, estimate time from fitness, and avoid areas. That means running a router on OpenStreetMap data
   (GraphHopper, Valhalla or BRouter); Naarad has none.
3. **Offline maps.** Region packs of vector tiles from a source whose licence allows offline use, downloads on the
   device, storage management, map updates. Today's tiles can't be used this way.
4. Accounts, sync between devices and the social graph: Naarad has no backend.
5. Content: a few dozen routes against eight million. Not code, and the slowest part.

Size: **XL** for the whole app, which by the pack's rule means rescope. The phases below are that rescope.

## Phases

Each phase is a separate project with its own architect, build, test and diff pass. Sizes are for one phase.

| phase | what | screens | size | why this order |
| --- | --- | --- | --- | --- |
| 0 | Android shell: Capacitor build of the site, five-tab navigation, accounts and sync | S09, S10 | M | everything else needs an app and a user |
| 1 | Discover and tour detail: finish the started slice | S01 to S05 | M | half-built already (2026-10-04), and it's the front door |
| 2 | Route planner | S07, S08, S12 to S15 | L | needs the routing engine (hard part 2) |
| 3 | Navigate, record, offline: **the core loop** | S16 to S20, S22, S31 | L | needs background GPS and offline tiles (hard parts 1 and 3) |
| 4 | Profile and social | S06, S11, S21, S24, S25, S27 to S30 | M to L | needs recorded tours from phase 3 to have anything to share |
| 5 | Premium-style extras | S23, S26, S32 to S40 | L | each is optional; pick by what Naarad will charge for |

Next step: `/replica-architect` for **phase 0 and phase 1** together, since phase 1 is already half built.
