# ops: the Startup Operating System in this repository

Phase 1 of the Startup Operating System plan (kept outside this public repository): the stores and rules that
let the loops run without anyone's opinion standing in for evidence. Nothing in
this folder changes the website.

**One rule runs through it: nothing moves forward on an agent's opinion. Every
gate reads a source-linked ledger, and anything irreversible waits for the
founder.**

| Path | What it is |
|---|---|
| `evidence/ledger.jsonl` | The evidence ledger. One line per claim: source, verbatim quote, date, origin, tier. Empty: no interview has been logged yet. |
| `backlog/opportunities.json` | Problems worth solving, each linked to ledger entries and one outcome metric. Empty. |
| `decisions/decision-log.jsonl` | Every gate result, who approved it, why. D-0001 is the proposal to adopt Phase 1 and is **waiting for the founder**. |
| `guardrails.json` | Autonomy tiers, the 16 agent roles (all at Tier 1), and which action needs which tier. The daily cost cap is `null` until the founder sets it. |
| `lib.mjs` | The rules as code: validation, gate G1, "may this role do this". |
| `stranger-test.md` | The weekend stranger test: protocol and observation log. Not run yet. |
| `test/` | Tests for the rules and for the offline event queue. |

Elsewhere: `scripts/ops.mjs` (command line), `app/events.js` and
`docs/event-schema.md` (offline-safe event queue, not wired into any page),
`.claude/skills/{evidence-ledger,agent-guardrails,event-schema}` (how an agent
uses all of this), `.github/workflows/ci.yml` (the checks every change passes).

## Commands

```bash
node scripts/ops.mjs validate           # every store is well formed
node scripts/ops.mjs gate G1 O-001      # may this opportunity enter the backlog
node scripts/ops.mjs can qa open_pr     # may this role do this alone
node scripts/ops.mjs scan               # no key committed in any tracked file
node --test "ops/test/*.test.mjs"       # the rules' own tests
```

## Evidence tiers

| Tier | Meaning |
|---|---|
| T0 | Opinion, including simulated users |
| T1 | Stated intent ("I would use this") |
| T2 | Past behaviour |
| T3 | Time or reputation commitment |
| T4 | Money or signed pilot |

Gate G1 (into the backlog) needs T2 or better from 3 or more independent origins,
one named metric, a passed compliance check, and every red-team kill point
answered with evidence.

## Stop rule

Do not start building features (Phase 3) until Phase 2 produces at least one T3
commitment from a site, board or sponsor. If Phase 2 produces no T3 evidence
after 20 interviews, the answer is to re-segment or stop, not to build more.
The offline route bundles, the creator backend and accounts on the responsive
rebuild's list (`docs/progress-report.md`, section 6) are features: each needs a
ledger entry and a G1 pass first.

## What this is not

- It is not evidence. The ledger is empty on purpose. Nothing was written into
  it to make a gate pass.
- It does not collect analytics. `app/events.js` is not loaded by any page.
- The repository is public. No names, phone numbers, emails or keys go in any
  file here; the validator rejects the obvious ones, and interview ids
  (`INT-001`) stand in for people.
