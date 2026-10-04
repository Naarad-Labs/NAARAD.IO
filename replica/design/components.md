# Components: Naarad Discover

Specs for every component in `replica/recon.md`, plus the ones the real page
needed. Values are token names from `replica/design/tokens.json`; pixels are in
`discover/tokens.css` (generated). The components are in `discover/primitives.css`.

**Where these come from.** Komoot's pages could not be read and `replica/screens/`
is empty, so **nothing here records how Komoot's components look.** The recon
named the components (S01 to S08) and said what each does. Their look comes from
Naarad's own rendered Discover page (computed styles, 1440x900), corrected for
WCAG 2.2 AA. The recon marks the component list as unconfirmed, so this list
may grow once the real pages are read.

**Stack note.** Naarad is a static site with no Tailwind, so there is no Tailwind
mapping. `discover/tokens.css` is the mapping: custom properties named `--color-*`,
`--type-*`, `--space-*`, `--radius-*`, `--shadow-*`, `--motion-*`, `--size-*`.
Classes in `primitives.css` are prefixed `nd-` so they cannot collide with the
live `.disc-*` and `.rt-*` rules.

**Status key.** *built* = in `discover/primitives.css`, shown in `replica/design/preview.html`, passes
`check-preview.js`. *spec only* = specified, not built. *live* = the class that
exists in `index.html` today.

## What changes from the live page

| # | change | why | evidence |
| --- | --- | --- | --- |
| 1 | List beside the map at 900px and up, sheet over the map below | live is a full-width bottom sheet at every width, so on a 1440px screen each card is 1416px wide. Cause: stylesheet debris from commit `dde6106` closes the mobile `@media` block early (see `build-log.md`), so a mobile-only rule leaks everywhere. | `current-discover-desktop-expanded.png` |
| 2 | Difficulty pills restored to their intended colours | a duplicate rule at line 1302 overrides line 330, and the pills render at 1.5 to 2.1:1 | computed styles of the 12 pills on the page (8 easy, 3 moderate, 1 hard), ratios from `contrast.py` |
| 3 | Control borders darkened to 3.7:1 | live chip border `#B8BEC9` is 1.9:1 | `contrast.py` |
| 4 | One accent that passes as text (`accent`), one for graphics (`accent-bright`) | live `#E8641A` and `#DD6E27` are 3.3:1, and white labels on them fail | `contrast.py` |
| 5 | Nothing under 12px | live chips and section heads are 10px | computed styles |
| 6 | Sheet handle works from the keyboard | live handle has `role="separator"` but no `tabindex` and no key handling | DOM read, `tabindex` is null |
| 7 | Filters collapse behind a button below 900px | the live bar has only 2 controls and is already 146px tall on a 390px phone. Adding difficulty, duration, elevation and the rest would take far more: my first preview stacked 5 controls to about 290px of an 844px screen and left the map almost no room. | `current-discover-mobile.png`, first preview iteration |
| 8 | Difficulty is never colour alone: a word on the card, a dash pattern on the line | colour-blind users, and 3:1 between the three line colours is not guaranteed | design decision |
| 9 | Chips are 32px tall, 44px on touch screens | live chips are 25px | computed styles |
| 10 | Durations come from `--motion-*`, and `prefers-reduced-motion` zeroes them | live chips and cards use `transition: all` (computed). The file has two `prefers-reduced-motion` rules, not checked for Discover. | computed styles, CSS grep |
| 11 | Card media is the route's own silhouette, not an emoji on a gradient | proposal. The data now has `path_preview`. Decide before build. | design decision |
| 12 | GPX "View on map" pills use `primary`, not each track's colour | 3 of the 8 track colours fail 4.5:1 under white 11px text | `contrast.py` |

## Components

```
Results sheet / list column         [built]  live: .disc-cards-col.bottom-sheet
  variants  sheet (below 900px), list column (900px and up, 380px, no handle)
  sizes     sheet height 80px (peek) to window height minus 68px; list column --size-list-column
  states    default, peek, expanded, dragging, loading (skeleton cards), empty, error
  tokens    bg bg, radius sheet (top corners), shadow sheet, border border (column edge)
  a11y      <section> labelled by a hidden "Results" heading, live count in role="status".
            The handle is a window splitter: role="separator", tabindex 0, aria-orientation,
            aria-valuemin/max/now in px, aria-label. Arrow Up/Down move 24px, Home/End jump to peek/full.
            Mouse, touch and keyboard all drive the same function.
  used on   S01
```

