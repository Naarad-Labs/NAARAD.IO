# Weekend stranger test

> Provenance: first draft written by a free model through the FreeLLMAPI gateway
> (`dots-studio/dots-3-note-preview:free`, 2026-10-26), then corrected and extended by
> Claude. Human review: **pending** (the founder). Nothing here has been run yet.

## 1. Purpose

Find where a first-time visitor gets stuck on naarad.io. What you collect is usability
evidence. It is not proof that anyone wants to pay, and it does not go in the ledger as demand.

## 2. Setup

- A low-end Android phone on a slow or throttled connection (browser developer tools can
  throttle a desktop browser as a second run, but the phone is the test).
- A stranger is someone you do not know. No friends, family, colleagues or anyone under 18.
- At least 5 participants. Stop and fix before you run more of the same test.

## 3. What you say

Read this, then say nothing else until the tasks are done:

> "This is a website about walking routes at heritage places. I'll ask you to do three
> small things. You can stop at any time. I'm testing the website, not you. I won't write
> down your name, and I won't record or photograph anything unless you say yes."

## 4. Three tasks

1. Find a route near a place you already know.
2. Open a route and tell me what you think the numbered stops are.
3. Save a route, leave the page, and find it again.

Do not explain, point or rescue. If they are stuck, wait at least 60 seconds of silence
before you say "What are you looking for?", and write down that you said it.

## 5. What to write down for each task

- Time to first success (or "gave up").
- Wrong taps: taps that did not lead toward the goal.
- Words they said out loud, exactly as said.
- The exact place they hesitated.

## 6. After the tasks: ask about the past, not the future

1. Tell me about the last time you planned a visit to a heritage site.
2. Tell me about the last time you looked for a walking route in a place you did not know.
3. Tell me about the last time you saved something on your phone and then had to find it again.
4. Tell me about the last time you got lost using a map on your phone.

Do not ask "would you use this", "would you pay" or "do you like it". Those answers are
opinion (T0) and say nothing about what people do.

## 7. Observation log

One row per participant per task. No names, phone numbers or photos.

| Participant | Date | Device | Network | Task | Result | Wrong taps | Verbatim quote | Hesitated at | Severity |
|---|---|---|---|---|---|---|---|---|---|
| P1 | | | | | | | | | |
| P2 | | | | | | | | | |
| P3 | | | | | | | | | |
| P4 | | | | | | | | | |
| P5 | | | | | | | | | |

Severity: 1 = slowed them down, 2 = nearly gave up, 3 = gave up or could not finish.

## 8. Where results go

- Everything above stays in this log. It tells you what to fix.
- An answer to a question in section 6 goes in `ops/evidence/ledger.jsonl` only when the person
  describes something they **actually did** (tier T2), **committed to** with time or an
  introduction (T3), or **paid or signed** for (T4). Copy their words exactly into `quote`.
- Give each participant an interview id (`INT-001`, `INT-002`, ...) and use it as the `source`.
  The id is the only thing that links the entry to the person, so keep the key to who they were
  out of the repository: it is public.
- Run `node scripts/ops.mjs validate` before you commit. An entry without a source, quote, date
  and tier is rejected.
