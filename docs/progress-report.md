# NAARAD responsive rebuild: progress report

Date: 2026-10-13 · Branch: `claude/trusting-ritchie-i9vvsi`

Supersedes the earlier report on this branch. Measurements below come from a local Chromium run against the static server in `e2e`, not from field data.

## 1. Where we are

The vertical slice in section 10 of the plan is **complete, and the pages beyond it are built**: home, explore, route detail, story, Creator Studio and My Journey all exist in distinct desktop and phone compositions, driven by one route model and one map.

Against the 18-week plan we are through weeks 1–10 and most of 11–13, with offline bundles (14–15) and field testing (16–17) still open.

## 2. Status against the plan

| Plan item | Status | Where |
|---|---|---|
| One domain, one app, shared design system | Done | `app/base.css` tokens; views load their own stylesheet |
| Distinct desktop / phone compositions | Done | Phone route page leads with the map, raises a sheet, fixes the walk actions |
| Breakpoints | Done at 1240 / 1023 / 639 px | Plan suggested 640/1024/1440; chosen where the content needed the space |
| Homepage per reference | Done | Hero, 4 featured routes, voices band, language band, magazine strip |
| Route detail per reference | Done | Header, 8-cell facts, tabs, map, stop story, stop rail, elevation |
| Story page per reference | Done | On-this-page rail, pull quotes, credited figures, route and related rails |
| Creator Studio per reference | Done as far as the client can go | 5-step builder, drafts in-browser; publishing needs the backend |
| My Journey per reference | Done, local-first | Saved routes, walks, journal, badges from this device |
| Numbered story nodes | Done | 8 real Hampi stops, on the map, the rail, the profile and the previews |
| Elevation / terrain profile | Done, real data | NASA SRTM 30 m, ~90 m spacing, +153 m on Hampi |
| Route geometry | Done | Editorial connecting lines (labelled) + 8 real recorded Chennai tracks |
| Static route previews | Done | SVG from the route's own geometry, with numbered stops; no map instance |
| Map loaded only where needed | Done | Leaflet imported by the route page only; verified by a test |
| Audio guides, persistent player | Partial | Player survives navigation; device read-aloud until recordings exist |
| Image pipeline (AVIF/WebP, widths, crops) | Done | 29 photos, 4 widths per role, AVIF + WebP |
| Attribution per image | Done | `content/photo-sources.json`; credit shown on the page |
| Rendering: pre-render / SSR | **Not done** | Still client-rendered; hero markup is inline for LCP |
| Offline route bundles | **Partial, behind a flag (off by default)** | `app/offline-bundles.js`. Keeps a route's page, text, code, data and phone-width photos on the device, and opens it with no network. No map tiles (OpenStreetMap forbids bulk prefetch) and no audio (none recorded). Built under the founder's logged override D-0004, without ledger evidence. |
| Accounts | **Not done** | My Journey and Studio are device-local by design for now |

## 3. Measurements

| | Home | Route detail |
|---|---|---|
| LCP (local) | 208 ms | 248 ms |
| CLS | 0.0014 | 0.0014 |
| JS transferred (uncompressed) | 75 KB | 249 KB (includes Leaflet) |
| CSS | 47 KB | 69 KB |
| Fonts | 142 KB | 142 KB |

Plan budgets: homepage JS under 150 KB compressed — met with room to spare (75 KB before compression). No map library on the homepage — verified by test. Fonts subset by coverage: 578 KB → 142 KB.

These are lab numbers on a fast local server. Field Core Web Vitals at the 75th percentile are still to be collected.

## 4. Data honesty

Nothing fills a gap with a plausible-looking number:

- Editorial route lines are interpolated between real stop coordinates and **recorded and labelled as connecting lines**, not surveys. The Chennai tracks are real recordings and marked as such.
- Elevation is sampled from NASA SRTM 30 m. A route with no samples shows an empty state.
- All 29 photographs are CC0, Public Domain Mark, CC BY or CC BY-SA, with author and licence per file. The previously unverified inherited imagery is no longer used.
- No creator narration exists, so the player reads the published text with the device's own speech synthesis and says so on the bar.
- Publishing, transcription, translation, offline bundles and accounts state that they need the backend.

## 5. Tests

20 Playwright checks in `e2e/site.spec.js`, all passing: homepage facts and lazy-loading, no map engine on home, licence display, route facts and stops, one map instance with 8 markers, stop selection and URL, honest empty state for a route without stops, save-to-journey, story structure and credits, catalogue filtering, studio wizard and draft, journal entry, phone map-first order, no horizontal overflow on six pages, 44px touch targets, history, one `h1` per page, and alt text.

## 6. What is left, in order

1. **Offline route bundles** (plan §7, weeks 14–15): versioned bundles of tiles, audio and transcripts, with explicit download. The interface already has the slot and says it is unavailable.
2. **Creator backend**: audio storage, transcription, translation and review. The Studio's draft shape matches what a submission endpoint would take.
3. **Pre-rendering** (plan §7): the plan asks for server-rendered or pre-rendered home, destination and story pages. A small pre-render step over the existing views would fit the current structure.
4. **Field performance** (weeks 16–17): real-device testing on low-end Android and iOS Safari, on poor networks.
5. **Accounts**, so My Journey follows a person between devices.
6. **More routes and stories**: the engine is ready; this is now content work.
