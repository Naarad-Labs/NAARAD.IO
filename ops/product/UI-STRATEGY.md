# UI strategy, revised 2026-11-01

Written after one combined review run: the Impeccable critique (design review, isolated), the Impeccable detector and technical audit (isolated), the design plugin's accessibility and UX-copy review, and its design-system audit and critique. Each ran read-only against the live site at phone width first, then desktop. This file replaces the earlier ranking, which was Claude's judgement alone. It changes no roadmap row: `ops/product/PROGRESS.md` stays the source of truth for status.

## Where the UI stands

| Review | Result |
|---|---|
| Design critique (Nielsen, 10 heuristics) | 22 / 40, Acceptable. Reading is strong and honest; the walking experience is unfinished. |
| Technical audit (a11y, performance, theming, responsive, integrity) | 16 / 20, Good. Integrity passes: the code is coherent and product-specific. |
| Design system | 58 / 100. 18 colour tokens, but no scale for type, spacing, z-index or breakpoints; `app/map.css` has no tokens at all. |
| Accessibility (WCAG 2.1 AA) | One keyboard blocker (Studio audio attach), several serious player, map-marker and tab gaps that automated checks miss. |
| Detector | 273 findings; about 190 are false positives on deliberate choices (full-bleed photo cards, text over a dark scrim, a quiet accent border). |

What is genuinely good and stays: the paper-and-ink palette with terracotta, the Playfair, DM Sans and Caveat voice, honest empty states and photo credits, the phone route page layout (map first, actions in the thumb zone), hover gated on real pointers, no horizontal overflow anywhere.

## The strategy in one paragraph

Naarad's design strength is honesty, and its weakness is that the part a visitor uses while walking does not yet earn it. So: first remove the places where the UI says something untrue; then build the walking loop (stop sheet, a player that knows the stop and what is next, walk state); then take weight off the phone screen; then fix the keyboard and screen-reader gaps in that loop; and only then tokenise and consolidate the design system, because the system should be shaped by the components that are kept. Marketing-surface polish, motion tuning and the language switcher wait.

## Workstreams, in order

Roadmap item numbers are from `ROADMAP-1000.md`. "New" means not in the roadmap and proposed here.

### W0. Honesty fixes (small, first)
The UI must not record or claim what did not happen.
1. **Start Walk records a finished walk** (`app/main.js:830` calls `Journey.completeWalk`; My Journey then shows 5.2 km walked and an achievement). Make the button "Listen from stop 1", stop auto-completing, and mark a route walked only by an explicit action or after the last stop. New.
2. **Hours listened is estimated on tap** (`main.js:625` records `story.length / 15` seconds before playback starts). Count only after playback starts; show minutes. New.
3. **"5 languages" fact on route pages** contradicts the home page ("every story so far is in English"); `route.js:59`. Show what exists. New.
4. **Player source line says "Creator recording" when nothing plays**, and the honest "Read aloud by your device" label is hidden on phones (`base.css` ~353). New.
5. **Studio sidebar buttons do nothing** (no handler for `data-studio-nav`); the stop-language chevron does nothing. Remove or mark "Coming later". New.
6. Copy that overpromises: "Read aloud" described as automatic, "Multilingual audio" eyebrow, "Add to journal" that only shows a toast. New (copy pass, W6).

### W1. The walking loop: stop sheet, player, walk state
Roadmap 164-178 (stop sheet and listen bar), 300-310 (walk mode), 311-323 (audio player), 179-188 only where the sheet needs them.
- A real bottom sheet: peek (number, name, Listen) and expanded (story). Today the "handle" is decorative; either build it or remove it.
- A one-row mini player: stop N of 8, play and pause, thin progress, expands to speed, next stop and the voice-source label. Close moves inside the expanded view.
- The playing stop is visibly different from the selected stop, and its map pin is marked.
- Walk state survives an app switch or reload. New. Distance to the next stop only with location, and a clear no-GPS fallback. New.

### W2. Take weight off the phone
Roadmap 190 (hero), 239, 245 (sticky bar), 202.
- Sticky chrome on the phone route page is header 67 + tabs 106 + action bar 63 + player 118 = 354 px, 44% of an 812 px screen, and all of it at 200% zoom. Budget: at most 25% of the viewport, one persistent bottom layer (action bar and player never stack), tabs as one scrollable row. New budget test.
- Home hero: the headline starts below mid-screen and the main button is below the first screen at 375x812.

