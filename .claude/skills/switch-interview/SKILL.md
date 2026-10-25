---
name: switch-interview
description: >-
  Runs and codes a switch interview: what the person did before, what made
  them change, what it cost, and what they gave you. Turns the notes into
  ledger entries with the right commitment tier. Use when the user says "I just
  spoke to", "log this interview", "code this conversation", or "what tier is
  this".
---

# switch-interview

A switch interview reconstructs a decision that already happened: what they used
before, what pushed them to look, what they compared, what it cost, who decided.
It finds out what people do, which is the only thing the ledger can use.

For a buyer who has not switched yet (most of Naarad's early conversations),
use the guide in `ops/interviews/` and treat "the last time we bought or ran
this" as the switch.

## During

- Ask for the timeline in order: first thought, first search, first spend, the
  decision, what happened after.
- Write their words exactly. The quote is the evidence; your summary is not.
- Do not pitch or describe a product, and do not react to ideas as if they were
  evidence. If they ask what you are building, answer in one honest sentence,
  then go back to their last time.
- Before the call ends, ask for one commitment from the guide.

## After: code it

Give each person an interview id (`INT-001`, `INT-002`, ...). The id is the
only link to the person; the key stays offline, never in this public repo. One
ledger entry per claim, with `source: "INT-nnn"`, the exact `quote`, the `date`,
`collector`, `origin` (the organisation, spelled the same way every time) and
the tier below.

| Tier | What they said or did | Example |
|---|---|---|
| T0 | An opinion, a compliment, a prediction | "This is a great idea" |
| T1 | Stated intent | "We would probably try it" |
| T2 | Something they actually did, with detail | "Last season we printed 4,000 maps and paid a guide each weekend" |
| T3 | Gave time or reputation | Booked a second call, made an introduction, shared a real document |
| T4 | Paid or signed | A paid pilot, or a signed letter of intent |

Rules of thumb: if it is about the future it is T0 or T1 whatever the tone; a
specific past event with a cost or a date is T2; a follow-up that is in their
calendar is T3; money moved or a signature is T4. A warm call with no ask is
one T0 entry.

## Then

1. `node scripts/ops.mjs validate`. It rejects a missing quote or source, a
   future date and any phone number or email.
2. Three origins at T2 or better for one problem is what opens gate G1. Three
   conversations in one organisation are one origin.
3. After 20 interviews with no T3 evidence, the system says re-segment or stop.
   It does not say build more.
