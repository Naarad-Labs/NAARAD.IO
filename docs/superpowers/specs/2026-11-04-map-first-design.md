# Naarad map-first redesign proposal

Status: user selected “Map-first — compact, practical, outdoor-focused.” The concrete layout and integration below are proposed for approval; no dependencies or product code have been changed.

## Purpose and scope

Revamp the public NAARAD.IO website while retaining route discovery, route URLs, stories, listening, maps, Journey, local drafts, offline behavior and keyboard/screen-reader access. This is a visual/interaction redesign, not an account launch or a backend migration. app.naarad.io, AWS, DNS and account-release gates remain outside this change.

Product truth comes from the existing route catalogue, views, UI strategy and the user's walking/storytelling requirements. Use only existing factual content, route data, licensed photography and attribution. Do not fabricate narration availability, surveyed geometry, offline coverage or user location.

## Chosen direction and alternatives

The user selected map-first rather than the offered editorial-travel or cinematic directions. Map-first puts finding and comparing walks ahead of photographic marketing. Large decorative heroes, continuous parallax, shaders, cursor effects and scroll-pinned storytelling would compete with that task and are excluded.

Implementation choice proposed by Codex: retain the current static-page and plain-JavaScript application. Add GSAP/Lenis as optional enhancements and a small number of isolated React Bits components. A full React rewrite would replace tested routing/state/offline contracts without helping this design goal, so it is not proposed.

## Page design

- Shared shell: compact navigation and prominent search; existing sections and URLs remain. Use the existing orange/navy identity with light neutral surfaces, quieter sage map accents and clearer control boundaries. DM Sans leads the working interface; narrative reading remains comfortable. No new font family is needed.
- Homepage: short route-discovery introduction beside a large real-data map preview, compact featured-route results and a clear Open map/Browse routes action. Real place photography supports route identity rather than occupying the entire first screen. The preview links into the existing interactive catalogue instead of creating another map state owner on the homepage.
- Explore: retain its theme/collection discovery purpose and canonical URL; give the map entry and route previews first-screen priority. Keep collections, themes and story availability visible and truthful.
- Routes: desktop uses a compact filter/search row, approximately 360px result column and a dominant map in the remaining space. Results retain real distance, time, difficulty, language and story facts. Existing shared filter URLs, sorting, nearby results and saved map-layer preference continue to work. Mobile uses clearly labelled Map/List controls and compact route results; switching does not create duplicate maps. The prerendered list remains available before JavaScript or when mapping fails.
- Route detail: compact facts and actions, an immediately usable map, numbered stops, clear listening state and legible elevation controls. Preserve the recently shipped native fullscreen map/stop-list dialog, elevation-to-map cursor, GPX, print, photographs, collection links and source/geometry disclosures.
- Stories, collections, Journey and creator drafts inherit the same spacing, controls and navigation without changing their data or permissions.

## Technology setup

- Install and lock compatible versions of `gsap`, `lenis`, `react` and `react-dom`; add a small deterministic bundling step, proposed `esbuild`.
- React Bits is copied component source rather than a single npm runtime package. Select its free AnimatedContent-style component only for a below-fold editorial/collection enhancement; pin the upstream source and preserve MIT + Commons Clause notices. No Pro purchase is requested. Adapt it for settled first paint, reduced motion and deterministic cleanup.
- Bundle required code locally. Keep optional animation/React code out of the initial functional application path and lazy-load only where used. Preserve static prerendering, clean URLs and current GitHub Pages deployment. Record actual compressed bundle sizes rather than assuming the old performance budget still holds.
- React components never own the map, audio player, authentication, Journey storage or catalogue filter state. They unmount before route content is replaced.

## Motion and scrolling rules

- GSAP uses scoped contexts and transforms/opacity, approximately 150–250ms for small reveals. Never hide a prerendered first viewport waiting for JavaScript. Destroy old timelines, triggers and ticker callbacks on navigation.
- Lenis is limited to appropriate desktop editorial surfaces. Interactive route/catalogue maps, walk controls, touch scrolling, nested lists, dialogs, inputs, keyboard anchors and reduced-motion mode keep native scrolling. Avoid a second competing animation loop.
- Map drag/pinch/wheel zoom, page scroll restoration, Back/Forward, anchor destinations, focus restoration and audio continuity are regression requirements.
- Reduced motion must work both at load and when changed mid-visit. Optional-library load failure must leave a usable static site.

## Build and verification

1. Record PRODUCT.md from confirmed product facts and a development-only direction contract; prepare the detailed implementation plan after approval.
2. Work on an isolated redesign branch based on current public main. Preserve unrelated work and the separate account branch.
3. Install/pin dependencies and vendor the selected React Bits source with provenance; implement and test enhancement teardown first.
4. Build the map-first shell/catalogue and route-detail styling using existing data/controllers. Refresh other shared surfaces without changing their functionality.
5. Run deterministic builds, site/link/cache checks, Node tests and the complete browser suite. Add focused cases for Map/List switching, animation failure, reduced motion, map gestures, modal focus, anchors, navigation restoration and listening continuity.
6. Inspect phone 390/430px, tablet 768px and desktop 1440px captures; report any browser/device not actually tested. Run the Impeccable detector once on the finished changes, perform finish/accessibility/runtime/copy review and document the shipped design system from the result.
7. Prepare a reviewable PR and preview. A new public merge/deployment is a separate release decision.

## Acceptance

The map-first layout is visibly implemented, all three requested tools are used in appropriate bounded roles, existing functionality remains usable with native controls and reduced motion, no critical content depends on optional effects, no fabricated product claims appear, and fresh checks/captures support the release decision. A proposed library that cannot meet these requirements must be surfaced rather than silently removed or allowed to break the site.

## Official references checked

- GSAP installation: https://gsap.com/docs/v3/Installation
- GSAP lifecycle/React guidance: https://gsap.com/resources/React
- Lenis setup: https://github.com/darkroomengineering/lenis
- React Bits introduction/license: https://reactbits.dev/get-started/introduction
- React Bits source installation: https://reactbits.dev/get-started/installation

## User amendment — 2026-11-04
The user requested the original hero image and route map in the same carousel element, with the gradual close-up animation retained. Photo is the initial slide; explicit Photo/Map buttons and touch swipe select slides, with no automatic advance. Provide a pause-motion control and reduced-motion handling. This replaces the original map-only homepage preview composition; map-first catalogue/discovery and all other preservation constraints remain.
