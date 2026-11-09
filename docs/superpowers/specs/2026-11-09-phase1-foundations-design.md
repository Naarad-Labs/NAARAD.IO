# Phase 1: Foundations (no framework change)

Date: 2026-11-09 · Status: draft for review · Roadmap: `docs/superpowers/plans/2026-11-09-naarad-platform-roadmap.md`

## Goal

Put the pieces under the later React migration and offline work in place, on
today's vanilla-JS site, so each can be tested alone: motion, a size budget,
durable local storage, a retrying outbox, and a Cloudflare runbook.

## Constraints

- No framework, no bundler. Vendored files only. Pages stay prerendered and readable with no JS.
- Keep the existing synchronous APIs of `app/journey-store.js` and `app/studio-store.js` (views call them synchronously).
- Prerender mode (`window.__NAARAD_PRERENDER__`) must stay deterministic: no storage reads, no motion.
- `verify.sh` stays the gate; known machine-specific failures are listed in the roadmap.
- No analytics wired into pages in this phase (needs the founder's explicit yes).
- Nothing is provisioned. Cloudflare is a runbook the user follows.

## Design

### 1. GSAP motion
- Vendor `gsap.min.js` and `ScrollTrigger.min.js` into `app/vendor/gsap/` with their licence file. GSAP is free for commercial use; record the version and source URL in `app/vendor/gsap/README.md`.
- Loaded lazily after first paint, never in prerender, never when `prefers-reduced-motion: reduce` or `navigator.connection.saveData` is true (dither and reveals fall back to static).
- Used for: hero entrance, scroll reveals replacing the current CSS-class reveals in `app/motion.js`, and a count-up on route metrics. `Motion.scan` and `Motion.start({settle})` keep their signatures; pre-rendered content must not replay.
- Added to the service worker precache; version bumped.

### 2. Size budget
- New `scripts/check-budget.mjs`: for each page type (home, explore, routes, route, story, journey, studio), follows the module imports from `app/main.js` plus the page's stylesheets, gzips each file, and fails if JavaScript exceeds **150 KB gzipped** or CSS exceeds **60 KB gzipped** for that page. Prints a table.
- GSAP does not count toward the first-load budget because it loads after paint; it is reported separately with its own cap (**70 KB gzipped**).
- Added as a `verify.sh` stage. Static analysis, no browser, deterministic.
- Lighthouse on throttled Android is a later, optional CI job.

### 3. Durable local storage
- New `app/idb.js`: a small IndexedDB key-value wrapper (`get`, `set`, `delete`, `keys`) plus an in-memory implementation behind the same interface for tests and as the fallback when IndexedDB is unavailable (private mode) or throws.
- `journey-store.js` and `studio-store.js` keep their synchronous API by holding the data in memory, loaded once at boot through `ready(): Promise<void>` (awaited in `boot()` before the first render) and written through to IndexedDB asynchronously after each change.
- One-time migration: if IndexedDB has no record but `localStorage` has `naarad.journey.v1` or `naarad.studio.v1`, copy it over, and delete the old key only after the copy is read back and equal. A corrupt or wrong-shaped record keeps today's behaviour (page draws, record ignored); the existing "storage of the wrong shape" e2e cases must still pass.
- If storage is full or refused, the data stays in memory for the session and the interface says it was not saved (no silent loss).

### 4. Outbox
- New `app/outbox.js`: a persistent queue in IndexedDB. Each item has `key` (dedupe), `kind`, `payload`, `queuedAt`, `tries`.
- `enqueue(kind, payload, key)`, `flush(sender)`, with exponential backoff (1 s doubling to 5 min, jittered), triggered on `online`, on `visibilitychange` to visible, and at boot. Items that the sender rejects permanently (4xx) are dropped and counted; transient failures stay.
- Cap of 500 items; when full the oldest is dropped and counted, and the count travels with the next batch (the rule `events.js` already states).
- `events.js` gets its queue storage moved onto the outbox, with its consent and schema rules unchanged. It still is not loaded by any page.

### 5. Cloudflare runbook
- `docs/ops/cloudflare.md`: steps for the user to put the domain behind Cloudflare (DNS records, SSL mode, cache rules for `/app/`, `/Images/`, `/content/`, never caching HTML pages beyond revalidation, Brotli on, range requests passed through). No repo code depends on it.

## Testing

- `tests/idb.test.mjs`: in-memory implementation behaves as the interface; fallback used when the IndexedDB factory throws.
- `tests/journey-store.test.mjs` additions: migration copies and only then deletes the old key; wrong-shaped old data is ignored; a failed write is reported, not swallowed.
- `tests/outbox.test.mjs`: dedupe by key, backoff schedule values, permanent failure drops and counts, cap drops oldest and carries the count, order preserved.
- `tests/check-budget.test.mjs`: a fixture over the budget fails; under it passes.
- e2e: journey saved route survives a reload through IndexedDB; legacy localStorage data appears after migration; reduced motion and `Save-Data` load no GSAP request.

## Review focus

- IndexedDB blocked, full or quota-exceeded mid-session.
- Two tabs open writing the journey at once (last write wins, no corruption).
- Old data migrated twice (idempotent).
- Reduced motion on: no GSAP file requested at all.
- Prerender build stays byte-identical across runs.

## Out of scope

Wiring events into pages, React or shadcn, Supabase sync, Oracle and AWS provisioning, Lighthouse CI.

## Build order

1. `app/idb.js` + tests. 2. Journey and studio stores onto it, with migration. 3. `app/outbox.js` + events storage. 4. `check-budget.mjs` and its `verify.sh` stage. 5. GSAP vendoring and motion. 6. Cloudflare runbook. Each step ends with tests green and a commit.
