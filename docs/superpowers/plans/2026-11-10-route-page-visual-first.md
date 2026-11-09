# Route page, visual-first: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The route page leads with a photo mosaic, a scrubbable stop-photo timeline and a drawn route line, with no video and no new network dependency.

**Architecture:** Server-rendered additions in `app/views/route.js` (so `scripts/build-site.mjs` prerenders them), a pure `routeDrawPath()` for the SVG line (animated by CSS only), and one input listener in `app/main.js` that reuses the existing `selectStop(order)`. The earlier dead modules `photo-scrubber.js` and `flyover.js` are deleted.

**Tech Stack:** Vanilla ES modules, `node --test`, Playwright e2e (CI), `sw.js` precache.

**Spec:** `docs/superpowers/specs/2026-11-10-route-page-visual-first-design.md`

## Global Constraints

- Offline-first: no video, no new network request; every new `app/*.js` file is listed in `sw.js` SHELL_ASSETS and `VERSION` is bumped (`check-sw-cache`, `tests/sw-content.test.mjs`).
- No invented data: photos, stops and geometry come from the route object; missing data means the element is omitted, never a placeholder.
- `app/views/route.js` must contain no `data-dither` (`tests/markup.test.mjs`). No dither is added in this plan.
- Keep green: `node --test tests/*.test.mjs` (269 now), `scripts/check-html|links|page-meta|sitemap|sw-cache|budget`, e2e sticky-header/anchor tests at 768 px.
- Added JavaScript on the route page ≤ 8 KB gzip. Mosaic and scrubber use fixed aspect ratios (no layout shift).
- Reduced motion: no animation; the line is shown fully drawn.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Never stage `Images/og`, `e2e/results.json`, `e2e/test-results`, `.playwright-mcp/`. Push and PR only with the founder's approval.

## Review Focus

- A route with exactly one photo, with no stops, or with no geometry renders without error and without empty wrappers.
- A route whose first stop has no photo: the scrubber lists only stops that have one and still maps ticks to the right stop order.
- Geometry with one point, or all points equal (zero width or height): the path function returns null, not NaN.
- Geometry crossing the antimeridian is not a case in India; document the equirectangular shortcut in a comment.
- Scrubbing with the keyboard (arrow keys on the range input) changes the stop once per step, and the screen-reader status line (`data-stop-status`) is updated by the existing `selectStop`.
- The hero credit line for the large photo stays visible.

---

### Task 1: Route line (pure path + CSS animation)

**Files:**
- Create: `app/route-draw.js`, `tests/route-visual.test.mjs`
- Modify: `app/views/route.js` (hero), `app/route.css`, `sw.js`

**Interfaces:**
- Produces: `routeDrawPath(coordinates: [lng, lat][], { width = 100, height = 60, pad = 4 } = {}): string | null` in `app/route-draw.js`; `routeLine(route): string` (the `<svg>` markup or `''`) in `route.js`.

- [ ] **Step 1: Write failing tests** in `tests/route-visual.test.mjs` (same fetch/load preamble as `tests/markup.test.mjs`):
  - `routeDrawPath` returns null for `[]`, for one point, and for equal points.
  - For `[[77,12],[78,13]]` it returns a string that starts with `M` and every number lies within `[pad, width-pad]` and `[pad, height-pad]`; north is up (the point with the larger latitude has the smaller y).
  - Aspect ratio is kept: a path for a tall box does not stretch to the wide viewBox (the larger extent fits, the other is centred).
  - `RouteView.render` of every route with `hasGeometry` contains exactly one `<svg class="route-draw"` with `aria-hidden="true"` and a `d="M`; every route without geometry contains none.
- [ ] **Step 2: Run** `node --test tests/route-visual.test.mjs`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `routeDrawPath` (equirectangular, longitude scaled by cos of mean latitude, fit-and-centre inside the padded box, 1-decimal numbers; comment `shortcut: flat projection, fine for India-sized routes, switch to a proper projection past ~10 degrees of latitude`). Implement `routeLine(route)` in `route.js` returning `<svg class="route-draw" viewBox="0 0 100 60" aria-hidden="true" focusable="false"><path d="…" pathLength="1"/></svg>` and add it inside `.route-hero-media` after the photo. In `route.css`: absolutely position over the photo, `stroke` `var(--orange-on-dark)`, `fill: none`, `stroke-dasharray: 1`, a 3 s `stroke-dashoffset 1 → 0` animation only inside `@media (prefers-reduced-motion: no-preference)`; otherwise offset 0. Add `/app/route-draw.js` to `sw.js` SHELL_ASSETS.
- [ ] **Step 4: Run** `node --test tests/*.test.mjs`. Expected: PASS, including the unchanged markup tests.
- [ ] **Step 5: Commit** `Route page: a drawn route line over the hero photo`.

