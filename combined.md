# Naarad: Scalable Routes and Sarvam Integration

Date: 5 November 2026

Status: Combined requirements brief; implementation and cloud deployment are not implied by this document.

## 1. Goal

Support importing and publishing at least 1,000 routes without downloading the whole detailed catalogue for each visitor, and integrate Sarvam capabilities into clear traveller, creator and editor workflows.

Keep the public website fast, preserve existing maps/listening/Journey/offline behavior, and give both websites one consistent published route catalogue.

## 2. Verified starting point

### Public website — NAARAD.IO

- `app/data.js` currently combines `content/routes.json`, `discover/seed-tours.json` and `routes/geo-tracks.json` into one in-memory catalogue.
- Editorial source content lives in `content/routes.source.json`; `scripts/build-routes.py` generates the runtime route file.
- The catalogue loader fetches the complete datasets. Its promise is reused during navigation; HTTP/browser/service-worker caching may reduce repeat transfers. This does not mean every image or audio file is downloaded immediately.
- Routes are not currently established as a paginated, database-backed public catalogue.

### App/backend — NAARAD-APP

- `db/migrations/0003_catalogue.up.sql` defines PostgreSQL tables including `routes`, `waypoints`, `stories`, `photos` and `practical_facts`. Route paths and stop locations use PostGIS geography.
- The presence of migrations does not prove that a deployed database contains the public catalogue. Deployment, import completeness and live API behavior need verification.
- `naarad/sarvam.py` contains transcription, translation, chat and text-to-speech adapters.
- `api/app.py` exposes `/v1/guide` and `/v1/ask`; `naarad/guide.py` supplies route-grounded guide logic.
- In the inspected app configuration, `web/app/config.js` has an empty `VOICE_API_BASE` and `ACCOUNT_API_BASE`. Account entry remains subject to backend readiness.
- The Sarvam development key was saved and its existence verified in this Mac's Keychain under service `io.naarad.sarvam.dev`, account `naarad`. Its value is not included here. No Sarvam request or AWS secret upload was performed during that setup.

## 3. Architecture and boundaries

| Component | Responsibility |
| --- | --- |
| PostgreSQL/PostGIS | Canonical route metadata, ordered stops, publication state, language versions, ownership and spatial queries |
| Object storage | Original uploads, photos, generated narration, track files, document outputs, video outputs and versioned offline bundles |
| Naarad API | Public catalogue queries, route details, authenticated creator/editor actions, voice requests and job status |
| Background workers | Bulk validation/import, transcription, translation, narration generation, document processing and dubbing |
| CDN and browser cache | Reuse published summaries and versioned public assets |
| Sarvam | Requested speech, text, document and media processing through server-side credentials |
| Public site and app | Discovery, route reading/listening, walking, creator editing and review interfaces, using shared identifiers |

Existing schema/infra is the starting point. Inspect it before adding tables or services; avoid a parallel catalogue that duplicates route ownership. Queue and worker technology must be selected against verified hosting capabilities and the approved budget.

## 4. Requirement A: Route storage, discovery and bulk upload

### A1. Load only what the visitor needs

| Visitor action | Required response |
| --- | --- |
| Open Explore | A bounded page of route summaries, initially 30 by default |
| Search/filter | Server-filtered summaries with a stable next-page cursor |
| Move map | Bounded markers or clusters for the visible map area and zoom |
| Open route | Only that route's published detail and language availability |
| Open story/listen | Selected story or audio asset, loaded on demand |
| Download offline | Explicit download of one selected route/language bundle, with size shown first |

Summary fields: stable ID, slug, name, location, thumbnail reference, distance, duration, difficulty, themes, start/centroid coordinates, published language availability and content version. Unknown facts remain null and receive honest UI labels.

Exclude full stop stories, detailed polylines, elevation samples, transcripts and audio bodies from summary responses. Media references are URLs/asset identifiers, not inline base64 data.

### A2. Proposed API contracts

These endpoints are proposed, not existing functionality. Reconcile naming with the current API during implementation.

| Endpoint | Contract |
| --- | --- |
| `GET /v1/routes` | `q`, filters, `lang`, `limit`, `cursor`; returns `{items, nextCursor}`. Default limit 30; maximum 100. Use deterministic ordering with a stable tie-breaker. |
| `GET /v1/routes/map` | Validated `bbox`, zoom and filters; returns markers/clusters with an explicit bounded response. Initial maximum 500 features; aggregate or request zoom-in instead of silently dropping routes. |
| `GET /v1/routes/{slug}` | Published route detail, version, ordered stops, geometry provenance, available languages and references to larger assets |
| `GET /v1/routes/{slug}/bundles` | Published bundle versions, language, download size, checksum and availability |
| `POST /v1/imports` | Authenticated creator/editor starts an import using a previously uploaded manifest/object reference and idempotency key |
| `GET /v1/imports/{id}` | Owner/authorized editor sees progress, per-record outcomes and validation report |

