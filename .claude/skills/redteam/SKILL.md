---
name: redteam
description: >-
  Runs a fresh-context red-team review of an opportunity: a reviewer that sees
  only the ledger entries behind it, argues the strongest case for killing it,
  and scores five criteria twice with the evidence shuffled. Use before an
  opportunity goes into the backlog, when the user says "red team this",
  "argue against it", "is this really proven", or "what would kill this".
---

# redteam

Runs `node scripts/redteam.mjs O-nnn`. It writes `ops/redteam/O-nnn-<date>.md`.
The reviewer must not share the builder's memory: it is sent the ledger entries
linked to the opportunity, the title and the metric, and nothing else. No repo,
no plan, no case for building it.

## Run it

```bash
node scripts/redteam.mjs O-001 --dry-run     # read exactly what would be sent
FREELLMAPI_API_KEY=... node scripts/redteam.mjs O-001
```

The endpoint is FreeLLMAPI at `http://127.0.0.1:31415` unless
`FREELLMAPI_BASE_URL` says otherwise. A model from another family than the one
that built the work is the point, and a free model behind the gateway usually
is one. Read the key from your own settings inside the command; never print it
or write it to a file.

## What to do with the result

1. Read the **Stability** section first. If the two passes disagree on the
   verdict, or a score moved by more than 1 when the order changed, those
   numbers were not measuring the evidence. Say so; do not average them.
2. Check each kill point against the entry ids it cites. Points the model
   cited without evidence are the ones that matter most: they are the gaps.
3. Copy the surviving kill points into `redteam.points` on the opportunity.
   For each, find a ledger entry that answers it and list its id in
   `answered_by`. If no entry answers it, the point stands: go and get that
   evidence, do not argue it away.
4. Only then set `redteam.reviewed_on`. Then `node scripts/ops.mjs gate G1 O-nnn`.

## Never

- Treat the model's verdict as a gate result. It prompts a person to think.
- Send it anything beyond the linked entries. The runner refuses an entry that
  holds a phone number, an email address or a key.
- Let the same agent that built the case run and approve the review.
- Rerun until the verdict changes. If you rerun, keep both reports.
