---
name: event-schema
description: >-
  Defines funnel events before they are built, including the offline queue and
  dedupe keys, and checks that instrumentation stays inside the schema. Use
  when adding or changing an analytics event, when the funnel undercounts rural
  or offline visitors, or before wiring any tracking into a page.
---

# event-schema

The spec is `docs/event-schema.md`. The code is `app/events.js`. The tests are
`ops/test/events.test.mjs`. Run them with `node --test "ops/test/*.test.mjs"`.

## The rule

**Define the event before you instrument it, and instrument it before the
feature ships.** A feature without its events cannot be judged at 2 and 6
weeks, which is the whole point of shipping it behind a flag.

## Adding an event

1. Add it to `EVENT_SCHEMA` in `app/events.js` and to the table in
   `docs/event-schema.md`, in the same change.
2. Allowed field types are `string`, `number` and `boolean`. Do not add a field
   that can hold what a visitor typed, a name, a place, a coordinate or a
   contact detail. The test `no schema field can carry free text` fails if you
   add the obvious ones.
3. Add a test that the event is recorded with consent and refused without it.

## Why a queue

Offline visitors have no network when the event happens. The queue stores each
event on the device with its own time and a key that never changes
(`session-counter`). A retry sends the same key, so the server counts it once.
If the queue overflows, the oldest event goes and the batch says how many
(`dropped_before`), so a funnel built on it is labelled as a lower bound.

## Never

- Record anything before `setConsent(true)`, or keep anything after
  `setConsent(false)`.
- Wire `app/events.js` into a view without the founder's logged approval:
  `wire_analytics_into_pages` is an ask-first action in `ops/guardrails.json`.
- Let an analytics error break a page. Calls from views go in a try/catch.
- Report a bare rate. Give the interval.
