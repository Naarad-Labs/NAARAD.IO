# Runbook: completing the product from the 1,000-point roadmap

Any session, human or agent, that starts here follows this file. It is written so a run that is cut off (token limit, container restart, timeout) loses at most one small batch, and the next run picks up from the repository alone. Nothing depends on a conversation.

Authority: decision D-0007 (founder, in chat, 2026-10-27). Limits are in `ops/guardrails.json` and D-0003; where this file and the guardrails differ, the stricter one wins.

## Files

| File | What it is |
|---|---|
| `ops/product/ROADMAP-1000.md` | The 1,000 items. Do not renumber. Fix a wrong item by adding a dated note under it. |
| `ops/product/PROGRESS.md` | One row per item: status, tags, note. Edit only through `progress.mjs`. |
| `ops/product/progress.mjs` | `summary`, `next [n]`, `set <id> <status> [note]`, `unblock <tag>`, `lock acquire\|release\|status`. |
| `ops/product/REPORT.md` | The running report to the founder: newest run on top, plain words. Create it on the first run. |

## Start of every run

1. Get the repository: clone `Naarad-Labs/NAARAD.IO` (use `add_repo` with push access if it is not present). `git fetch origin`; work from `origin/main`.
2. `node ops/product/progress.mjs lock acquire <session>`. Exit code 3 means another run is active (lock younger than 90 minutes): stop, with one line saying so. The lock is a heartbeat; refresh it by committing PROGRESS.md at least every hour of work.
3. `node ops/product/progress.mjs summary`, read the top of `REPORT.md`, and list open pull requests. Finish or merge open work before starting new items. An item left `doing` by a dead run: check its branch; if the work is verified, mark it `done`; otherwise reset it to `todo` with a note.
4. Re-test the blockers that can change: Sarvam (`GET https://api.sarvam.ai/v2/models` must return 200; then `unblock needs-sarvam`), and the free-model gateway. Read `README.md` and the files named by the next items before editing.

## The loop (small batches)

Repeat until stopped or out of unblocked items:

1. `node ops/product/progress.mjs next 5`; choose a coherent batch (one theme, one to five items, one PR).
2. Check each item against the stop rules below. Park it (`set <id> parked "<action>"`) or leave it blocked rather than guessing.
3. `set <id> doing`; branch `product/<short-topic>` from `origin/main`.
4. Do the work. Match the surrounding code. Honesty rules apply (below). Prefer deleting to adding.
5. Verify: `bash scripts/verify.sh` (once it exists on `main`: builds twice and compares, node tests, practical-facts linter, browser tests), `node scripts/ops.mjs validate`, `node scripts/ops.mjs scan`, `node --test "ops/test/*.test.mjs"`. Never weaken a test to make it pass; fix the cause.
6. Commit with explicit paths; `set <id> done "<PR or commit>"`; include PROGRESS.md in the same PR; push; open a PR.
7. Merge when every CI check is green (D-0007: no flag is required for merge, but use one for anything risky or large; a flag defaults off). Never force-push, never rewrite history, never bypass a failing check, never merge red.
8. After a merge, curl the live pages touched (GitHub Pages can take a few minutes) and confirm 200 and the right content. If anything is broken, revert the merge first, then investigate.
9. Prepend three lines to `REPORT.md` (done, blocked, needs the founder); commit and push.

Commit after every item. An interrupted run leaves a clean tree and a PROGRESS.md that matches `main`.

## End of run

`node ops/product/progress.mjs lock release`; commit and push PROGRESS.md and REPORT.md; finish with a short report: items done this run, items blocked and by what, the next five items, anything the founder must do.

## Stop rules (hard; D-0007 does not waive these)

- Park the item (`parked`) and move on when it would: change payments, auth, privacy or pricing; run a destructive migration or delete data; wire analytics into pages; spend above the Rs 1,000 cloud cap (D-0003); change anything at a monument on site; write to a production database outside a migration; send email or post as the founder; touch backups. These are the `ask` and `never` actions in `ops/guardrails.json`; nobody is present to answer an `ask`, so the item waits for the founder.
- Blocked tags are waiting on someone else, not on effort: `needs-owner-account`, `needs-sarvam`, `needs-devices`, `needs-lawyer`, `needs-human-reviewer`, `needs-budget`, `needs-decision`, `needs-evidence`, `later`. Do not work around them.
- Never put a key, token, password or private URL in a file, commit, PR, log or report. Secrets arrive as environment variables only. `node scripts/ops.mjs scan` must pass.
- Work outside the roadmap is not covered by D-0007. A user-visible feature must be registered in `ops/features/features.json`.

## Honesty rules (the site's own contract)

Nothing fills a gap with a plausible-looking number. The site has no recorded narration, no accounts, no app and no paid plans until the matching feature is live and verified; copy says what is true today. Every fact shown to visitors has a source and a checked date. AI-generated text or audio is labelled and has English source text; machine translation is labelled unreviewed. Photos need a licence that allows use and visible credit.

## Tools

- Free-model drafts go through the FreeLLMAPI gateway first (D-0002); everything it writes is read and verified before use; facts are never taken from it.
- Sarvam: `https://api.sarvam.ai`, credential injected by the environment, no Authorization header. Keep inside D-0003 and log spend in the report.
- Installed skills (Impeccable, taste, UI UX Pro Max, Emil Kowalski's motion skills) advise; the owner's mockup tokens and the tests decide. Playwright and Figma MCP are in `.mcp.json`.
- Sub-agents are fine for independent review or isolated files: one writer per file, and review everything they produce.

## When the limit hits

Nothing special. The scheduled routine fires again; the next run follows this file from the top. Do not rush a half-done item: leave a note in PROGRESS.md and stop.