Preserve route-page URLs and existing Journey identifiers. Public unauthenticated queries must return published content only. Draft previews use authorized access and private caching rules.

### A3. Bulk import workflow

1. Download an import template or use an equivalent structured route editor.
2. Upload a CSV/JSON manifest plus referenced GPX/GeoJSON tracks and media. Large objects upload directly to storage through short-lived authorized upload URLs.
3. Create a background import job; the page can close and reopen without losing its status.
4. Validate required fields, route ownership, coordinates, track shape, field lengths, duplicate identifiers, media types/sizes, source attribution and licenses.
5. Produce a preview and per-record errors. Validation alone does not publish anything.
6. Save accepted records as drafts. Invalid records remain identifiable in the report; partial success must be explicit.
7. An authorized editor reviews and publishes selected route/language versions.
8. Publication updates catalogue caches and creates or refreshes relevant public assets and offline manifests.

Re-uploading a job must not duplicate routes. Use a stable external import ID scoped to the owner, an explicit create/update mode and conflict reporting. A matching name alone must not overwrite an existing route. Group each route's related writes atomically; one invalid route must not corrupt another route's import.

Apply upload quotas and archive expansion limits if ZIP packages are supported. Never execute uploaded content. Track geometry must retain its provenance: a line connecting stops must not be presented as a surveyed walking track.

### A4. Discovery, cache and migration behavior

- Keep search/filter changes cancellable so late responses cannot replace newer results.
- Map and list use the same filters; moving the map does not download every route's detailed track.
- Provide loading, empty, retry, unavailable and end-of-results states; support keyboard and screen readers.
- Use ETags and versioned assets for published content. Private drafts, recordings and account data must not enter shared caches.
- Bootstrap the database from current catalogue files, reconcile IDs/slugs/counts and verify complete route detail before switching either website.
- Introduce the API behind a flag. Preserve current static route URLs/prerendering and an explicit rollback path.
- Do not use silent stale/static fallback to conceal failed publication or missing records.

## 5. Requirement B: Sarvam in website user flows

Language, voice, model and channel availability must be checked for the actual account and service. Do not assume identical language coverage across every Sarvam capability.

| User flow | Website changes | Sarvam capability | Delivery group |
| --- | --- | --- | --- |
| Explore → route preview | Show actually published narration languages and an optional short sample | Translation and text-to-speech | Core |
| Route → stop → Listen | Language selection, transcript, playback controls, loading/retry states and an audio fallback | Text-to-speech | Core |
| Stop → type a question | Question form, concise sourced answer, uncertainty state and optional spoken answer | Grounded chat and text-to-speech | Core |
| Walk → ask aloud | User-started recording, recording indicator/timer, stop/cancel, editable transcript, answer playback | Speech-to-text → chat → text-to-speech | Conversation |
| Explore → voice search | Convert speech to an editable search query; retain normal text search | Transcription and language identification | Conversation |
| Search/local names | Match reviewed local-script and Roman-script aliases; distinguish transliteration from translation | Transliteration | Conversation |
| Download route | Language choice, bundle size, progress and version-aware updates | Pre-generated translations/narration | Core |
| Creator → upload recording | Upload progress, resumable job view, transcript correction and speaker labels | Batch transcription, diarization, speech translation | Creator |
| Creator → upload source document | Extracted text/fields, original-page reference, attribution and correction editor | Document intelligence | Creator |
| Creator → translate story/document | Source/translation comparison, terminology corrections and language-specific approval | Text and document translation | Creator |
| Creator → localize audio/video | Target language, script review, job progress and preview of generated media | Dubbing | Advanced creator |
| Creator → approved own voice | Consent record, permitted reference clip, preview and voice removal/revocation path | Voice cloning, currently documented as beta | Advanced creator |
| Editor → review | Original/translated content comparison, source evidence, pronunciation checks and approval history | AI-assisted draft summaries/tags, never automatic historical verification | Creator |
| Talk to Naarad / telephone guide | Separately designed conversational widget or telephony entry point and channel controls | Managed Voice Agents | Optional separate channel |