```
Filter bar                          [built]  live: .disc-filterbar
  variants  inline (900px and up), collapsed behind a Filters button (below 900px)
  sizes     one row at 900px and up, wraps; summary button control-md
  states    open, collapsed, active filter count on the button (to build)
  tokens    bg surface, border border (bottom)
  a11y      role="search" with a label. The collapse is a native <details open> (closed by script
            on narrow screens), so without script the filters stay open and reachable.
  used on   S01, S02
```

```
Filter chip (multi-select toggle)   [built]  live: .disc-chip
  variants  default, pressed
  sizes     height control-sm (32px), 44px when pointer is coarse
  states    default, hover (border primary), pressed, focus-visible (2px focus ring, 2px offset), disabled
  tokens    type label (12px, 700, uppercase, tracking .1em), radius sharp, border border-input,
            pressed: bg primary, text on-primary
  a11y      real <button aria-pressed>. Name says what it filters. Groups are role="group" with a label.
            No chip pressed means "any". Used for difficulty, and for themes (heritage walk, temple trail...).
  used on   S01, S02
```

```
Option group (single choice)        [built]  live: none
  variants  segmented radio set (sport, surface, route type)
  sizes     height control-sm
  states    default, checked, hover, focus-visible (ring on the visible segment), disabled
  tokens    type sm, border border-input, checked: bg primary, text on-primary
  a11y      real radio inputs in a <fieldset> with a <legend>. Arrow keys move and select, as native radios do.
            Use this, not chips, where only one value is allowed. The search takes one sport.
  used on   S02
```

```
Sport selector                      [built, = Option group]
  variants  Hike, Walk, Cycle, Run (the values schema.sql allows)
  note      the recon saw "hike" in the URL and cycling and running in press text. Which sports
            Naarad offers is a product decision. The live chips are route themes, not sports.
  used on   S01, S07
```

```
Range (single)                      [built]  live: #disc-max-dist
  variants  one handle (longest route, search radius)
  sizes     full width of its column, target height 24px minimum
  states    default, hover, focus-visible, disabled, dragging
  tokens    accent-color accent-bright (graphic, 3:1), value text text-muted, label type sm/600
  a11y      native <input type="range"> with a <label>; the current value is text beside it, not only
            the thumb position. Keyboard: arrows, Home, End, PageUp/Down for free.
  note      the recon could not confirm whether Komoot's max_distance is a length cap or a radius.
            search_tours takes both, so build whichever the confirmed answer needs, or both.
  used on   S02
```

```
Range pair (min and max)            [built]
  variants  duration (30 min to 10 h in the recon), elevation gain, length
  states    default, min above max (the last one moved wins and the other follows), disabled
  a11y      <fieldset> with a <legend> and two labelled native range inputs. Two inputs, not one
            double-thumb widget, because native inputs are keyboard and screen reader complete.
  used on   S02
```

```
Text field (place search)           [built]  live: #pm-location-input
  variants  default
  sizes     height control-md (40px)
  states    default, hover, focus-visible, error, disabled, searching (aria-busy)
  tokens    type sm, radius md, border border-input, error: border danger 2px + text danger
  a11y      visible <label>, never placeholder-only. Error is text in aria-describedby, not colour alone.
            Search runs on Enter, NOT on every keystroke: Nominatim forbids client-side autocomplete
            (see architecture.md). The hint says so: "Press Enter to search."
  used on   S03
```

```
Use my location                     [spec only]
  variants  button beside the place field
  states    default, locating (aria-busy), permission denied (message under the field), unavailable
  a11y      real <button>. Denied is an error message with what to do next ("Allow location in your
            browser, or type a place"). The recon could not see the real states.
  used on   S03
```

```
Tour card                           [built]  live: .rt-card
  variants  default, selected, skeleton
  sizes     fills its column. 380px column gives about 350px of card.
  states    default, hover (border primary, shadow card-hover, 1px lift), selected (border accent-bright,
            shadow card-selected), focus-visible, loading (skeleton, same footprint), long title (wraps, no clip)
  tokens    bg surface, radius lg, shadow card, title type card-title, meta and stats type xs/text-muted
  a11y      one tab stop: the title is a <button> (or a link, where a detail page exists) inside the
            heading, stretched over the whole card, so a click anywhere selects it. A second action,
            such as "Open route page", sits above it as its own button. Title is a heading one level
            under the list's heading. The selected card has .is-selected and its title button has
            aria-current="true". The focus ring is drawn inside the card because the card clips its
            edge. The route silhouette in the media area is aria-hidden: the stats say it in text.
  used on   S01
```

