# Event schema and the offline queue

Defined before it is built into any page, as the Startup Operating System asks. The code is
`app/events.js`; its tests are `ops/test/events.test.mjs`.

**Status: built and tested, not wired into any page.** Loading it from a view collects
analytics from visitors, which is a privacy change. That waits for the founder's logged
approval (`wire_analytics_into_pages` in `ops/guardrails.json`), a consent control the visitor
can see, and a notice. There is also no server to receive the events yet, so with no
`endpoint` the queue sends nothing.

## Why a queue

Most visitors will be on a phone with no reliable signal. An event sent at the moment it
happens is lost when there is none, and the funnel then undercounts exactly the people the
project needs to see. So each event is written to the device first and sent in a batch when
the phone is online.

## The envelope

```json
{
  "id": "6f1c...-3",
  "name": "route_open",
  "ts": 1790000000000,
  "props": { "slug": "hampi-heritage-trail" }
}
```

| field | meaning |
|---|---|
| `id` | The dedupe key: a random session id plus a counter. It never changes, even if the event is sent twice. The server keeps the first copy of each `id` and drops the rest. |
| `name` | One of the events below. |
| `ts` | Milliseconds since the epoch on the device when it happened, not when it was sent. Device clocks are wrong sometimes, so the batch also carries `sent_at`; the server can estimate the skew from it. |
| `props` | Only the fields listed for that event, with the listed types. |

A batch is `{ "v": 1, "sent_at": <ms>, "dropped_before": <n>, "events": [ ... up to 50 ] }`.
`dropped_before` is how many events were thrown away on this device because the queue was
full (it holds 500, and drops the oldest first). Add it to any funnel count so the undercount
is visible, not hidden.

## The events

| name | fields | recorded when |
|---|---|---|
| `page_view` | `page` (string) | a page is drawn |
| `route_open` | `slug` (string) | a route page is opened |
| `stop_select` | `slug` (string), `stop` (number) | a stop is selected |
| `route_save` | `slug` (string) | a route is saved to My Journey |
| `walk_complete` | `slug` (string), `stops` (number) | a walk is marked complete |
| `search_submit` | `has_query` (boolean) | the catalogue search is used |

An event or field not in this table is refused when it is recorded. There is no field for
search text, names, places, coordinates or free text of any kind. To add an event, add it to
`EVENT_SCHEMA` and to this table in the same change.

## Consent, minors and erasure (DPDP)

- Nothing is recorded until `setConsent(true)`. The choice is stored on the device.
- `setConsent(false)` empties the queue and the stored copy: saying no is erasure.
- No identifier outlives a full flush. The session id is dropped when the queue empties.
- Do not turn this on for visitors under 18 without verifiable parental consent (confirm the
  exact duties against the official DPDP text before acting). The site does
  not know a visitor's age, so the consent control needs to ask.
- Breach runbook (72 hours) is not written yet. It must exist before any server stores events.

## Measuring from these events

Report every rate with its interval, never a bare percentage. A rate from a funnel that has
`dropped_before > 0` is a lower bound and should say so.

## What is missing

1. A receiving endpoint that deduplicates on `id` and stores `ts` and `sent_at`.
2. The consent control and notice in the interface.
3. Calls from the views, wrapped so that an analytics error can never break a page.
4. A flush trigger on the browser's `online` event and when the page is hidden.
5. `sw.js` `VERSION` bumped when the views change.
