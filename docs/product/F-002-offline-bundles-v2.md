# F-002 offline route bundles, version 2: design

Status: **designed**. Feature stays behind `naarad.flag.offline-bundles`, off by default. Built under D-0004
(a founder override of G1); no ledger evidence supports it yet, so every claim below is about how the
feature behaves, not about whether anyone wants it.

## What version 1 does, and the gaps in it

Version 1 keeps one route on the device: page, text, code, data and phone-width photos. Gaps found by
reading the code and the tests, in order of how badly they break the promise "this works with no network":

| # | Gap | Evidence in the code | Effect |
|---|---|---|---|
| 1 | **My Journey does not open offline.** The e2e test avoids it. A bundle holds the route page, but `/journey/` needs `app/views/journey.js` and `app/journey.css`, which are only cached if the visitor happened to open My Journey online first. | `selectUrls` keeps what the route page loaded; the Journey view is not among it | The place where saved routes are listed is the one place that fails offline |
| 2 | **No storage check.** A download that does not fit throws from `cache.put`, and the visitor sees only "could not save". Nothing asks the browser to keep the data, so it can be evicted without warning. | `download()` never calls `navigator.storage` | Silent loss on low-end phones, the main audience |
| 3 | **No sign that you are offline,** and the catalogue offers routes that cannot open. | no `online`/`offline` handling anywhere | Dead ends and no explanation |
| 4 | **A bundle never refreshes.** It records a format version but not what the content was. Online, the network wins, so the page looks current; the offline copy quietly ages. | `BUNDLE_VERSION` is a constant | A stale copy with no label |
| 5 | **Related-route links lead to routes that are not saved.** | the route page's related section | Offline, tapping one fails |
| 6 | **One route at a time.** | one button per route page | Tedious for a trip with several saved routes |

## The changes, in build order

1. **Offline kit.** The first download also keeps the pieces every offline visit needs: the My Journey page,
   its view and stylesheet, the route catalogue shell. Stored once, shared by every bundle, removed only when
   the last bundle goes. Fixes gap 1.
2. **Space and persistence.** Before a download, read `navigator.storage.estimate()` and say what it will use
   and what is free. Ask `navigator.storage.persist()` once, on the visitor's first download, and show the
   answer honestly ("your browser may still remove this if space runs low"). Catch quota errors and say
   "not enough space: remove a route or free space on your phone". Fixes gap 2.
3. **Offline state.** A slim bar appears when the browser reports no network: "You are offline. Showing
   routes saved on this device." In the catalogue, routes that are not saved are marked "Not saved for
   offline" and do not navigate. Fixes gaps 3 and 5.
4. **Freshness.** Store the content stamp (the response's `ETag`, else `Last-Modified`) of
   `/content/routes.json` with each bundle. On an online route page, compare; if it changed, the offline
   button says "Update available (x MB)". Never update silently on mobile data. Fixes gap 4.
5. **Save all.** In My Journey's Downloads panel, "Save all saved routes" runs the downloads one after
   another with a visible count, stops cleanly on the first failure, and reports what was kept. Fixes gap 6.

## Not in scope, on purpose

- Map tiles stay out. OpenStreetMap forbids bulk prefetch, and Esri's terms are not ours to change.
- Audio stays out until creators record it (F-033).
- Background sync, push and accounts. Nothing here needs an account.
- Anything that records what visitors do: this feature collects no analytics, and the event queue stays unwired.

## How each change is judged (behaviour, written as tests first)

- Offline kit: with every other cache dropped and the network off, `/journey/` opens and lists the saved route.
- Space: with a faked estimate too small, the download refuses before fetching anything and says why; with a
  faked `QuotaExceededError`, nothing is kept and the message names space, not a generic failure.
- Offline state: the bar appears and disappears with the browser's `offline`/`online` events; an unsaved
  route's card is not a link while offline.
- Freshness: a changed `ETag` turns the button into an update prompt; an unchanged one does not; an update
  replaces the files all-or-nothing.
- Save all: with the second of three downloads failing, the first is kept, the third is not attempted, and the
  panel says "1 of 3 saved".

## Open questions for the founder

1. Is the offline bar wanted for every visitor who is offline, or only those who have saved something?
2. Is "update available" enough, or should saved routes refresh themselves on Wi-Fi?
3. Should "save all" ask first when the total is large (a proposed line: over 50 MB)?
