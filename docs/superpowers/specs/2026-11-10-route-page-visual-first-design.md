# Route page, visual-first: design

Status: draft for review. Source: "Visual-first UI references for Naarad" (Nov 9, 2026). Scope: the route page only. Home, Explore, collections and walking mode are later slices.

## Intent

Photos and the map lead; text supports them. Komoot's restraint is the base. From the other references, the route page borrows three ideas:

- Airbnb: a five-photo mosaic before any text.
- AllTrails: photos you scrub along the route.
- Strava Flyover: a route-draw hero, without video.

Success: a visitor sees five real photographs and the route's line before reading a word; scrubbing moves the photo, the stop and the map pin together; every existing test, the offline shell and the "Not yet measured" honesty rules still hold.

## Constraints

- Offline-first. No video, no new network dependency. All new assets are precached by `sw.js` and `VERSION` is bumped.
- No invented data. Photos, stops and geometry come from the route object. A route with fewer than five photos gets a smaller mosaic, never a placeholder. A route without geometry gets no flyover. A route without stops gets no scrubber.
- Server-rendered first (`scripts/build-site.mjs` prerenders). The mosaic, scrubber track and hero are valid HTML without JavaScript; JavaScript only adds motion and syncing.
- Reduced motion: no animation, the final state is drawn at once. Dither (`app/dither.js`) is used on the hero band only; stop and mosaic photographs stay full colour.
- Contracts that must keep passing: `tests/markup.test.mjs` (section links, `route-facts`, `route-glance`, unmeasured figures, no `data-dither` in `route.js`), `tests/sw-content.test.mjs` (every app script precached), `scripts/check-*`, the e2e anchor and sticky-header tests.
- Route pages stay on plain paper: dither is applied by the hero's own element, not through `data-dither` in `route.js`.

## Design

1. **Mosaic** (`routeMosaic(route)` in `app/views/route.js`): one large and up to four small photographs from `routePhotos(route)`, placed above the header copy on desktop and as a horizontal strip on a phone. Each tile opens the existing lightbox (`data-photo-open`), so no new viewer is built.
2. **Scrubber** (progressive enhancement of `photoStrip`): the existing strip stays as the markup. A small module (`app/photo-scrubber.js`, fixed and wired) adds a track with one tick per stop-with-photo, arrow-key and drag support, and emits one event with the stop index. `route-workspace.js` listens: the rail selects the stop, the map pin moves. No new state store.
3. **Route-draw hero** (`app/flyover.js`, rewritten): an SVG path built from `route.geometry.coordinates`, drawn with `stroke-dashoffset` over about 3 seconds on first view, over the hero photograph, then settled. About 2 KB, no canvas, no WebGL. Dither is an optional overlay behind the line and is dropped when WebGL or motion is unavailable.
4. **Copy and layout**: Komoot restraint. One headline, one line of facts, no extra labels. The existing `hero` content (breadcrumb, h1, lede, byline) is kept; the mosaic and the line sit beside it.

## Files

Modify: `app/views/route.js`, `app/route.css`, `app/route-workspace.js`, `app/photo-scrubber.js`, `app/flyover.js`, `sw.js`. Add tests in `tests/markup.test.mjs` and a new `tests/route-visual.test.mjs`; e2e additions in `e2e/site.spec.js`.

Do not touch: home, explore, collection views and their CSS; walking-mode.

## Tests first (each written failing, then made to pass)

- Mosaic: with 5, 3 and 1 photos, the right tiles and no placeholder; every tile is a `data-photo-open` button with a caption.
- Scrubber: one tick per stop with a photo, none for a route without stops; keyboard moves the selection; selecting emits one change event.
- Flyover: path points equal the geometry; absent for a route without geometry; with reduced motion the path is fully drawn and no animation runs.
- Contracts: the full `node --test tests/*.test.mjs`, `scripts/check-*`, and the e2e sticky-header and anchor tests (including 768 px) stay green.
- Offline: `sw-content` test covers every new script; `check-sw-cache` passes.

## Review gates

1. Design critique and accessibility review (installed skills) on a local build: mosaic alt text, scrubber keyboard and focus, contrast of the line over photographs, reduced motion.
2. Performance: the route page's added JavaScript stays under 8 KB gzip; no layout shift from the mosaic (fixed aspect ratios); LCP image is the large mosaic tile, preloaded.
3. Four read-only reviewers before merge (standing rule), then CI.
4. If the audit-suite or Website Design plugins are installed, run `web-animation-design` and `web-design-guidelines` on the result; they are not required.

## Out of scope / risks

- A true 3D flyover (rejected: weight, offline).
- Home, Explore, collections, walking mode: later specs.
- Risk: the route-draw animation has not been tried on a low-end phone; prototype it first (a throwaway page) and keep it only if it holds 60 fps on a mid-range device or degrades to the static line.
- Risk: the mosaic changes the first screen of every route page, so the LCP and the sticky-header e2e tests must be re-checked at 768 px.
- Open: the "Interfaces" reference in the doc is assumed to be Rauno Freiberg's Web Interface Guidelines; if not, the build-time audit step changes.