```
Difficulty badge                    [built]  live: .diff-easy / .diff-moderate / .diff-hard
  variants  easy, moderate, hard
  states    one
  tokens    easy: success on success-bg, moderate: warning on warning-bg, hard: danger on danger-bg
            (6.4 to 6.8:1). type label without uppercase, radius pill
  a11y      the word is the label. Colour is a second cue, never the only one.
  used on   S01, S04
```

```
Map                                 [spec only: placeholder built]  live: #disc-map (Leaflet)
  variants  results map, tour map (S04), planner map (S07)
  states    loading, tiles failed (keep the lines and a notice), offline, no results (map stays)
  tokens    map-bg is ASSUMED (tile source undecided). Lines: route-easy solid, route-moderate dashed
            9 6, route-hard dotted 1 7, each with a 7px surface casing so they read on any tiles.
            Selected line 5.5px, others 3.5px. Start points: surface circle with a route-coloured ring.
  a11y      the map is an extra view of the list, not the only way in: every route is a card. Give the map
            region a label, keep Leaflet's keyboard handling on, and give markers button semantics.
            Re-check route-* against the real tiles before launch.
  used on   S01, S04, S07
```

```
Highlight marker                    [built]  live: none
  variants  point, segment (a line, to build)
  sizes     control-sm, 44px on touch screens
  states    default, hover, pressed (selected: border accent-bright), focus-visible
  a11y      <button aria-pressed aria-label="Viewpoint: Sunrise Point">. Opens the highlight panel.
  used on   S01, S04, S07
```

```
Tip and photo list                  [built]  live: none
  variants  tip with photos, tip without, empty ("No tips yet. Be the first to add one.")
  states    default, pending (author only, labelled "Waiting for review"), removed (not shown)
  tokens    bg surface, radius md, border border, type sm, author line xs/text-muted
  a11y      each tip is a <figure> with a caption naming the author. Photos need alt text from the
            uploader; if blank, say "Photo" and do not invent a description.
  used on   S05
```

```
Pin drop                            [spec only]
  variants  create-highlight, add-waypoint
  states    placing, placed (confirm), out of area, error
  a11y      a map click has to have a keyboard route: a "Place at map centre" button after panning with
            the arrow keys, and coordinates as text.
  used on   S06, S07
```

```
Pagination                          [built]
  variants  numbered, Previous/Next
  sizes     control-sm
  states    default, current (aria-current="page", primary fill), disabled (first and last)
  a11y      <nav aria-label="Result pages">, buttons with names, and page change moves focus to the
            list heading. The recon found `pageNumber` in the URL but not the control. Build only when
            there are more than about 40 routes (Naarad has about 20).
  used on   S01
```

```
Empty and error states              [built: empty. error spec only]
  variants  no results, search failed (retry), offline (show the last results with a notice)
  states    one each
  tokens    icon text-muted, title type lg, body max 32ch text-muted, one button
  a11y      "no results" says why (what was searched) and offers one action: clear filters. Errors use
            role="alert". Never leave a blank map and an empty list with no words.
  used on   S01
```

```
Button                              [built]  live: .btn-pri, .btn-ghost
  variants  primary (primary fill), accent (accent fill, white label 4.8:1), secondary (outline)
  sizes     control-sm 32, control-md 40, control-lg 48
  states    default, hover, focus-visible, disabled, loading (aria-busy, label kept: "Searching…")
  tokens    type sm/600, radius sharp, border border-input
  a11y      real <button>. Disabled uses aria-disabled where it must stay focusable.
  used on   S01 to S08
```

## Not measured, not decided

- **Komoot's actual look.** Not read. If it matters for parity, take screenshots into `replica/screens/` first.
- **The map's tile style.** `map-bg` and the route line contrast depend on it.
- **Fonts.** Inter is loaded from Google Fonts on the live site. The screenshots here use the system sans because
  the preview blocks external hosts, so line breaks differ slightly from a real browser.
- **Type colours on cards.** The live `rt-card-badge` colours come from JS maps (`TYPE_GRAD`, `BADGE_STYLE`) and only
  the purple one was measured. Check them when the badge is rebuilt.
- **Dark theme.** Naarad has no dark theme, so none is specified.
- **Pages other than Discover.** Not touched.
