---
name: feature-intake
description: >-
  Turns opportunities into a scored backlog and blocks anything below T2
  evidence or without a metric. Use when the user says "what should we build
  next", "prioritise", "score the backlog", "add this to the backlog", or when
  someone proposes a feature.
---

# feature-intake

`node scripts/ops.mjs intake` ranks `ops/backlog/opportunities.json`. The rules
are `intake` and `evidenceFactor` in `ops/lib.mjs`.

## Score

`score = evidence tier x reach x expected metric move / effort`

- **Evidence tier:** for each independent origin take its best entry, keep the
  three strongest origins, and use the **weakest** of those three. A proposal
  rests on its thinnest leg, not its best quote. T2 = 2, T3 = 3, T4 = 4.
- **reach:** how many people or organisations have the problem.
- **expected_move:** the fraction the named metric should move (0.25 is +25%).
- **effort:** person-weeks.

These weights are a heuristic, not a measurement. Recalibrate them each quarter
against what actually moved, and say so when you report a ranking.

## An opportunity is blocked, not scored, when

- the best evidence is below T2, or fewer than 3 independent origins reach T2;
- there is no named outcome metric;
- `estimates` is missing, not above zero, or `estimates.basis` cites a ledger
  entry that does not exist. Every number says where it came from.

## Adding one

1. Make sure the evidence is in the ledger first (`evidence-ledger` skill).
2. Add the opportunity with `status: "candidate"`, one `metric`, its `evidence`
   ids and `estimates` (`reach`, `expected_move`, `effort`, `basis`).
3. Run the `redteam` skill, answer every kill point, set `redteam.reviewed_on`
   and `compliance.status: "passed"` once the compliance check is done.
4. `node scripts/ops.mjs gate G1 O-nnn`. Only a pass lets you set
   `status: "backlog"`; `validate` rejects a backlog item that fails G1.

## Choosing

`intake` marks the top three. The founder picks from those and logs the choice
in the decision log (gate G2 is the spec and kill rule, also the founder's).
At most two features are in flight at once. Nothing here starts a build.