Managed Voice Agents is a separate product/integration from the existing model API adapter. Phone/WhatsApp access, account eligibility and pricing require separate confirmation. It is not necessary for the first website voice release.

### B1. Backend orchestration and secrets

- Browser requests go to Naarad's API; Sarvam credentials never enter frontend config, HTML, bundles, logs or repositories.
- Configure the development key securely on the chosen backend only after confirming the deployment target. Prefer the existing approved secret-management design; verify how runtime code reads the secret rather than assuming a secret name makes it available.
- Audit the existing adapter against current Sarvam contracts, response formats, model availability and service-specific limits before live tests. SDK installation is optional because a REST adapter already exists.
- Apply per-user/session/IP limits, upload-duration limits and per-job limits. Enforce a founder-approved spending cap and stop/disable behavior.
- Keep provider secrets and raw provider errors out of user-visible responses.

### B2. Content versions and generated assets

- Associate each translation/narration with route ID, stop/story ID, source version/hash, target language, voice, model and relevant generation settings.
- Reuse approved assets when the generation inputs match; invalidate stale versions when source content changes.
- Store processing state and asset references persistently. Do not rely on an in-memory API cache as the only record.
- Use job states such as `queued`, `running`, `needs_review`, `ready`, `failed`, `cancelled`; publication is a separate editorial decision.
- Track provider request/job identifiers and usage. Retry safely; local deduplication does not guarantee a provider will avoid charging twice for retried requests.
- Confirm storage/reuse rights for generated media and source uploads before enabling persistent publication/download.

### B3. Conversation and accuracy

- Ground answers in the selected route/stop's approved content and sources, not unrestricted model knowledge.
- State when an answer is not supported; distinguish historical evidence, local tradition and practical facts.
- Spoken-input confirmation permits users to fix misheard names before sending a question.
- Support interruption/cancel and avoid two players speaking at once.
- Evaluate latency before adding streaming. Verify streaming/WebSocket support across the actual deployed API, proxy/CDN and hosting path.
- Offline bundles play downloaded narration; live transcription and new Sarvam answers require connectivity. Preserve an explicit offline message and existing local listening fallback.

### B4. Upload permissions, privacy and moderation

- Server-enforced creator/editor roles control uploads, private job access and publication. Public listening need not require sign-in.
- Explain when a recording starts and where it is processed. Define retention for originals, transcripts, generated voices and derived media.
- Record voice-owner permission and permitted uses before voice cloning. Account access alone is not permission to clone another person.
- Include source attribution and original-versus-derived content relationships in editorial review.
- AI assistance can flag content or suggest tags; it cannot establish historical truth or grant publishing rights.
- Integrate cancellation, account deletion and required media deletion with object storage, job records and provider capabilities. Shared recordings and already published derivatives need an explicit policy before release.

## 6. Proposed delivery sequence

Each group should have its own small implementation plan and reviewable PRs. This brief does not authorize merging, deploying, new paid services or account/privacy changes.

| Phase | Deliverable | Prerequisites |
| --- | --- | --- |
| 0 | Inventory actual deployments; agree route/API contracts, limits, secrets and language/content decisions | Read-only environment verification and founder decisions |
| 1 | Paginated catalogue, spatial map queries, individual route detail and verified initial data import | Database/API readiness, compatible existing IDs and private draft permissions |
| 2 | Multilingual stop narration, typed grounded questions and downloadable reviewed audio | Secure server key, verified route content, storage and cost controls |
| 3 | Spoken questions, streaming where supported, voice search and reviewed transliteration aliases | Phase 2 plus microphone/retention decisions and hosting support |
| 4 | Bulk creator import UI, transcription/document jobs and translation review/publish workflow | Working creator/editor accounts, job processing, storage and deletion integration |
| 5 | Dubbing and consented voice cloning | Phase 4, rights/consent checks and confirmed account access |
| Optional | Managed conversational/telephone channel | Separate scope, channel access, operating budget and approval |

Backend catalogue and bulk-import foundations can be developed together. Once their interfaces are stable, public discovery UI and voice integration can proceed independently without competing ownership of the same files.

## 7. Inputs and actions needed from the founder

