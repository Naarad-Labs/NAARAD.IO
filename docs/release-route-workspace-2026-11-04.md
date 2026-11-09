# Public route workspace release

User authorized merge and deploy in this chat on 2026-11-04. Scope: NAARAD.IO GitHub Pages only; preserve app.naarad.io and AWS.

Baseline: origin/main d76f49f. Original feature branch remains intact at cc0c148. Selectively integrate its native map/stop-list dialog, elevation model and geographic cursor, accessible marker refresh and playing state. Preserve main discovery/catalogue separation, filters, collections, gallery/lightbox, lazy map tiles, GPX, print and hash-target focus. Do not replace those with older branch implementations.

## Verification before merge

- `VERIFY_ALLOW_UNCOMMITTED=1 bash scripts/verify.sh`: all five stages passed; deterministic rebuild, sitemap/cache/meta/links, 208 unit tests passed (12 skipped), practical facts, 160 browser tests passed, no flaky tests.
- Operations validation, secret scan, interview lint and 145 operations tests passed.
- Database migration/RLS suite: 14 tests passed against local PGlite; no deployed database changed.
- `git diff --check`: passed.
- Independent source review: preserved main features and exported map loaders. Fixed the reviewer’s stale profile-cursor finding; the new regression failed before the fix and passed after it. The assertion compares the cursor with the slider’s actual stepped value.
- Final two-axis review: no documented-standards violations; spec review found pointer-exit/refocus selection loss, reproduced in a failing browser regression and fixed by retaining the inspected distance. The full five-stage gate passed again with the added regression.
- Service-worker cache moves from v44 to v45 and precaches both new modules.

The original branch remains available. Its alternative catalogue, preview and gallery implementations are not wholesale merged over the newer released implementations; additional multi-select/offline catalogue behavior remains outside this scoped release.

GitHub CI and live Pages verification will be checked after pushing this commit; do not treat these local checks as a deployment claim.
