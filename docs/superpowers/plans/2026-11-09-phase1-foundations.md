# Phase 1 Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Durable on-device storage with lossless migration, a retrying outbox, a per-page size budget in `verify.sh`, GSAP motion that never loads for reduced-motion or Save-Data visitors, and a Cloudflare runbook, all on today's vanilla-JS site.

**Architecture:** One persisted key-value store (`app/idb.js`) with a synchronous, `localStorage`-shaped API backed by an in-memory copy that is loaded once at boot and written through to IndexedDB (falling back to `localStorage`, then memory). The journey store, the studio store and the event queue swap `localStorage` for it with minimal diffs. A generic outbox (`app/outbox.js`) owns persistent queued items and the retry schedule. GSAP is vendored and injected after first paint by `app/motion.js`.

**Tech Stack:** Vanilla ES modules, IndexedDB, GSAP 3.13.0 (vendored UMD), `node --test`, Playwright, bash (`scripts/verify.sh`).

**Spec:** `docs/superpowers/specs/2026-11-09-phase1-foundations-design.md` (roadmap: `docs/superpowers/plans/2026-11-09-naarad-platform-roadmap.md`)

**Branch:** `product/phase1-foundations`, cut from `product/web-revamp` at `c76f31b` (PR #67 is not merged yet). Open its PR against `main` after #67 lands, or stack it on #67.

## Global Constraints

- No framework, no bundler, no new runtime dependency except the vendored GSAP files.
- Pages stay prerendered and readable with no JS. Under `window.__NAARAD_PRERENDER__`: no storage reads or writes, no motion, output byte-identical across builds.
- Existing synchronous exports of `app/journey-store.js` and `app/studio-store.js` keep their names, arguments and return shapes.
- Storage keys stay `naarad.journey.v1` and `naarad.studio.v1`; IndexedDB database `naarad`, object store `kv`.
- A legacy `localStorage` key is deleted only after its IndexedDB copy is read back and deep-equal.
- Budgets (gzipped): first-load JS ≤ 150 KB per page, CSS ≤ 60 KB per page, GSAP ≤ 70 KB reported separately.
- Outbox: cap 500 items, backoff 1 s doubling to 300 s with ±20% jitter, 4xx = permanent drop (counted), other failures retried.
- GSAP never requested when `prefers-reduced-motion: reduce` matches or `navigator.connection?.saveData === true`.
- No analytics wired into any page (guardrail `wire_analytics_into_pages` needs the founder's yes). No Oracle/AWS/Cloudflare provisioning.
- Every new precached file goes into `sw.js` `SHELL_ASSETS`; bump `VERSION` once on this branch (v48 → v49).
- Gate: `node --test tests/*.test.mjs` and the e2e tests named per task; full `bash scripts/verify.sh` at the end. Known machine-specific failures (not regressions): `Images/og` share-card nondeterminism, main's `check-content-numbers` stage, e2e tests that flake under load and pass alone.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never stage `Images/og/*` or `e2e/results.json`.

## Review Focus

- IndexedDB open blocked or throwing (Firefox private mode, quota exceeded mid-session): data stays usable in memory and the journey page says it is not being saved.
- Two tabs writing the journey: last write wins, the stored record is always a complete valid object, never a mix.
- Migration run twice (reload mid-migration): idempotent, no duplicate or lost entries.
- Reduced motion or Save-Data on: zero network requests for `/app/vendor/gsap/`.
- Route-metric count-up: the final text equals the prerendered text exactly (e2e asserts "5.2 km" and "8 stops").

---

### Task 1: Persisted store (`app/idb.js`)

**Files:**
- Create: `app/idb.js`
- Test: `tests/idb.test.mjs`

**Interfaces:**
- Produces:
  - `openStore({ backend?: 'auto' | 'memory', legacy?: Storage | null, migrateKeys?: string[], indexedDB?: IDBFactory | null }): Store`
  - `Store.ready(): Promise<void>`: loads every key from the backend into memory; then, for each key in `migrateKeys` absent from the backend but present in `legacy`, copies it, reads it back, and calls `legacy.removeItem(key)` only if the read-back string is identical. Resolves (never rejects) even if every backend fails.
  - `Store.getItem(key: string): string | null`, `Store.setItem(key: string, value: string): void`, `Store.removeItem(key: string): void`: synchronous, memory first, write-through async.
  - `Store.persistence(): 'indexeddb' | 'localstorage' | 'memory'`: the backend actually in use after `ready()`; downgraded to `'memory'` if a write-through fails.
  - `Store.onFailure(listener: (error: Error) => void): () => void`
  - `export const store: Store`: the app's single instance (`openStore({ migrateKeys: ['naarad.journey.v1', 'naarad.studio.v1'] })`), inert under prerender (`ready()` resolves at once, nothing read or written).

- [ ] **Step 1: Write failing tests** in `tests/idb.test.mjs` using `backend: 'memory'` and a fake `legacy` object (`{ getItem, setItem, removeItem }` over a `Map`):
  - `getItem` returns what `setItem` stored, `removeItem` clears it, unknown key → `null`.
  - migration: legacy has `naarad.journey.v1 = '{"saved":[]}'`, store empty → after `ready()`, `getItem` returns that string and `legacy.getItem('naarad.journey.v1') === null`.
  - migration is skipped when the store already has the key (legacy value left untouched).
  - running `ready()` twice leaves exactly one copy and no legacy key.
  - `openStore({ indexedDB: { open() { throw new Error('blocked'); } }, legacy: null })` → `ready()` resolves and `persistence() === 'memory'`.
  - a backend whose write rejects → `persistence()` becomes `'memory'` and the `onFailure` listener is called once with an `Error`.
- [ ] **Step 2: Run** `node --test tests/idb.test.mjs`. Expected: FAIL (`Cannot find module '../app/idb.js'`).
- [ ] **Step 3: Implement `app/idb.js`.** Backend selection in `'auto'`: IndexedDB (`indexedDB.open('naarad', 1)`, object store `kv`, `onupgradeneeded` creates it) → `globalThis.localStorage` → memory. Write-through is serialised per key (keep the latest pending value, one transaction at a time) so two quick `setItem` calls end with the last value. Each `ready()` is safe to repeat.
- [ ] **Step 4: Run** `node --test tests/idb.test.mjs`. Expected: PASS, 6/6.
- [ ] **Step 5: Commit** `git add app/idb.js tests/idb.test.mjs && git commit -m "Persisted store over IndexedDB with verified localStorage migration"`

### Task 2: Journey and studio stores on the persisted store

**Files:**
- Modify: `app/journey-store.js` (`read()` ~line 53, `write()` ~line 64; add `ready`, `persistence`), `app/studio-store.js` (`read()` ~line 63, `write()` ~line 74; add `ready`), `app/main.js` (`boot()`: await both `ready()`s before `show()`), `app/views/journey.js` (notice when not saved), `app/journey.css`, `sw.js` (add `/app/idb.js`, `VERSION` → `'v49'`)
- Test: `tests/journey-store.test.mjs` (create if absent), `e2e/site.spec.js`

**Interfaces:**
- Consumes: `store` from Task 1.
- Produces:
  - `Journey.ready(): Promise<void>` and `Drafts.ready(): Promise<void>` (both delegate to `store.ready()` and reset the cached `state` so the next `read()` sees migrated data).
  - `Journey.persistence(): 'indexeddb' | 'localstorage' | 'memory'`.
  - Journey page renders `<p class="journey-unsaved" role="status">` with copy "Your journey is not being saved on this device. It will be kept until you close this tab." when `persistence() === 'memory'`; nothing otherwise.

- [ ] **Step 1: Write failing tests:** in `tests/journey-store.test.mjs`, set `globalThis.localStorage` to a `Map`-backed fake holding a valid `naarad.journey.v1` with one saved route, import the module fresh (query-string cache-buster), `await Journey.ready()`, assert `Journey.isSaved(<slug>) === true` and the fake `localStorage` no longer has the key; a wrong-shaped legacy value (`'{"saved":"x"}'`) leaves `Journey.all().saved` deep-equal `[]` without throwing. In `e2e/site.spec.js`: (a) seed `localStorage` via `addInitScript`, open `/journey/`, assert the saved route shows, reload, assert it still shows and `localStorage.getItem('naarad.journey.v1') === null`; (b) with `indexedDB.open` stubbed to throw via `addInitScript`, `/journey/` shows `.journey-unsaved`.
- [ ] **Step 2: Run** `node --test tests/journey-store.test.mjs`. Expected: FAIL (`Journey.ready is not a function`).
- [ ] **Step 3: Implement:** in both stores replace `localStorage.getItem/setItem` with `store.getItem/setItem` (keep the `PRERENDER` guards and `try` blocks); add `ready()`; in `boot()` add `await Promise.all([Journey.ready(), Drafts.ready()])` before `await show(...)` (skip under prerender); render the notice in the journey view; add `/app/idb.js` to `SHELL_ASSETS` and bump `VERSION`.
- [ ] **Step 4: Run** `node scripts/build-site.mjs && node --test tests/*.test.mjs`, then `cd e2e && npx playwright test -g "journey|storage of the wrong shape"`. Expected: all PASS, including the existing "storage of the wrong shape" cases.
- [ ] **Step 5: Commit** app files, tests, `sw.js` and regenerated pages: `git commit -m "Journey and drafts persist in IndexedDB, migrated from localStorage"`

### Task 3: Outbox and event-queue persistence

**Files:**
- Create: `app/outbox.js`
- Modify: `app/events.js` (`defaultStorage()` → the persisted store; `flush` scheduling via the outbox retrier), `sw.js` (add `/app/outbox.js`)
- Test: `tests/outbox.test.mjs`, existing events tests (`grep -l createEventQueue tests/`)

**Interfaces:**
- Consumes: `store` from Task 1.
- Produces:
  - `backoffDelay(tries: number, random?: () => number): number`: `min(1000 * 2 ** tries, 300000)` scaled by `0.8 + 0.4 * random()`.
  - `createOutbox({ store, key?: string, cap?: number, now?: () => number }): Outbox`, default key `'naarad.outbox.v1'`, cap 500.
  - `Outbox.enqueue(kind: string, payload: object, dedupeKey: string): boolean` (false if the key is already queued).
  - `Outbox.flush(sender: (items) => Promise<{ ok: string[], permanent: string[] }>): Promise<{ sent: number, dropped: number, remaining: number }>`: removes `ok` and `permanent` keys, increments `tries` on the rest.
  - `Outbox.size(): number`, `Outbox.droppedCount(): number` (cap drops plus permanent failures, persisted).
  - `createRetrier(run: () => Promise<boolean>, { random?, setTimer?, clearTimer? }): { kick(): void, stop(): void }`: calls `run` on `kick()`, on `online`, on `visibilitychange` to visible; schedules the next attempt with `backoffDelay` while `run` resolves `false`; resets tries when it resolves `true`.

- [ ] **Step 1: Write failing tests** in `tests/outbox.test.mjs` with a `backend: 'memory'` store: `backoffDelay(0, () => .5) === 1000`, `backoffDelay(3, () => .5) === 8000`, `backoffDelay(20, () => .5) === 300000`, `backoffDelay(0, () => 0) === 800`, `backoffDelay(0, () => 1) === 1200`; duplicate `dedupeKey` → second `enqueue` returns `false` and `size() === 1`; cap 3 with 4 enqueues keeps the newest 3 and `droppedCount() === 1`; `flush` with sender returning `{ ok: ['a'], permanent: ['b'] }` over `a,b,c` leaves `c` with `tries === 1` and `droppedCount()` up by 1; insertion order preserved across a new `createOutbox` on the same store; `createRetrier` with fake timers retries after `backoffDelay` and stops after a `true`.
- [ ] **Step 2: Run** `node --test tests/outbox.test.mjs`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `app/outbox.js`** per the interfaces. In `app/events.js`, change `defaultStorage()` to return the persisted `store` (it already speaks `getItem`/`setItem`), and drive its existing `flush` with `createRetrier` (`run` resolves `true` when the queue is empty after flushing). Consent and schema rules unchanged. `events.js` stays unloaded by pages. Add `/app/outbox.js` to `SHELL_ASSETS`.
- [ ] **Step 4: Run** `node --test tests/*.test.mjs`. Expected: PASS, existing events tests included.
- [ ] **Step 5: Commit** `git commit -m "Outbox with backoff and dedupe; event queue persists through the store"`

### Task 4: Per-page size budget

**Files:**
- Create: `scripts/check-budget.mjs`
- Modify: `scripts/verify.sh` (new `check_budget()` stage after `check_site`, and its header comment)
- Test: `tests/check-budget.test.mjs`, fixture dir `tests/fixtures/budget/`

**Interfaces:**
- Produces:
  - `measure({ root: string, entry: string, views: string[], shellCss: string[] }): Array<{ page: string, js: number, css: number }>` (gzipped bytes): per view, the static import closure of `entry` plus the view's own closure (static and dynamic `import('./…')` both counted), CSS = `shellCss` plus the view's `export const stylesheet = '…'`. Files under `app/vendor/gsap/` are excluded and reported as `gsap`.
  - `check(rows, { js = 150 * 1024, css = 60 * 1024, gsap = 70 * 1024 }): string[]`: one message per breach, empty when within budget.
  - CLI: `node scripts/check-budget.mjs` prints a table (page, JS KB, CSS KB) and exits 1 on any breach.

- [ ] **Step 1: Write failing tests:** a fixture `entry.js` importing `a.js` and a view `v.js` with `export const stylesheet = '/v.css'`; `measure` returns one row whose `js` equals the sum of the gzipped sizes of `entry.js`, `a.js`, `v.js` (compute with `zlib.gzipSync` in the test); `check` with `{ js: 10 }` returns one message naming the page; with defaults returns `[]`.
- [ ] **Step 2: Run** `node --test tests/check-budget.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** with a regex import scan (`import … from './x.js'`, `import('./x.js')`, resolved relative to the importing file, each file counted once per page). Views = every `app/views/*.js`; `shellCss = ['app/base.css', 'app/tokens.css', 'app/home.css']` (read the actual shell links from `app/shell.html` if `tokens.css` is not linked there). Add the stage to `verify.sh`.
- [ ] **Step 4: Run** `node --test tests/check-budget.test.mjs && node scripts/check-budget.mjs`. Expected: tests PASS; CLI prints the table and exits 0 on the current site. If the current site already breaches, stop and report the numbers (do not raise the budget).
- [ ] **Step 5: Commit** `git commit -m "Per-page size budget, checked in verify.sh"`

### Task 5: GSAP motion

**Files:**
- Create: `app/vendor/gsap/gsap.min.js`, `app/vendor/gsap/ScrollTrigger.min.js`, `app/vendor/gsap/LICENSE.md`, `app/vendor/gsap/README.md` (version 3.13.0, source, date)
- Modify: `app/motion.js` (`start`, `reveal`; new loader), `app/home.css` / `app/base.css` only where the CSS reveal must yield to GSAP, `sw.js` (add both vendor files)
- Test: `tests/motion.test.mjs`, `e2e/site.spec.js`

**Interfaces:**
- Consumes: none from earlier tasks.
- Produces:
  - `motionAllowed({ reducedMotion: boolean, saveData: boolean, prerender: boolean }): boolean`
  - `countUpText(finalText: string, progress: number): string`: animates every number in the string from 0 at `progress = 0` to its exact final form at `progress = 1`, keeping decimals and units ("5.2 km" → "0.0 km" … "5.2 km").
  - `Motion.scan` and `Motion.start({ settle })` keep their signatures; `start` loads GSAP via injected `<script>` tags only when `motionAllowed(...)` is true, after `requestIdleCallback` (timeout 1500 ms), and falls back to the existing CSS reveal if loading fails.

- [ ] **Step 1: Vendor GSAP:** in the scratchpad, `npm pack gsap@3.13.0`, extract, copy `dist/gsap.min.js`, `dist/ScrollTrigger.min.js` and the licence into `app/vendor/gsap/`; write the README. Read the licence text before committing.
- [ ] **Step 2: Write failing tests:** `motionAllowed` is false when any of the three flags is true, true when all false; `countUpText('5.2 km', 1) === '5.2 km'`, `countUpText('5.2 km', 0) === '0.0 km'`, `countUpText('8 stops', 0.5) === '4 stops'`, `countUpText('No numbers', 0.3) === 'No numbers'`. e2e: with `reducedMotion: 'reduce'` and, separately, with `navigator.connection.saveData` stubbed `true`, loading `/` makes zero requests matching `/app/vendor/gsap/`; with neither, one request to `gsap.min.js` happens and the Hampi card still reads "5.2 km" and "8 stops".
- [ ] **Step 3: Run** `node --test tests/motion.test.mjs`. Expected: FAIL.
- [ ] **Step 4: Implement:** loader in `app/motion.js`; reveals use `gsap.fromTo(el, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out' })` driven by the existing IntersectionObserver (ScrollTrigger only where a scrubbed effect needs it); hero entrance staggers `.home-hero-copy > *`; count-up on `.route-card-metrics` numbers only for cards that enter after load (never for settled, prerendered-visible ones). Add vendor files to `SHELL_ASSETS`.
- [ ] **Step 5: Run** `node --test tests/*.test.mjs && node scripts/check-budget.mjs`, then `cd e2e && npx playwright test -g "homepage|gsap|motion"`. Expected: PASS; budget table shows GSAP under 70 KB.
- [ ] **Step 6: Commit** `git commit -m "GSAP motion, skipped for reduced motion and Save-Data"`

### Task 6: Cloudflare runbook and final gate

**Files:**
- Create: `docs/ops/cloudflare.md`

- [ ] **Step 1: Write the runbook:** adding the site, nameserver change, DNS records for GitHub Pages (apex `A` records and `www` `CNAME`, matching the repo's `CNAME` file), SSL mode Full (strict), Brotli on, cache rules (`/app/*`, `/Images/*` cache everything; `/content/*` and HTML respect origin headers, revalidate), no Rocket Loader or HTML minification (they break the service worker and prerendered markup), range requests passed through for media, how to roll back (switch nameservers back). Every step names the dashboard page it happens on. No secrets in the file.
- [ ] **Step 2: Run** `node scripts/build-site.mjs && bash scripts/verify.sh` (with `VERIFY_ALLOW_UNCOMMITTED=1` only while uncommitted). Expected: all stages PASS except the known machine-specific failures listed in Global Constraints; any other failure is fixed before the commit.
- [ ] **Step 3: Commit** `git commit -m "Cloudflare runbook"` and report the stage table.

## Self-review notes

- Spec coverage: GSAP (T5), budget (T4), storage + migration + failure notice (T1–T2), outbox + events storage (T3), Cloudflare runbook (T6), Review Focus items each pinned in T1, T2 or T5 tests.
- Ruling carried from the spec: `events.js` keeps its own queue logic (dedupe, cap and dropped count already exist there) and gains persistence through the store and scheduling through `createRetrier`, instead of being rewritten onto `Outbox`. The generic `Outbox` serves Phase 5 uploads.
- Two-tab last-write-wins is guaranteed by whole-record writes; not separately tested (Review Focus).
