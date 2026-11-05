# Using the free-model gateway: when, how, and when not

The gateway is the owner's FreeLLMAPI endpoint (`127.0.0.1:31415`), which pools several providers' free tiers behind one OpenAI-compatible address. This page says where it is worth using. It refines D-0002 (token spend is unbounded, free models first) and follows D-0010 (the founder's instruction of 2026-11-02 to set these guidelines). Where it and the runbook differ, the stricter rule wins.

## 1. The rule of thumb

Use the gateway only when **all three** are true:

1. The output is big enough to pay for the overhead: about 80 lines of code or 300 words, or several small pieces batched into one request.
2. **A check can judge it**: tests written first, a linter, or a build that fails. The check is the verdict, never the model's own claim.
3. Nothing in the request is on the never-send list below.

| Good fit | Poor fit: write it directly or have Claude do it |
|---|---|
| A module written against tests that exist and fail first | Any fact: a date, a rule, a figure, a name, a legal or grant claim |
| Mechanical drafts you will read anyway (guides, release notes over about 300 words) | Small edits, one-line fixes, short messages, PR text under about 300 words |
| Bulk transformations with a clear before/after | Security-sensitive code (sign-in, row level security, payments, secrets) unless Claude then reads every line |
| Independent files that can be written at the same time | Wording that needs the founder's judgement: consent text, pricing, copy about places or people |
| | Anything a lint cannot judge and a person would read as slowly as write |

## 2. Never send

The gateway forwards to third-party free providers whose data policies are not verified. So never send:

- Investor, legal, bank, incorporation, tax or grant documents, and anything in the owner's private `Docs` folder outside this repository.
- Names, emails, phone numbers, interview notes or anything that identifies a person.
- Keys, tokens, passwords, connection strings, `.env*` files, `settings.json`.
- The evidence ledger once it holds real entries.

The helper `~/.local/freellm/gen.py` refuses files that look like these. That guard is a net, not the control: it has had false positives and can have false negatives. The person sending is the control.

It runs on the owner's machine only (`risk:local-llm` in `GOVERNANCE.md`). Nothing under `app/` or `sw.js` may call it, and `tests/no-local-llm.test.mjs` enforces that.

## 3. How to use it well

- **Tests first.** Write the spec as tests that fail, run them to see them fail, then ask for the code. A test that already passes proves nothing.
- **Send little.** Attach the test file plus only the signatures the new file touches, not whole neighbouring files. A 900-token file has cost over 8,000 tokens when the context was large. The helper refuses over 60 KB of context.
- **Marked answer.** Ask for the file between `<<<FILE>>>` and `<<<END>>>`, with a generous output limit. Free reasoning models think out loud and can run out of room before the answer.
- **Three rounds at most.** If the check still fails, stop and write it directly: the spec or the tests were not clear enough.
- **Fail over, do not repeat.** After two 502 errors, switch to a different model; retrying the same route has lost ten minutes before.
- **At most four requests at once**, for independent files only. Concurrency saves waiting, not tokens, and free tiers throttle per provider.
- **Read what comes back.** Run the whole suite, read the diff, and read every line of security-sensitive code.
- **Say so.** A file or commit written this way says "written by the gateway against tests written first, reviewed by Claude". Prose drafts say how much was rewritten.

## 4. Switching it off, and when to stop

- **Off switch:** `NAARAD_NO_GATEWAY=1` in the environment, or an empty file `~/.local/freellm/DISABLED`. The helper then refuses to run.
- **Stop using it for a kind of task** when three tasks in a row needed more than two rounds, or more than half of the output was rewritten. Write that kind of task directly.
- **Stop all use** if a provider's terms change, if sensitive material was sent by mistake (tell the founder at once), or if the gateway fails more than three times in a row.
- Do not use free quotas to power anything a visitor touches. The gateway's own guide advises against using free tiers for a production service.

## 5. Measure and report honestly

- The helper appends one line per run to `~/.local/freellm/log.tsv` on the owner's machine (time, output file name only, model, rounds, passed, requests, tokens, context size). No content is logged. It is not in the repository.
- The helper's token figures are a before-and-after difference of the gateway's counter, so they can include anyone else using the gateway on this machine at the same moment (a one-round run once showed two requests). Treat them as upper bounds.
- The gateway's counter measures only what scripts send it. A session's own planning, review and git work does not appear in it. Report the gateway as "tokens of generated work", never as a share of the whole session, and never claim a 90/10 split of everything.
- A fair first measure from this repository's use so far: about 12% of the tokens the gateway counted ended up in something used. Code written against tests was usable nearly as written; prose needed about 30 to 50% rewriting; nothing was used for facts.

## 6. Not done yet

- A short benchmark of the models behind the gateway on five small tasks, to pin a default and a fallback instead of `auto`.
- A concurrent mode in the helper for independent files.
