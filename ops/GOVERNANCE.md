# Governance in one page

## G1 gate (item 24)
A feature or opportunity passes G1 when the ledger holds evidence at tier T2 or better (past behaviour, not opinion) from at least 3 independent origins, each with a source, verbatim quote and date. `node scripts/ops.mjs gate G1 O-nnn` decides; no one's opinion is in the loop. Until then the only way to build is a founder override (a decision with `result: override`, an approver, a scope and an expiry). Worked example: F-001 has no evidence, so it runs on override D-0004 (expires 2026-11-26) and stays behind a flag.

## Cloud-spend guard (item 21)
Cap: Rs 1,000 total (D-0003). Spent to date: Rs 0.

| Date | Service | Rs | Logged in |
|---|---|---|---|
| (none yet) | | 0 | |

Any paid service needs a row here and a decision-log entry before its config lands in the repo. Token spend is unbounded (D-0002).

## Risks (items 22, 23)
- risk:sarvam-403 (first seen 2026-10-26): Sarvam translate, TTS, STT and chat return 403 from the cloud environment. Every roadmap item that needs Sarvam is blocked until the founder reconnects the connector. Find them with `grep -i sarvam ops/product/ROADMAP-1000.md`.
- risk:local-llm: the free OpenAI-compatible endpoint (127.0.0.1:31415) runs on the owner's machine only. Nothing under `app/` or `sw.js` may call it; `tests/no-local-llm.test.mjs` fails the build if they do.

## Register reconciliation (item 16)
F-001 (building, no flag yet): sign-in screen in `app/views/` behind the account flag, migrations in `supabase/`. F-002 (flagged, `naarad.flag.offline-bundles`): `app/offline-*` and `sw.js` bundles cache. Each row's `tests` list is checked to exist by `ops.mjs validate`.

## Public visibility (item 17)
Open decision for the founder: `ops/`, `docs/`, `replica/` and `supabase/` are served by GitHub Pages at naarad.io. Until decided they are public, so nothing private (keys, contacts) may live there; `ops.mjs scan` enforces this.

## Weekly note (item 26)
Add one entry per week to `ops/product/REPORT.md`: gate changes, spend, stale evidence.
