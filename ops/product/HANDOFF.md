# Naarad handoff (written 2026-10-31)

Cloud session: `session_01Xu9G6TdANvWPWKwvWfRDq4` ("Naarad.io responsive architecture").
Repo: https://github.com/Naarad-Labs/NAARAD.IO (live at naarad.io via GitHub Pages). Also attached: Naarad-Labs/NAARAD-APP (a separate Streamlit + Sarvam app).

## Where things stand

- **Merged (not by Claude):** [#26](https://github.com/Naarad-Labs/NAARAD.IO/pull/26) "Hallmark pass 1" (CSS only: plain labels, overflow clip, 3:1 field borders, no wrapping buttons, one dash removed, service worker v19). CI was green. No PR is open now.
- **Merged to main this week:** #22 governance gates (roadmap 13-18, 21-25), #23 sharper photos + better read-aloud voice, #24 Thanjavur photo fixed + placeholders, #25 creator accounts (send for review, delete my account) behind a flag.
- **Roadmap:** `ops/product/ROADMAP-1000.md`, progress in `ops/product/PROGRESS.md` (22 done, 784 todo, 193 blocked, 1 parked). Next unblocked: items 27-37 (verify.sh and CI). Run with `node ops/product/progress.mjs summary|next N|set N status "note"`.
- **Backend (F-001):** Supabase project is live and its tables are applied. Sign-in, send-for-review and delete-my-account are built behind `naarad.flag.accounts` (off for visitors; `?accounts=on` turns it on). G2 approved (D-0009). **G4 not passed.**

## Waiting on the founder

1. **Supabase dashboard:** switch OFF "Allow new users to sign up" (invite-only). Not possible from the cloud.
2. **Approve the consent wording** and the "18 or over" statement (current text in `app/account-ui.js`), and decide the 50-drafts-per-creator cap.
3. **Redesign decision** (Hallmark audit found 31 FAIL / 17 REFLEX; pass 1 only fixed the safe ones):
   - recompose home + route pages in full (changes the look approved against the 5 mockups), or
   - stop at pass 1, or
   - aim the redesign somewhere else.
4. **app.naarad.io:** currently an OpenAI-hosted "Sign in required" page. To serve this repo there, the DNS must be repointed (and the CNAME file changed, which would take naarad.io off Pages unless handled). Visitors must never need a ChatGPT account. Not done.
5. **Rotate** the Distribb and FreeLLM keys pasted in chat earlier. Never commit keys.
6. **Sarvam** (translate, TTS, STT) still returns 403: reconnect at https://claude.ai/customize/connectors, then start a new session. Blocks roadmap M1/M2 and real Indian-voice narration.
7. **Figma** needs sign-in.

## Tools the founder set up (not verified by Claude)

Cline (VS Code + CLI), Aider, FreeLLMAPI, n8n Cloud (naarad.app.n8n.cloud), Activepieces, MoneyPrinterTurbo. All run on the founder's machine or accounts, so the cloud session could not reach them. Rule: all tool-triggered AI requests use FreeLLMAPI only; no other providers. To verify n8n / Activepieces from the cloud, store their API keys as environment secrets (never in chat). Inbox Zero, WP-AutoInsight and CloudScale SEO: skipped (not set up / need WordPress).

## Hallmark (anti-slop design skill)

Source: https://github.com/Nutlope/hallmark. Reinstall locally: `npx skills add nutlope/hallmark`. Run `/hallmark audit <path>` or `/hallmark redesign <path>`. Rules to remember: keep content, URLs, prerender and offline wiring; no test edits to pass; ask before merging, deploying, deleting data, changing permissions or spending money. Audit output was in `.hallmark/` (gitignored, cloud only).

## Moving this to the Mac (what happened)

- Claude Code 2.1.314 is installed at `~/.local/bin/claude` and signed in.
- `~/.local/bin` had to be added to PATH.
- Remote Control and teleport fail because the shell has `ANTHROPIC_BASE_URL` set (FreeLLMAPI). Use, for that one command only:
  `env -u ANTHROPIC_BASE_URL -u ANTHROPIC_AUTH_TOKEN -u ANTHROPIC_API_KEY claude --teleport session_01Xu9G6TdANvWPWKwvWfRDq4`
  or `... claude remote-control` (then the cloud session can request the folder).
- Run from inside the NAARAD.IO checkout; commit or stash local changes first (teleport checks out `product/hallmark-floor-pass`).

## Working rules (from the repo's runbook and decision log)

- Karpathy guidelines + ponytail: smallest change that solves it; surgical edits.
- `bash scripts/verify.sh` must pass (build is deterministic and committed, unit tests, practical facts, browser tests). CI jobs `ops`, `db`, `site` must pass before merge. Note: CI's `site` job does not run `tests/*.test.mjs`; that gap belongs to roadmap 27-37.
- Cloud spend cap Rs 1,000 total (D-0003). Token spend unbounded (D-0002).
- Guardrails (`ops/guardrails.json`): auth, privacy, data, payments and production credentials are ask-first.
- Photos: `scripts/build-photos.py` (PINNED = named Wikimedia Commons files; PLACEHOLDERS = labelled own-artwork tiles for the palace, library, amphitheatre and visitor centre until real photos are found). Commons rate-limits the cloud IP; Openverse is unreachable from the cloud.

## Suggested first message in the new session

"Read HANDOFF.md. PR 26 is already merged. I choose: recompose home + route in full with Hallmark, or stop. Use FreeLLMAPI only for any tool-triggered AI."
