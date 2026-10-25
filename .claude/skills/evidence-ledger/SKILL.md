---
name: evidence-ledger
description: >-
  Reads and writes Naarad's evidence ledger, opportunity backlog and decision
  log, and computes gate G1 (into the backlog). Enforces source, verbatim
  quote, date, origin and tier on every claim. Use when the user says "log this
  interview", "add evidence", "is this ready for the backlog", "check G1",
  "what do we actually know", or before anything is proposed as a feature.
---

# evidence-ledger

The files are `ops/evidence/ledger.jsonl`, `ops/backlog/opportunities.json` and
`ops/decisions/decision-log.jsonl`. The rules are code in `ops/lib.mjs`; the
command line is `scripts/ops.mjs`. Nothing moves forward on an agent's opinion.

## The rule

**A claim without a source, a verbatim quote, a date and a tier is deleted, not
tidied.** Never write a number into the ledger that you did not read in the
source. Never raise a tier to make a gate pass.

## Tiers

| Tier | Meaning | Example |
|---|---|---|
| T0 | Opinion, including simulated users | "I think tourists want this" |
| T1 | Stated intent | "I would use this" |
| T2 | Past behaviour | "Last season we hired 4 guides by hand" |
| T3 | Time or reputation commitment | Agrees to a site visit; makes an introduction |
| T4 | Money or signed pilot | Pays, or signs a pilot |

A simulated user is always T0. A demo that went well is not evidence.

## Adding an entry

1. Append one JSON line to `ledger.jsonl` with `id` (next `E-nnnn`), `claim`,
   `source` (a URL, or `INT-nnn` for an interview), `quote` (their exact words),
   `date`, `collector`, `origin` (the independent party: an organisation or a
   person, spelled the same way every time) and `tier`.
2. Run `node scripts/ops.mjs validate`. Fix what it names; do not weaken the rule.

Three entries from one organisation are one origin, not three.

## Gate G1

An opportunity may enter the backlog (`status: "backlog"`) only when
`node scripts/ops.mjs gate G1 O-nnn` passes:

- T2 or better evidence from 3 or more independent origins;
- one named outcome metric;
- the compliance check passed (`compliance.status: "passed"`);
- a red-team review has run (`redteam.reviewed_on`), and every kill point it
  raised is answered by a ledger entry.

Write the result to the decision log (`gate: "G1"`) with the evidence ids.
G2 and G4 are the founder's: they pass only with `approved_by` filled in by a
human, and never by the author of the decision.

## Never

- Invent or round a quote. Paste it.
- Put names, phone numbers or contact details in the repository. It is public.
  The `INT-nnn` id is the only link, and the key stays offline.
- Mark your own decision approved.