### Task 2: Photo mosaic

**Files:**
- Modify: `app/views/route.js`, `app/route.css`
- Test: `tests/route-visual.test.mjs`

**Interfaces:**
- Consumes: `routePhotos(route)` (existing export).
- Produces: `routeMosaic(route): string` in `route.js`: the up-to-four extra tiles (photos other than `route.media.photo`), or `''` when there are none.

- [ ] **Step 1: Write failing tests**: for each route, the tiles count equals `min(4, routePhotos(route).filter((p) => p.id !== route.media?.photo).length)`; each tile is a `<button … data-photo-open="<id>" data-photo-caption=… aria-label=…>` with a non-empty `alt`; a route with no extra photo has no `route-mosaic` element; the large hero picture and its credit still render; photo ids in the mosaic are unique.
- [ ] **Step 2: Run** the file. Expected: FAIL.
- [ ] **Step 3: Implement** `routeMosaic` using `picture(id, { sizes, alt, ratio: '1 / 1' })` and place it in `.route-hero-media` as a grid beside the large photo (desktop) and a 4-up row under it (phone). Fixed aspect ratios; tiles lazy-load; the large photo keeps `priority: true`.
- [ ] **Step 4: Run** `node --test tests/*.test.mjs`, then `node scripts/build-site.mjs && node scripts/check-html.mjs && node scripts/check-links.mjs`. Expected: all pass.
- [ ] **Step 5: Commit** `Route page: a five-photo mosaic in the hero`.

### Task 3: Stop-photo scrubber

**Files:**
- Modify: `app/views/route.js` (`photoStrip` neighbour), `app/route.css`, `app/main.js`
- Test: `tests/route-visual.test.mjs`, `e2e/site.spec.js`

**Interfaces:**
- Consumes: existing `selectStop(order)` in `app/main.js` and `Data.getStop`.
- Produces: `routeScrubber(route): string` in `route.js` (empty for fewer than two stops with a photo); markup `<section class="route-scrubber" aria-labelledby="scrubber-title">` containing one `<picture>` per photo-stop (class `is-active` on the selected), and `<input type="range" class="scrubber-range" data-scrubber min="1" max="N" step="1" aria-label="Scrub along the route by stop" aria-valuetext="Stop k of N: name">` where range values are positions in the photo-stop list and `data-scrubber-orders` carries the matching stop orders as a JSON array.

- [ ] **Step 1: Write failing tests**: a route with ≥ 2 photo-stops renders one scrubber, one picture per photo-stop, `max` equals the count, `data-scrubber-orders` equals the photo-stops' orders in order; a route with 0 or 1 photo-stop renders none; the scrubber has no `role=` tab attributes and its ids are unique on the page (`tests/markup.test.mjs` ids rule still passes).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `routeScrubber` and render it between the facts row and the tab bar. In `app/main.js` add one delegated `input` listener: for `[data-scrubber]`, map the value through `data-scrubber-orders`, call `selectStop(order)`, toggle `is-active` on the matching picture and update `aria-valuetext`. In `selectStop`, also sync the range value and active picture so rail and map clicks move the scrubber. CSS: the preview picture has a fixed ratio; the range is full width with a visible focus ring.
- [ ] **Step 4: Run** unit tests; add an e2e test in `e2e/site.spec.js` (route page, 768 px and 390 px): ArrowRight on the range moves the stop (`.stop-title` changes, `data-stop-status` updates, the map pin moves), and the existing "section links land below the header" tests still pass. Run `cd e2e && npx playwright test -g "scrubber|section links"`.
- [ ] **Step 5: Commit** `Route page: scrub along the route by stop photo`.

### Task 4: Remove the dead modules and close out

**Files:**
- Delete: `app/photo-scrubber.js`, `app/flyover.js`
- Modify: `sw.js` (remove their entries, bump VERSION to v56), `DESIGN.md` (replace the stale revamp text with the spec's decisions in one short section)

- [ ] **Step 1: Run** `git grep -n "photo-scrubber\|flyover" -- app sw.js scripts tests e2e`. Expected: only the files and `sw.js` lines to remove, plus `app/base.css` flyover rules (remove those unused rules).
- [ ] **Step 2: Delete and edit**, then `node scripts/build-site.mjs`, all `scripts/check-*.mjs`, `node --test tests/*.test.mjs`. Expected: all pass; `check-sw-cache` passes with the bumped version.
- [ ] **Step 3: Review gates** (spec): run the installed `design:design-critique` and `design:accessibility-review` skills on the local build of one editorial route and one catalogue row; fix findings; then the four read-only reviewers; record any rulings in the PR body.
- [ ] **Step 4: Commit** `Route page: remove the unused flyover and scrubber modules`. Then ask the founder before pushing and opening the PR.
