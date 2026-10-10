# Bugs: Naarad Discover

Found by `e2e/` (see `replica/test-plan.md`). Build tested: `e50cd0e`, then the phone layout rebuilt from the app screenshots.
Browser: Chromium (Playwright 1.56.1), 1440x900 and 390x844 unless stated. BUG-001 to BUG-009 were fixed in `f761f99`; BUG-010 and
BUG-011 were found and fixed while rebuilding the phone layout, before it shipped.

| severity | open | fixed |
| --- | --- | --- |
| S1 | 0 | 0 |
| S2 | 0 | 2 |
| S3 | 2 | 7 |
| S4 | 0 | 0 |

Nothing open at S1 or S2. Two S3 bugs are open and both are in Plan mode, which the Discover rebuild did not touch.

Every fixed bug has a test that **failed before the fix** and passes now. The two open ones are kept as expected failures
(`test.fail`) so they turn red the day they are fixed and nobody has to remember to remove the marker.

---

### BUG-001: the ← Back button on a route page leaves the site, and its obvious fix leaves two pages on screen

- Severity: S2
- Flow / case: F01 / F01-H1
- Screen: S04 (the existing route pages, reached from Discover's "Open route page")
- Build: e50cd0e  Browser / device: Chromium, 1440px and 390px
- Pre-existing: yes. The original site has the same behaviour. Discover's new "Open route page" button made it easy to reach.

Steps
1. Open `/?page=planner`.
2. On the Hampi Vijayanagara Circuit card, press "Open route page".
3. On the route page, press "← Back".

Expected: the planner, with Discover and its list as they were.
Actual: the browser leaves the site (a blank page when the planner was the first page of the visit). On the original checkout the same
steps from the home page also end on a blank page. Removing the stray `history.back()` alone exposes a second bug: the route page stays
on screen next to the page you went back to (`.page.active` on both), because `showPage` only hides the pages in its own list and the
six `route-*` pages are not in it.
Evidence: tests `F01-H1 ... (desktop)` and `(phone)`; a probe on the original checkout printed `after Back button -> [] url blank`.
Suspected cause: `onclick="history.back(); showPage(window.__prevPage||'home')"` on the six route pages. `showRoutePage` never pushes a
history entry, so `history.back()` goes to whatever came before the visit. And `showPage` hides only `pages = [...]`.
Status: fixed in f761f99. The six Back buttons now just call `showPage(...)`, and `showPage` hides every `.page` before showing one.

### BUG-002: pressing Enter twice in the place field sends two geocoder requests

- Severity: S3
- Flow / case: F01 / F01-E6
- Screen: S03
- Build: e50cd0e  Browser / device: Chromium, 1440px

Steps
1. Open Discover. Make the geocoder slow (700 ms).
2. Type "Chennai" in Place and press Enter twice.

Expected: one request. Nominatim's policy is at most 1 request a second.
Actual: two requests.
Evidence: test `F01-E6 pressing Enter twice asks the geocoder once` (2 received, 1 expected).
Suspected cause: `submitPlace` had no guard while a search was running.
Status: fixed in f761f99. A search in progress ignores further Enter presses.

### BUG-003: the place field accepts any length, and sends all of it

- Severity: S3
- Flow / case: F01 / F01-E2
- Screen: S03
- Build: e50cd0e  Browser / device: Chromium, 1440px

Steps
1. Paste 5,000 characters into Place and press Enter.

Expected: the field limits what it takes, and the geocoder request stays short.
Actual: the field held 5,000 characters and they went into the request URL.
Evidence: test `F01-E2 a 5,000 character place is capped` (5000 received, 200 or fewer expected).
Status: fixed in f761f99 (`maxlength="120"`, and the query is cut to 120 as well).

### BUG-004: after Clear filters or Try again, keyboard focus drops to the page

- Severity: S3
- Flow / case: F01 / F01-E20
- Screen: S01
- Build: e50cd0e  Browser / device: Chromium, 1440px and 390px

Steps
1. Choose Sport: Run, so nothing matches.
2. Tab to "Clear filters" and press Enter.

Expected: focus stays somewhere in Discover.
Actual: the button hides itself (nothing is left to clear) and focus falls to `<body>`, so the next Tab starts again from the top of the
whole page. The same happens after "Try again" succeeds, because the error box is replaced.
Evidence: test `F01-E20 focus stays inside Discover after an action` (desktop and phone): `OUTSIDE:BODY`.
Status: fixed in f761f99. Focus moves to the results heading (or, if the retry fails again, to the new Try again button).

### BUG-005: on a phone, the empty state is a scrollable region with nothing in it you can focus

- Severity: S3
- Flow / case: F01 / F01-E14, F01-N6
- Screen: S01
- Build: e50cd0e  Browser / device: Chromium, 390px

Steps
1. On a 390px screen choose Sport: Run.
2. Run axe-core on Discover.

Expected: no violations.
Actual: `scrollable-region-focusable` (serious): the results list scrolls but, in the empty state, has nothing focusable in it, so a keyboard
user cannot scroll it.
Evidence: test `F01-E14 ... (phone)`.
Suspected cause: the only button, "Clear filters", sat in the bar above the list, outside it.
Status: fixed in f761f99. The empty state has its own button ("Clear filters" or "Show all of India"), and the bar's copy steps aside.

### BUG-006: Plan mode tells people to click the map, but clicking the map does nothing

- Severity: S3
- Flow / case: F06 / F06-E4
- Screen: Plan mode (existing)
- Build: e50cd0e  Browser / device: Chromium, 1440px
- Pre-existing: yes. Not touched by the Discover rebuild.

Steps
1. Open Plan Route. The list says "No waypoints yet — click the map to begin."
2. Click the map.

Expected: a waypoint appears.
Actual: nothing. Clicks are ignored until you press "Add waypoint by clicking map", and `addPlanWaypoint` switches that mode off again
after every waypoint, so each point needs its own press of the button.
Evidence: test `F06-E4` (expected failure).
Suspected cause: `setPlanMapClickMode(false)` at the end of `addPlanWaypoint`, with the mode off by default.
Status: open, not fixed. Outside the slice, and the right fix is a product choice: leave the mode on, or reword the message.

### BUG-007: the search box in the planner bar does nothing in Plan mode

- Severity: S3
- Flow / case: F06 / F06-N1
- Screen: Plan mode (existing)
- Build: e50cd0e  Browser / device: Chromium, 1440px
- Pre-existing: yes. Also listed in `replica/build-log.md`.

Steps
1. Open Plan Route, type "Chennai" in "Search city or heritage site…", press Enter.
2. Add two waypoints at the middle of the map and export the GPX.

Expected: the map moved to Chennai (about 13 N).
Actual: the map stayed on the India overview (20.6 N).
Evidence: test `F06-N1` (expected failure; the exported file's first latitude was 20.616).
Suspected cause: the handler geocodes, then pans `window.discMap`, which nothing sets.
Status: open, not fixed. Discover hides this box (it has its own place field), so this only affects Plan mode.

### BUG-008: no visible sign that a place search is running

- Severity: S3
- Flow / case: F01 / F01-E21
- Screen: S03
- Build: e50cd0e  Browser / device: Chromium, 1440px

Steps
1. Make the geocoder take 1.5 seconds. Type "Chennai" and press Enter.

Expected: something on screen says the search is running.
Actual: the field got an `aria-busy` attribute and nothing else, so a sighted user saw no change for as long as the request took.
Evidence: test `F01-E21 a slow geocoder shows that something is happening`.
Status: fixed in f761f99. The hint under the field reads "Searching…" until the answer arrives.

### BUG-009: a landscape phone leaves about 109px for the map and the results

- Severity: S3
- Flow / case: F01 / F01-E22
- Screen: S01
- Build: e50cd0e  Browser / device: Chromium, 844x390

Steps
1. Open Discover at 844x390.

Expected: the map and the results have room to be used.
Actual: 109px between them, after the site's own bars and the filter bar.
Evidence: test `F01-E22 a landscape phone stays usable` (109 received, 120 or more expected).
Status: fixed in f761f99, partly. The hint under the place field is hidden and the bar is tighter on short screens: 145px now. Still
cramped, but the sheet can be dragged up. The site's own header and planner bar take about 130px of a 390px screen and are outside Discover.

### BUG-010: after a place search the phone page is wider than the screen

- Severity: S2
- Flow / case: F01 / F01-E23
- Screen: S01, S03
- Build: the phone layout rebuild, not yet shipped. Browser / device: Chromium, 390px
- Pre-existing: no. Introduced and fixed within the rebuild.

Steps
1. On a 390px screen, search "Chennai" so the radius chip reads "Within 30 km".

Expected: the pill, the chips and the cards fit the screen.
Actual: the control bar was 430px wide on a 390px screen. The pill's locate button and every card ran off the right edge.
Evidence: test `F01-E23`, which failed with the bar's right edge at 430 and passes now. Found first in a screenshot.
Suspected cause: the control bar and the page grid had an auto-sized column, which grows to the widest content, here the three chips
in one line, instead of the width of the screen.
Status: fixed. Both grids use `minmax(0, 1fr)`.

### BUG-011: a card's rating is not read as "rated 4.9 out of 5 by 356 people"

- Severity: S3
- Flow / case: F01 / F01-E29
- Screen: S01
- Build: `e50cd0e` and after. Browser / device: Chromium, design preview page
- Pre-existing: yes, from the first Discover build.

Steps
1. Run axe-core on the design preview page with a card in it.

Expected: nothing to review.
Actual: axe listed `aria-prohibited-attr` as "needs review". The rating was a plain `<span aria-label="Rated 4.9 out of 5 ...">`. An
aria-label on an element with no role is ignored by screen readers, so they read "4.9 (356)" with no meaning. The real page's axe run
reports violations only, so it did not show this.
Evidence: test `F01-E29` now asserts the role, and fails without it (received "", expected "img").
Status: fixed. The rating is `role="img"`, so its label is read whole.

---

## To check

Not reproduced, or not possible here. None of these is a finding.

- **Real devices and browsers.** Everything ran in Chromium with a mouse and a simulated viewport. Not tried: a finger dragging the
  sheet (X-4), Safari, Firefox, a screen reader reading the live status line.
- **Real Nominatim.** The tests use a stub. The existing `forwardGeocode` sets a `User-Agent` header, which browsers may ignore; the
  policy also accepts the `Referer`, which browsers send. Confirm with real traffic that requests are accepted.
- **Real map tiles.** Blocked here, so the map was always a plain background. Route line contrast against real tiles is unchecked.
- **Tab order.** The map (its zoom buttons and attribution links) comes before the results in the DOM, so a keyboard user passes
  about four extra stops to reach the first card. Not a failure of any rule; a skip link or reordering would help.
- **Sport: Run** is offered but no route has it, so choosing it always empties the list. A product question: hide sports with no routes?
- **The serif face.** Playfair Display could not load here, so card titles were tested in the system serif. A real title in Playfair
  is a little narrower than the stand-in, so wrapping should only get better. Check long names on a real device.
- **Chips at 320px.** All three fit one row at 390px. At 320px they wrap to two rows and the overlay takes about 56px more of the
  map. No overflow (F01-E12), but cramped.
- **The hint over the chips.** On a phone the "Press Enter to search" hint floats over the chips while you type, and steps aside after
  Enter. A phone's own keyboard Go key may not fire Enter in every browser: untested.
- **History.** After Back from a route page the visit has an extra history entry, so the browser's own Back button may step through a
  duplicate. Not reproduced as a failure.
- **Re-searching the same place** flashes "Loading routes…" for a moment. Cosmetic.

## Test mistakes found on the way

The first full run had 15 failing results. 8 of them were mistakes in my tests, from 6 different causes, and were fixed in the tests:
a smooth scroll read before it finished (F01-E18, at both widths), a wrong expected count (F01-E9: Moderate and Walk is 2 routes,
not 1), a selector that matched Leaflet's own tile images (F01-E4), a wait on a status line that was already true (F02-E1), a text
match that hit two elements (F02-E3), and two clicks inside 300 ms that Leaflet treats as a double-click zoom (F06-H1 and F06-N1).
The other 7 failing results were 5 real bugs (BUG-001 to BUG-005). A suite written by the person who wrote the code is not neutral:
most of the bugs came from the skill's edge-case checklist (double submit, very long input, keyboard only, back button, slow network),
not from the cases I would have thought of unprompted.