### W3. Keyboard and screen-reader gaps in that loop
Roadmap 562-591 (accessibility engineering) and 219 (map keyboard).
- Studio audio attach cannot be reached by keyboard (hidden file input behind a non-focusable label). The only blocker.
- Player: focus moves into it on play, a status line announces "Playing stop 1 of 8", Escape closes it, it sits before the footer in the DOM.
- Map markers: Enter and Space select, names include the stop number, the selected one has a state. Needs a check with a real keyboard; the review used synthesised keys.
- Stop tabs get arrow keys and `aria-controls`; the whole stop panel stops being `aria-live`.
- Field borders (1.64:1) and the catalogue placeholder (4.42:1) fail contrast; `lang` on Indic text.

### W4. Design system, once the components are known
Roadmap 53-66 (tokens), 95-104 (spacing and components), 126-134 (type scale).
- One `tokens.css`: spacing 4/8, a six-step type scale with a 13 px floor, z-index, breakpoints, `--on-accent`. Convert `map.css` first. Define or delete the phantom tokens (`--navy`, `--focus`, `--surface`).
- Collapse four card styles, three tab styles and three chip shapes. Add field error and disabled states and a loading skeleton.
- Then a lint against raw colours and font sizes (roadmap 57).
- Type: footer tagline 9.5 px, skip labels 8.5 px, map labels 9-10 px; route-page h2 and h3 are both 14 px; story column is about 80 characters wide.

### W5. Maps UI
Roadmap 206-219. After W1, so a pin has something to open.
- 44 px marker hit area (207) and the marker redesign (206): selected must differ in size and shape, not colour alone.
- Attribution compact but reachable; keep the licence text.
- `flyTo` and `panTo` honour reduced motion.

### W6. Content readiness and copy
- A catalogue facet "Has audio now (3)" and that as the default sort; show the other 17 routes as quiet "in progress" rows. 17 of 20 routes have no stops, and a first-time visitor reaches empty pages.
- One "ready to walk / reading only / in progress" status per route, used by cards, the route page and My Journey. New.
- Copy pass: one term each for route, walk, listen; sentence case; "Offline use: coming soon"; empty states that name a next step; first-visit hint for the walk loop.

### Deferred
Language switcher and per-language UI (no non-English story exists), the motion section (138-150) apart from reduced motion and stopping the infinite hero drift, view transitions and the animation library choice (151-152, 179-182), dark mode and print.

## Where the reviews disagree, and how it is resolved
- Design review puts **walk mode first**; design-system review puts **tokens first**. Resolved: honesty fixes, then the walking loop, then tokens. Tokens before components means tokenising components that will be replaced.
- Detector vs people: the detector's cramped-padding, side-tab and low-contrast findings are mostly the design working as intended; they are ignored unless a person also flags them.

## Corrections to the reviews (checked against the code)
- The design-system review said the Journey and Studio 32 px icon buttons stay 32 px on phones. **False**: `journey.css:147` and `studio.css:145` set 44 px at phone width.
- The accessibility review says Enter does not select a map marker. It used synthesised keys and asked for a real-keyboard check; treat as unconfirmed until tested.
- Confirmed in code: Start Walk completes a walk (`main.js:830`); listening time is recorded on tap (`main.js:625`); the Studio audio input is `hidden` (`studio.js:112`); Studio nav has no handler; the player is appended after the footer (`audio.js:241`); stop tabs have `role=tab` but no `aria-controls` or tabpanel; the whole stop panel is `aria-live` (`route.js:127,136`); the languages fact slices to four (`route.js:59`).

## Roadmap rows that look done or unneeded (verify each before closing)
119 current-page state, 120 breadcrumbs, 125 skip link, 154 and 205 hover on touch (205 is done), 211 zoom control styling, 213 layer switcher, 214 persisted layer (done), 243 side-tab borders (none exist), 83 and 199 icon set (199 is done). Closing any of them needs its own "done when" shown, not just the review's word.

## Proposed new roadmap items (need the founder's yes before they enter the tracker)
Start Walk semantics and an integrity check that My Journey counts and badges come from real events; listening time counted from real playback; sticky-chrome budget test; walk-state persistence; "ready to walk" status per route; a no-dead-controls test (every control has a handler); card consolidation; icon-button and field-state coverage in the touch-target table; a copy-honesty check in e2e (every visible claim about languages, recordings, accounts or plans traces to data); an outdoor-legibility pass (13 px floor, plain map tiles); offline status per route; Journey hero imagery.

## How the work is run
Small specs to Aider through FreeLLMAPI, one concern per run, with Claude doing review, measurement and anything the free models fail at (said plainly in each PR). Every change passes `bash scripts/verify.sh` and is measured in the browser at 375 px. Re-run the Impeccable critique and audit after W2 and again after W4 to see the scores move.
