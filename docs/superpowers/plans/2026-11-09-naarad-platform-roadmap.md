# Naarad platform roadmap: frontend, backend and offline

Date: 2026-11-09 · Status: draft for review · Owner: Aryan

This is a programme plan, not a task list. Each phase gets its own spec and
task plan (superpowers: brainstorming → writing-plans) before any code, and
nothing is provisioned on Oracle or AWS without a separate yes.

## Goal

A heritage-walking site and app that works for a walker with weak or no signal
on a budget Android phone, with a polished brand look, real community features
and a backend that costs close to nothing once credits end.

## Where we are

- PR #67 (`product/web-revamp`): vanilla-JS dithered backgrounds, bands on all
  listing pages, optional intro-video and route-tracker sections (empty), service
  worker v48. Not merged. Media not supplied. `verify.sh` fails on this machine
  only for share-card JPEG nondeterminism and main's content-numbers stage.
- Site: static prerendered HTML, hand-written service worker, localStorage
  journey data, Leaflet maps, Supabase configured, offline route bundles behind
  a flag.
- Resources: Oracle Always Free (home region **Hyderabad**), AWS Activate
  credits ($25k, **Sydney** only), Cloudflare free tier (not yet set up).

## Decisions (all approved by the user, 2026-11-09)

| # | Decision | Outcome | Blocks |
|---|---|---|---|
| D1 | Frontend stack | React migration approved; built as Astro (or Vite static prerender) with React islands and shadcn/ui, one page at a time. A literal big-bang rewrite is not planned. | Phase 2 |
| D2 | Hourly design loop | Cancelled (job `01786ae4` deleted). Restart after Phase 2 if wanted. | done |
| D3 | Fonts | Keep Playfair Display + DM Sans | none |
| D4 | Media | User supplies Ultramock export and captions `.vtt`; `brew install ffmpeg` still to be run | Phase 0 |
| D5 | Licences | Borrow ideas from AGPL/GPL apps, never copy their code | Phase 5 |

Still needing its own explicit yes: wiring analytics events into pages (a
privacy change under `ops/guardrails.json: wire_analytics_into_pages`), and any
Oracle or AWS provisioning.

## Target architecture

- **Pages:** prerendered static HTML that reads with no JavaScript. Interactive
  parts (map, filters, Creator Studio, Q&A) are React islands with shadcn/ui and
  Tailwind. Budget: about 150 KB gzipped JavaScript per page.
- **Motion:** GSAP (vendored, no build step) and the dither module, both off
  under `prefers-reduced-motion` and `Save-Data`.
- **Offline:** service worker (shell, pages, media on use) plus downloadable
  route packs: route data, stop text, photos, Opus audio, corridor map tiles.
- **Local data:** IndexedDB (Dexie) for journey and drafts, with an outbox that
  retries uploads and events when the connection returns.
- **Edge:** Cloudflare in front of everything (cache, Brotli, range requests).
- **Origin:** Oracle Hyderabad VM serves bundles, audio and tiles (free ~10 TB/month
  egress). GitHub Pages or Cloudflare Pages serves the site itself.
- **Backend:** Supabase (auth optional, community tables, storage). The app is
  fully usable with no account.
- **AWS (Sydney, credits):** batch narration (Polly, Translate), S3 backups of
  Oracle data, SES for mail. Nothing user-facing depends on it.

## Phases

### Phase 0: Land the web revamp
- Merge PR #67 after review. Add the video and tracker media via `content/visuals.json`.
- Decide on a bolder dither (navy hero) or keep sand; fix the six deferred minors.
- Fix the `verify.sh` nondeterminism: commit share cards rendered by one pinned
  environment, or make rendering deterministic.
- **Done when:** PR merged, `verify.sh` green on a clean checkout, media live with captions.
- Effort: S.

### Phase 1: Foundations (no framework change)
- Vendor GSAP; hero and scroll motion with reduced-motion fallback.
- Performance budget in CI (Lighthouse on throttled Android profile).
- Move journey and drafts to IndexedDB with migration from localStorage, plus an outbox.
- Event schema wired through the outbox; Umami self-hosted later (Phase 4).
- Cloudflare in front of the domain.
- **Done when:** budget enforced in CI, old localStorage data migrates losslessly (tested), events survive offline.
- Effort: M.

### Phase 2: Frontend migration (strangler)
- Needs D1 and D2. Spec first.
- Order: Explore and Routes, then Stories and Collections, Journey, Creator Studio, route pages last.
- Same URLs and prerender output at each step; Playwright and unit suites stay green; shadcn only where interaction needs it.
- **Done when:** each migrated page passes its existing e2e tests and the JS budget.
- Effort: L (weeks).

### Phase 3: Offline-first walking
- Route packs: bundle format, versioning, download manager, storage budget, update flow.
- Opus audio per stop (24 to 32 kbps) with offline text-to-speech fallback.
- Corridor raster tiles per route; keep Leaflet.
- Service worker: update prompt, range-safe media, cache pruning.
- **Done when:** a downloaded route plays audio and shows map and stops in airplane mode (e2e), with size per route reported.
- Effort: L.

### Phase 4: Backend and infrastructure
- Each step needs an approved infra spec and a yes before provisioning.
- Oracle Hyderabad: VM (retry ARM capacity or start small), Caddy/nginx media origin, firewall, backups to S3.
- Self-hosted Umami and listmonk on the VM.
- AWS: budget alarms first, then narration batch pipeline, S3 backups, SES.
- Supabase: schema and row-level security for community tables.
- Infrastructure as code so the VM is replaceable.
- **Done when:** the site works with the VM stopped (fallback verified), backups restore in a drill, alarms fire in a test.
- Effort: M.

### Phase 5: Community features (from the 21st.dev review)
1. Community photos with a map view, per stop, moderated.
2. Local-first sync of journey across devices.
3. Ask a local: Q&A on stops, creator and resident answers.
4. Newsletter and city-alert signup.
5. In-browser image compression in Creator Studio.
- **Done when:** each ships behind a flag with moderation and privacy review.
- Effort: L, per feature M.

### Phase 6: Later
3D globe landing, guided-walk booking, SEO audit workflow.

## Dependencies

Phase 0 → 1 → (2 and 3 can overlap after 1) → 4 → 5. Phase 4's Oracle and
Cloudflare pieces can start after Phase 1 if route packs (Phase 3) need an origin.

## Risks

- AWS credits expire (typically 1 to 2 years): budget alarms, cheap fallbacks, no credit-dependent hot path.
- Oracle may reclaim idle free VMs or close free accounts: replaceable by script, backups off-Oracle.
- Full React migration may hurt low-end phones: enforce the JS budget per page.
- ARM capacity in Hyderabad may be unavailable for days.
- Community features need moderation and privacy work, not only code.

## Success measures

- Cold load of the home page under 3 s on throttled mid-range Android.
- A downloaded route works fully offline.
- Walkers on 2G or offline lose no journey data or events.
- Infrastructure cost after credits under an agreed monthly cap (set in Phase 4).

## Next step

Answer D1, D2 and D4, then I write the Phase 1 spec for approval.
