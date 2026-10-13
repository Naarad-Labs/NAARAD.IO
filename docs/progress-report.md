# NAARAD responsive rebuild: progress report

Date: 2026-10-13 · Branch: `claude/trusting-ritchie-i9vvsi` · Basis: static review of the repository at commit `23adca4`.
Not done for this report: the Playwright suite was not run, and nothing was measured in a browser. Sizes below are file sizes from disk, and compressed sizes come from `gzip -9`.

## 1. Where we are

The vertical slice from section 10 of the plan is mostly built: **homepage, catalogue, and a route-detail page with an interactive map, in separate desktop and mobile compositions.** Commit `23adca4` ("Rebuild Naarad as responsive heritage atlas") replaced the old 4,900-line monolithic `index.html` with a 11 KB shell plus `app/` modules.

In plan terms we are roughly at **weeks 5–10 of 18, partial**. Home, Explore and Route detail exist. The audio, creator, offline and field-testing phases have not started. Several features are present as honest "not published yet" empty states, because the route data does not contain the underlying records.

## 2. Status against the plan

| Plan item | Status | Evidence |
|---|---|---|
| One domain, one app, shared design system | Done | Single `index.html` + `app/`; Playfair Display and DM Sans self-hosted (OFL); tokens in `app/styles.css` |
| Distinct desktop / mobile compositions | Done for route detail, home and catalogue | `@media` at 1450, 1120, 800/760, 430 px. Desktop: sidebar + map + lower cards. Mobile: map-first with expandable bottom sheet |
| Breakpoints per plan (640 / 1024 / 1440) | **Differs** | Built at 800 / 1120 / 1450 px. No distinct tablet (640–1023) composition; it just reflows |
| Homepage hero: priority load, responsive | Done | `fetchpriority="high"`, `srcset` 800w / 1600w WebP (130 KB / 470 KB) |
| Below-the-fold images lazy-loaded | Done | `loading="lazy" decoding="async"` on cards and stories |
| Map engine loaded only when needed | Done | `import('./map.js')` on route open; Leaflet is vendored and not in the home path |
| Single route engine, shared by both layouts | Done | One `#map`, one route state; no duplicate map mounted |
| Explore / discovery | Partial | Searchable catalogue of 21 routes. No filter sheet, no pagination, no map preview |
| Magazine feel via transitions | Partial | Editorial typography and layouts exist. No chapter slide/reveal transitions |
| Numbered story nodes | **Not populated** | Marker code exists in `app/map.js`, but no route has story stops |
| Elevation / terrain profile | **Not populated** | UI card and metrics exist; no sampled elevation data, so it shows an empty state. 12 of 21 routes have total ascent only |
| Route geometry on map | Partial | Routes with published GeoJSON draw a line. In `discover/seed-tours.json`, 0 of 21 records carry a `path`; the line comes from `routes/*.geojson` and the Hampi route has none (start point only) |
| Static route-map previews | Not started | No generated preview images |
| Audio guides and persistent player | Not started | Buttons are disabled with "Audio is not available" |
| Story pages (magazine spread) | Placeholder | One "Listen closer." page with a single feature |
| Creator Studio (desktop editor, mobile wizard) | Not started in new app | Old `creator/` module is still in the repo and no longer wired to the new shell |
| My Journey | Not started | |
| Offline route bundles | Not started, and **regressed** | See risk 1 |
| Server rendering / pre-rendering | Not started | Client-rendered static site on GitHub Pages; each view is a query-string URL |
| Image pipeline (AVIF, 7 widths, crops) | Minimal | Only the hero has two WebP widths. No AVIF, no `<picture>` art direction |
| Attribution / licence per image | Started | `app/media.js` carries a rights record per image; inherited images are labelled **unverified** |
| Performance budgets | Looks promising, unmeasured | Home JS (gzip): `main.js` 6.7 KB + `data.js` 2.3 KB + `map.js` 4.5 KB lazy. Leaflet 42 KB gzip, loaded only with a route. CSS ~11 KB gzip |
| Real-device and Core Web Vitals testing | Not started | No field or lab numbers yet |

## 3. Tests

`e2e/revamp.spec.js` has Playwright cases covering route detail with honest empty states, catalogue search opening a mapped route, the mobile sheet with no horizontal overflow, home and Stories navigation, mobile nav with deep links and history, and map place search. These were not run for this report.

The older Discover tests remain in `e2e/` as an archive. The `replica/` folder holds the earlier Komoot-Discover clone work (parity 45.2/100, "not shippable") and is now largely superseded by this rebuild.

## 4. Risks and gaps, in priority order

1. **Offline is broken by the rebuild.** `sw.js` (cache `naarad-v8`) still pre-caches the old `discover/*` and `creator/*` files and does **not** list `/app/*`, the fonts, Leaflet or the hero images. It also caches via `unpkg.com` and Google Fonts, which the new app no longer uses. Needs a rewrite and a version bump.
2. **Content is the bottleneck, not code.** No story stops, audio, elevation samples, or covers in the seed data, so the headline features of the plan (numbered nodes, terrain profile, audio) cannot be demonstrated yet. A real data/CMS source is needed.
3. **Image rights are unverified** for inherited photos. The plan requires genuine, licensed photographs. Confirm or replace before wider syndication.
4. **Repo weight.** `Images/Hero.webp` is 3.5 MB and `video_b64.txt` is 2.6 MB in the repo root. Neither is used by the new shell; candidates for removal.
5. **SEO regression risk.** The sitemap lists only query-string views, and content is rendered client-side. The plan calls for pre-rendered pages, and clean URLs would help sharing and indexing.
6. **Breakpoint and tablet mismatch** with the plan (800 vs 640/1024). Decide whether to adopt the plan's values.
7. **Route detail shows only the Hampi start point**: 8.4 km, no line. The default landing view is therefore the weakest route in terms of data.

## 5. Recommended next steps

1. Fix `sw.js` for the new asset set and bump the cache version (small, high value).
2. Run `cd e2e && npm install && npm test`, then run Lighthouse on home and a route at mobile settings to get real LCP/CLS/INP baselines.
3. Choose one flagship route (ideally Hampi) and fill in a GPX/GeoJSON line, 5–8 ordered story stops, and sampled elevation, to complete the section-10 slice.
4. Add the image pipeline: AVIF + WebP, 3–4 widths for cards and stories, and `<picture>` mobile/desktop crops for the hero.
5. Generate static route-preview images for cards.
6. Remove unused heavyweight files and decide the fate of `replica/`, `discover/` and the old `creator/`.
7. Then begin the audio player, story spreads, and the Creator Studio wizard.