| Needed | Purpose/status |
| --- | --- |
| Sarvam key | Local Keychain setup complete; secure server installation remains outstanding |
| Initial languages and voice | Select a small first-release set and test pronunciation of real place names |
| Sarvam spending limit | Set daily/monthly amounts, test allowance and behavior when the cap is reached |
| Approved test route and recordings | Supply or approve factual stories, source references, pronunciation corrections and upload rights |
| Import ownership | Decide who may create/update routes and who may publish them |
| Content and voice permissions | Define creator license, voice-cloning permission, retention and removal rules |
| Backend deployment target/access | Verify actual API/database/storage readiness and authorize any specific deployment/IAM changes |
| Moderator onboarding | Define how editor privileges are granted and revoked before public submissions open |
| Optional services | Explicitly choose whether dubbing, voice cloning or managed telephony belong in a later release |

No new Google OAuth client is required solely to call Sarvam. Existing sign-in still needs its own readiness checks before opening account-dependent flows.

## 8. Acceptance checks

### Routes and import

- [ ] A fixture containing at least 1,000 representative routes does not cause the initial Explore request to contain the entire detailed catalogue.
- [ ] Initial list returns at most 30 summaries by default; cursor traversal has no duplicates/skips on an unchanged dataset.
- [ ] Proposed initial summary budget: at most 200 KiB gzip for a 30-result JSON response. Record actual measurements and ratify the budget before release.
- [ ] Map responses remain within the documented feature cap; dense areas aggregate and missing areas are never silently hidden.
- [ ] Route details, tracks, stories and audio are fetched on demand; opening one route does not fetch every other route's detail.
- [ ] Changing filters quickly cannot render an earlier response over the latest query.
- [ ] Invalid coordinates, duplicate imports, unauthorized updates, missing attribution and oversized uploads produce useful errors.
- [ ] Retrying an import does not duplicate records; accepted records remain drafts until authorized publication.
- [ ] Existing route URLs, Journey identities and offline selections survive the migration.

### Sarvam and user flows

- [ ] No credential value appears in frontend/network responses, repository files or logs.
- [ ] Live smoke tests use an approved small allowance and report which model, language and endpoint were actually exercised.
- [ ] Language labels distinguish published, processing, unavailable and planned content.
- [ ] Narration reuses matching approved assets; changed source content cannot keep serving an incorrectly labelled old version.
- [ ] Typed/spoken questions stay grounded; absent evidence produces an uncertainty answer.
- [ ] Denied microphone permission, misheard speech, lost connectivity, expired credits, rate limits and provider failure remain recoverable.
- [ ] Creator jobs survive page reload, expose status only to authorized users and cannot publish automatically.
- [ ] Translations, extracted documents and dubbed media support review/correction before publication.
- [ ] Voice cloning cannot proceed without the required permission record.
- [ ] Cancellation, retention and deletion behavior covers stored originals and derived assets.
- [ ] Offline narration works without a network; new cloud-generated answers are honestly unavailable offline.
- [ ] Keyboard, screen-reader, reduced-motion and phone-browser checks cover the new controls.

## 9. Rollout constraints

- Preserve the existing ChatGPT-hosted `app.naarad.io` deployment and its DNS; previews operate alongside it.
- Respect the workspace's Sydney Free-plan constraints. This document does not authorize Mumbai access, a paid upgrade, new spending, a production cutover or materially different infrastructure/IAM changes.
- Maintain existing functionality behind flags and verify deployed-service behavior separately from local/unit/schema checks.
- Keep API keys, private keys, CLI caches and Terraform state out of this document and repositories.
- Public launch requires actual service verification, content approval and a separate release decision.

## 10. Official Sarvam references

Capabilities and account availability can change. References were checked during this conversation on 5 November 2026; recheck model contracts, rate limits, terms and pricing when implementing.

- [Model/API overview](https://docs.sarvam.ai/api/getting-started/welcome)
- [Quickstart and key setup](https://docs.sarvam.ai/api/getting-started/quickstart)
- [Speech-to-text](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/overview)
- [Text-to-speech guidance](https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/best-practices)
- [Voice cloning](https://docs.sarvam.ai/api/api-guides-tutorials/voice-cloning/overview)
- [Document intelligence](https://docs.sarvam.ai/api/api-guides-tutorials/document-intelligence/overview)
- [Document translation](https://docs.sarvam.ai/api/api-guides-tutorials/doc-translation/overview)
- [Dubbing](https://docs.sarvam.ai/api/api-guides-tutorials/dubbing/overview)
- [Content Studio](https://docs.sarvam.ai/creative/studio-overview)
- [Managed Voice Agents](https://docs.sarvam.ai/voice-agents/overview)
- [Current pricing and credits](https://www.sarvam.ai/api-pricing)
