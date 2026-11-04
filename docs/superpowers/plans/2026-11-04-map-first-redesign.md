# Map-first redesign implementation plan

> Execute with subagent-driven-development for independent visual and enhancement slices; root owns integration and regression verification.

**Goal:** Deliver the approved map-first public website while preserving every existing functional contract.
**Architecture:** Keep static/prerendered pages and plain-JS controllers. GSAP/Lenis and isolated React Bits components are locally bundled optional enhancements. Existing maps, audio, state, authentication and offline data retain their owners.
**Spec:** docs/superpowers/specs/2026-11-04-map-first-design.md (approved in chat 2026-11-04).

## Global constraints
- Native touch/map/dialog/walk scrolling; reduced-motion and optional-library failure stay usable.
- All existing sections, links, filters, map layer, listening, Journey, drafts, collection/gallery, GPX/print and fullscreen/elevation behaviors remain.
- No new claims, account activation, backend/AWS/DNS change or deployment.
- React Bits source must retain upstream attribution/license; React never owns functional app state.

## Tasks
- [x] Inspect incumbent and record approved design/product context; create isolated redesign branch.
- [x] Install locked GSAP, Lenis, React/React DOM and esbuild.
- [x] Visual slice: home/discover map-first composition and app/map-first.css; preserve original content/functions. Owner: visual worker. Root supplies catalogue .catalogue-workspace with .catalogue-results and #atlas / .atlas map.
- [x] Enhancement slice: locally bundle source, vendor React Bits AnimatedContent with provenance, lifecycle-safe optional motion and bounded Lenis. Owner: enhancement worker (app/motion.js, app/enhancements/, scripts/build-enhancements.mjs, app/vendor/ output). Main integration stays root-owned. Existing Motion.start/scan contract remains; expose destroy() for pre-replacement cleanup. No React ownership of map/audio/filters/stores.
- [x] Catalogue slice: side-by-side results/map and native Map/List buttons; root owns app/views/explore.js, app/atlas.js and main.js. Views remain prerendered and usable when map fails.
- [x] Integration: root owns app/shell.html, root package scripts, CI/build/service worker. Root loads map-first.css after incumbent styles and coordinates module lifecycle. Build enhancements before prerender, precache local output and bump worker version.
- [x] Verification: focused lifecycle/toggle/reduced-motion/load-failure tests; all existing five verify stages. Phone390/430, tablet768, desktop1440 captures. No tests disabled merely for design changes; update only obsolete visual-specific expectations with recorded reason.
- [x] Independent source/UI/finish reviews, Impeccable detector once, DESIGN.md from shipped artifact and evidence report; prepare reviewable branch/PR without deploying.

## Review focus
Repeated navigation/late async loads must not leak roots, triggers or tickers. Modal/anchor/Back focus and scroll must remain native. Map/List switching must preserve one map and current filters. Failed library/map loads must expose functional content. User motion-preference changes must restore settled content.

## Decisions and evidence
- Approved map-first direction; full React migration rejected in favor of bounded React islands.
- Ruling: reuse current isolated public worktree on a new branch, preserving existing release and separate account worktrees.
- Dependency installation completed with zero npm audit findings; exact versions are in package-lock.json. Esbuild's binary/build will be checked rather than assuming postinstall execution.

## Final integration evidence (2026-11-05)

- Original Hampi photo restored as the first manually selected Photo/Map carousel slide. GSAP supplies a 16-second gradual close-up; pause, keyboard, swipe and reduced-motion behavior have browser coverage.
- Native map/list controls preserve a single map and current filters. Fragment navigation opens the mobile map, scrolls to it and transfers focus; failure leaves usable results.
- All five verification stages passed in `/private/tmp/naarad-map-first-nov5-verify.log`: deterministic builds, sitemap/cache/meta/links, unit tests, practical facts and 167 browser cases. The final placement change also passed a fresh complete five-stage run in `/private/tmp/naarad-map-first-final-gate.log` (72 seconds, 167 browser cases).
- Unit tests: 211 passed, 12 explicitly skipped. Operations: 145 passed, validation/secret scan/interview lint passed. PGlite migrations/RLS: 14 passed after installing the existing locked test dependencies.
- Independent standards/spec/accessibility/design/runtime/copy reviews completed during the build. Final Impeccable finish review confirmed the photo/map amendment and cleared the relocated stop sequence label. No historical QUALITY BAR card or concept seed exists; the formal ceiling comparison was unavailable, and no retrospective approval is asserted.
- Luna handled final anchor diagnosis, finish review and design documentation at the user's request. Anchor stress checks exposed an intermittent 390px placement miss despite the full suite passing; diagnosis continues without weakening the assertion.
- Generated JavaScript sizes: entry 7,821 bytes gzip; shared GSAP chunk 29,128; deferred React accent chunk 70,682. Initial editorial execution imports 36,949 gzip bytes; the service worker background precache includes all chunks. This does not establish a 75 KB total website budget.
- Capture coverage: home, catalogue and route at 390/430/768/1440; extra mobile/desktop Map slides, mobile Map mode, and full-page home/route captures under `.impeccable/review/`. Touch swipe is synthetic Chromium PointerEvent coverage; physical iOS/Android testing is not claimed.
- No DNS, AWS, sign-in configuration, production merge or deployment in this redesign.

- Final documentation: root `DESIGN.md` and `.impeccable/design.json` derived from the active CSS/component cascade. Source review corrected inherited motion timing and removed non-source tonal ramps before acceptance. Runtime dependency audit reports zero vulnerabilities.

## Review branch

Draft PR: https://github.com/Naarad-Labs/NAARAD.IO/pull/63. Implementation commit: `cc2692f`. A post-commit rebuild wrote zero files; all 73 generated outputs matched. Live deployment remains unchanged.

The final finish reviewer cleared the stop-label placement fix. The formal QUALITY BAR/seed limitation above remains a historical process limitation rather than an asserted approval. The intermittent mobile overview anchor miss remains open for review: one focused repetition failed, while two complete final browser runs passed. Later diagnostic stress batches were accidentally run from a duplicate worktree and are excluded from this branch’s verification evidence. Steady-state header/tabs/margin are correct (64px header, tabs ending at 118px, 134px scroll margin); no cause was proven, so no speculative source patch or weaker assertion was accepted. The PR remains draft and is not a release-readiness claim.

## User amendment: remove Pause motion button (2026-11-05)

Removed the visible motion button and its unused controller/CSS branches. Photo/Map selection and reduced-motion preference still govern photo animation. Updated regression checks assert the button is absent and Map stops the close-up. This supersedes earlier pause-button descriptions in the approved build history.

The button-removal regression first failed with the old button present, then all three carousel browser cases and all three motion lifecycle tests passed after removal. Build/cache/diff checks passed; preview captures were refreshed.
