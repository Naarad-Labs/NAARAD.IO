# Product progress

Source of truth for the 1,000-point roadmap (`ROADMAP-1000.md`). Read and edit with `node ops/product/progress.mjs` (`summary`, `next`, `set`, `unblock`, `lock`); do not hand-edit rows.

Statuses: `todo` · `doing` · `done` · `blocked` (waiting on the tag in the note) · `parked` (guardrail says ask the founder) · `dropped` (with reason).

Run lock: 2026-10-27T17:29:25.025Z interactive-session-aryan

| # | status | tags | title | section | note |
|---|---|---|---|---|---|
| 1 | doing |  | Inventory the unmerged commits | Merge the pending review-fix branch | merging review-fix branch |
| 2 | todo |  | Dry-run the merge against main | Merge the pending review-fix branch |  |
| 3 | todo |  | Predict the sw.js conflict | Merge the pending review-fix branch |  |
| 4 | todo |  | Rebase review fixes onto main in small steps | Merge the pending review-fix branch |  |
| 5 | todo |  | Re-run verify.sh after every group | Merge the pending review-fix branch |  |
| 6 | todo |  | Re-run Playwright e2e on the merged result | Merge the pending review-fix branch |  |
| 7 | todo |  | Regenerate pre-rendered pages after the merge | Merge the pending review-fix branch |  |
| 8 | todo |  | Re-check the honest-data fixes against ops/ rules | Merge the pending review-fix branch |  |
| 9 | todo |  | Open one PR with a review checklist | Merge the pending review-fix branch |  |
| 10 | todo |  | Log the merge in the decision log | Merge the pending review-fix branch |  |
| 11 | todo |  | Delete stale remote branches | Merge the pending review-fix branch |  |
| 12 | todo |  | Write a branch naming and lifetime rule | Merge the pending review-fix branch |  |
| 13 | todo |  | Add a CI check that features need evidence | Governance gates (ops/ decision log and |  |
| 14 | todo |  | Add a CI check that overrides are logged | Governance gates (ops/ decision log and |  |
| 15 | todo |  | Validate features.json against a JSON schema | Governance gates (ops/ decision log and |  |
| 16 | todo |  | Reconcile F-001 and F-002 status with reality | Governance gates (ops/ decision log and |  |
| 17 | todo |  | Make the register readable on a public page or keep it explicitly priv | Governance gates (ops/ decision log and |  |
| 18 | todo |  | Add decision-log numbering lint | Governance gates (ops/ decision log and |  |
| 19 | todo |  | Add an evidence-ledger staleness report | Governance gates (ops/ decision log and |  |
| 20 | todo |  | Require a source for every number in content/ | Governance gates (ops/ decision log and |  |
| 21 | todo |  | Write the cloud-spend guard | Governance gates (ops/ decision log and |  |
| 22 | todo |  | Log the Sarvam 403 block as a risk | Governance gates (ops/ decision log and |  |
| 23 | todo |  | Log the local-only LLM endpoint as non-shippable | Governance gates (ops/ decision log and |  |
| 24 | todo |  | Define the G1 gate in one page | Governance gates (ops/ decision log and |  |
| 25 | todo |  | Add a PR template with governance fields | Governance gates (ops/ decision log and |  |
| 26 | todo |  | Add a weekly governance review note | Governance gates (ops/ decision log and |  |
| 27 | todo |  | Document what verify.sh checks | verify.sh and CI |  |
| 28 | todo |  | Make verify.sh fail fast with clear stage names | verify.sh and CI |  |
| 29 | todo |  | Time every verify.sh stage | verify.sh and CI |  |
| 30 | todo |  | Add an HTML validity stage | verify.sh and CI |  |
| 31 | todo |  | Add an internal link checker | verify.sh and CI |  |
| 32 | todo |  | Check sitemap.xml matches the built pages | verify.sh and CI |  |
| 33 | todo |  | Check canonical, title and description on every built page | verify.sh and CI |  |
| 34 | todo |  | Check the service worker cache list against built files | verify.sh and CI |  |
| 35 | todo |  | Add a pre-render determinism check | verify.sh and CI |  |
| 36 | todo |  | Cache npm and Playwright browsers in CI | verify.sh and CI |  |
| 37 | todo |  | Run e2e on a built site, not the dev tree | verify.sh and CI |  |
| 38 | todo |  | Upload Playwright traces and screenshots on failure | verify.sh and CI |  |
| 39 | todo |  | Add a CI size budget | verify.sh and CI |  |
| 40 | todo |  | Protect main with required checks | verify.sh and CI |  |
| 41 | todo |  | List every file reachable on the live domain | Public repo hygiene (what GitHub Pages s |  |
| 42 | todo |  | Move non-site files out of the published root | Public repo hygiene (what GitHub Pages s |  |
| 43 | todo |  | Decide the fate of the replica/ folder | Public repo hygiene (what GitHub Pages s |  |
| 44 | todo |  | Check docs/ for internal content | Public repo hygiene (what GitHub Pages s |  |
| 45 | todo |  | Add a secret scan to CI | Public repo hygiene (what GitHub Pages s |  |
| 46 | todo |  | Keep the Supabase service key out of the client bundle | Public repo hygiene (what GitHub Pages s |  |
| 47 | todo |  | Add .gitattributes and .editorconfig | Public repo hygiene (what GitHub Pages s |  |
| 48 | todo |  | Pin or lockfile vendored libraries | Public repo hygiene (what GitHub Pages s |  |
| 49 | todo |  | Compress and size-audit Images/ | Public repo hygiene (what GitHub Pages s |  |
| 50 | todo |  | Add a credits and licences file for imagery and data | Public repo hygiene (what GitHub Pages s |  |
| 51 | todo |  | Verify CNAME and Pages settings stay intact | Public repo hygiene (what GitHub Pages s |  |
| 52 | todo |  | Keep googlecc72b0f2c9685bc7.html deliberately | Public repo hygiene (what GitHub Pages s |  |
| 53 | todo |  | Audit current CSS custom properties | Design tokens and DESIGN.md |  |
| 54 | todo |  | Write DESIGN.md | Design tokens and DESIGN.md |  |
| 55 | todo |  | Create a single tokens.css | Design tokens and DESIGN.md |  |
| 56 | todo |  | Name tokens by role, not value | Design tokens and DESIGN.md |  |
| 57 | todo |  | Add a stylelint rule banning raw colours | Design tokens and DESIGN.md |  |
| 58 | todo |  | Add a z-index scale | Design tokens and DESIGN.md |  |
| 59 | todo |  | Add a motion token set | Design tokens and DESIGN.md |  |
| 60 | todo |  | Define breakpoint tokens and use them consistently | Design tokens and DESIGN.md |  |
| 61 | todo |  | Export tokens to a machine-readable file | Design tokens and DESIGN.md |  |
| 62 | todo |  | Sync tokens with a Figma file | Design tokens and DESIGN.md |  |
| 63 | todo |  | Add a visual token reference page for development only | Design tokens and DESIGN.md |  |
| 64 | todo |  | Version the design system | Design tokens and DESIGN.md |  |
| 65 | todo |  | Contrast-check every colour pair automatically | Design tokens and DESIGN.md |  |
| 66 | todo |  | Document dark-mode status honestly | Design tokens and DESIGN.md |  |
| 67 | todo |  | Write a skills playbook for this repo | Using the installed skills and MCPs |  |
| 68 | todo |  | Run an impeccable audit of every page type | Using the installed skills and MCPs |  |
| 69 | todo |  | Run a design-taste anti-slop pass on the home hero | Using the installed skills and MCPs |  |
| 70 | todo |  | Run ui-ux-pro-max accessibility and touch checks | Using the installed skills and MCPs |  |
| 71 | todo |  | Run an emil-design-eng detail review | Using the installed skills and MCPs |  |
| 72 | todo |  | Run find-animation-opportunities, then improve-animations | Using the installed skills and MCPs |  |
| 73 | todo |  | Use Playwright MCP for visual capture at fixed viewports | Using the installed skills and MCPs |  |
| 74 | todo |  | Add Playwright screenshot regression tests | Using the installed skills and MCPs |  |
| 75 | todo |  | Gate Figma MCP work on authorisation | Using the installed skills and MCPs |  |
| 76 | todo |  | Create a mockup parity checklist | Using the installed skills and MCPs |  |
| 77 | todo |  | Measure mockup parity with overlay screenshots | Using the installed skills and MCPs |  |
| 78 | todo |  | Keep visual-contract.md in lockstep with CSS | Using the installed skills and MCPs |  |
| 79 | todo |  | Add the Leaflet marker size to the contract | Using the installed skills and MCPs |  |
| 80 | todo |  | Record skill outputs in the repo | Using the installed skills and MCPs |  |
| 81 | todo |  | Write a brand brief | Brand, typography and colour |  |
| 82 | todo |  | Audit logo usage | Brand, typography and colour |  |
| 83 | todo |  | Produce a complete icon set for the manifest | Brand, typography and colour |  |
| 84 | todo |  | Create a default social share image | Brand, typography and colour |  |
| 85 | todo |  | Create per-route share images | Brand, typography and colour |  |
| 86 | todo |  | Inventory fonts in app/fonts | Brand, typography and colour |  |
| 87 | todo |  | Subset and self-host fonts with woff2 | Brand, typography and colour |  |
| 88 | todo |  | Define the type scale | Brand, typography and colour |  |
| 89 | todo |  | Check Indic script readiness without claiming support | Brand, typography and colour |  |
| 90 | todo |  | Fix heading hierarchy on every page | Brand, typography and colour |  |
| 91 | todo |  | Define the colour palette with roles and usage rules | Brand, typography and colour |  |
| 92 | todo |  | Choose a colour-blind-safe set for route lines and map layers | Brand, typography and colour |  |
| 93 | todo |  | Define an on-photo text treatment | Brand, typography and colour |  |
| 94 | todo |  | Standardise imagery style | Brand, typography and colour |  |
| 95 | todo |  | Define the spacing scale | Spacing, layout and components |  |
| 96 | todo |  | Standardise page gutters and max widths | Spacing, layout and components |  |
| 97 | todo |  | Build a button component spec | Spacing, layout and components |  |
| 98 | todo |  | Build a card component spec | Spacing, layout and components |  |
| 99 | todo |  | Standardise the focus ring | Spacing, layout and components |  |
| 100 | todo |  | Unify tab components | Spacing, layout and components |  |
| 101 | todo |  | Build a form-field component | Spacing, layout and components |  |
| 102 | todo |  | Standardise chips and filter controls | Spacing, layout and components |  |
| 103 | todo |  | Define the fact-grid component | Spacing, layout and components |  |
| 104 | todo |  | Enlarge Leaflet markers and controls | Spacing, layout and components |  |
| 105 | todo |  | Write a voice and tone guide | Content design and UX copy |  |
| 106 | todo |  | Audit all UI strings into one list | Content design and UX copy |  |
| 107 | todo |  | Centralise UI strings in a module | Content design and UX copy |  |
| 108 | todo |  | Rewrite the home hero copy honestly | Content design and UX copy |  |
| 109 | todo |  | Label narration accurately | Content design and UX copy |  |
| 110 | todo |  | Write the sign-in screen copy for a flagged feature | Content design and UX copy |  |
| 111 | todo |  | Write microcopy for the practical-facts block | Content design and UX copy |  |
| 112 | todo |  | Standardise date, distance and duration formats | Content design and UX copy |  |
| 113 | todo |  | Write alt text and caption standards | Content design and UX copy |  |
| 114 | todo |  | Write error and permission messages for geolocation | Content design and UX copy |  |
| 115 | todo |  | Map the current site structure | Information architecture, navigation and |  |
| 116 | todo |  | Decide the primary navigation set | Information architecture, navigation and |  |
| 117 | todo |  | Make header behaviour consistent on mobile | Information architecture, navigation and |  |
| 118 | todo |  | Rework the footer into grouped link columns | Information architecture, navigation and |  |
| 119 | todo |  | Add current-page state to header and footer links | Information architecture, navigation and |  |
| 120 | todo |  | Add breadcrumbs on route and story pages | Information architecture, navigation and |  |
| 121 | todo |  | Design the 404 page | Information architecture, navigation and |  |
| 122 | todo |  | Design a client-side error state | Information architecture, navigation and |  |
| 123 | todo |  | Design empty states | Information architecture, navigation and |  |
| 124 | todo |  | Design loading states and skeletons | Information architecture, navigation and |  |
| 125 | todo |  | Add a skip link and landmark audit | Information architecture, navigation and |  |
| 126 | todo |  | Raise the header motto to a legible size | Type scale, tracking and spacing |  |
| 127 | todo |  | Raise the footer brand tagline the same way | Type scale, tracking and spacing |  |
| 128 | todo |  | Define a minimum-size type token | Type scale, tracking and spacing |  |
| 129 | todo |  | Review the map pin numeral size | Type scale, tracking and spacing |  |
| 130 | todo |  | Cap tracking on body-adjacent text | Type scale, tracking and spacing |  |
| 131 | todo |  | Remove letter-spacing from sentence-case copy | Type scale, tracking and spacing |  |
| 132 | todo |  | Loosen hero heading line-height | Type scale, tracking and spacing |  |
| 133 | todo |  | Set a body line-height token pair | Type scale, tracking and spacing |  |
| 134 | todo |  | Cap reading measure on story and stop text | Type scale, tracking and spacing |  |
| 135 | todo |  | Give route-card media and map preview a visible inset | Type scale, tracking and spacing |  |
| 136 | todo |  | Standardise card inner padding | Type scale, tracking and spacing |  |
| 137 | todo |  | Replace the hero eyebrow chip and kicker-over-heading pattern | Type scale, tracking and spacing |  |
| 138 | todo |  | Define duration tokens | Motion tokens and principles |  |
| 139 | todo |  | Define easing tokens beyond the single ease-out | Motion tokens and principles |  |
| 140 | todo |  | Ban the default `ease` and bare transitions | Motion tokens and principles |  |
| 141 | todo |  | Ban `transition: all` and list properties explicitly | Motion tokens and principles |  |
| 142 | todo |  | Keep UI motion under 300ms | Motion tokens and principles |  |
| 143 | todo |  | Restrict animated properties to transform and opacity | Motion tokens and principles |  |
| 144 | todo |  | Write a motion inventory in visual-contract.md | Motion tokens and principles |  |
| 145 | todo | data-reveal | Decide which surfaces get no motion | Motion tokens and principles |  |
| 146 | todo |  | Add a global reduced-motion safety net in base.css | Motion tokens and principles |  |
| 147 | todo | data-motion | Test reduced motion across all views | Motion tokens and principles |  |
| 148 | todo |  | Stop the infinite hero drift from running forever | Motion tokens and principles |  |
| 149 | todo |  | Keep motion frequency-aware | Motion tokens and principles |  |
| 150 | todo |  | Use scale(0.97) on press consistently | Motion tokens and principles |  |
| 151 | todo |  | Add a view-level page transition | Page transitions, cards and hover |  |
| 152 | todo |  | Evaluate the View Transitions API as progressive enhancement | Page transitions, cards and hover |  |
| 153 | todo |  | Keep focus handling intact through transitions | Page transitions, cards and hover |  |
| 154 | todo |  | Gate card hover on real pointers | Page transitions, cards and hover |  |
| 155 | todo |  | Refine the route-card hover | Page transitions, cards and hover |  |
| 156 | todo |  | Add card press feedback | Page transitions, cards and hover |  |
| 157 | todo |  | Make card links one tap target | Page transitions, cards and hover |  |
| 158 | todo |  | Stagger home card reveal by a capped step | Page transitions, cards and hover |  |
| 159 | todo |  | Do not re-reveal on back navigation | Page transitions, cards and hover |  |
| 160 | todo |  | Add a skeleton for the generated route preview | Page transitions, cards and hover |  |
| 161 | todo |  | Add skeletons for the route map container | Page transitions, cards and hover |  |
| 162 | todo |  | Fade photographs in on load | Page transitions, cards and hover |  |
| 163 | todo |  | Add icon morphs for play/pause and menu | Page transitions, cards and hover |  |
| 164 | todo |  | Define the stop-selection sync model | Stop selection, bottom sheet and listen |  |
| 165 | todo |  | Animate the rail-to-marker highlight | Stop selection, bottom sheet and listen |  |
| 166 | todo |  | Pan the map on select without competing animations | Stop selection, bottom sheet and listen |  |
| 167 | todo |  | Crossfade the stop panel content | Stop selection, bottom sheet and listen |  |
| 168 | todo |  | Respect scroll position on select | Stop selection, bottom sheet and listen |  |
| 169 | todo |  | Build the phone story sheet as a draggable bottom sheet | Stop selection, bottom sheet and listen |  |
| 170 | todo |  | Drive sheet release with velocity-aware springs | Stop selection, bottom sheet and listen |  |
| 171 | todo |  | Make the sheet interruptible | Stop selection, bottom sheet and listen |  |
| 172 | todo |  | Add sheet rubber-banding at the extremes | Stop selection, bottom sheet and listen |  |
| 173 | todo |  | Resolve sheet-versus-content scroll | Stop selection, bottom sheet and listen |  |
| 174 | todo |  | Add a sheet handle with a 44px hit area and keyboard path | Stop selection, bottom sheet and listen |  |
| 175 | todo |  | Dim the map behind the full sheet | Stop selection, bottom sheet and listen |  |
| 176 | todo |  | Animate the listen bar in and out | Stop selection, bottom sheet and listen |  |
| 177 | todo |  | Add a listen-bar progress indicator using transform | Stop selection, bottom sheet and listen |  |
| 178 | todo |  | Update the listen bar's "next stop" label with a short slide | Stop selection, bottom sheet and listen |  |
| 179 | todo |  | Decide on the `motion` library | Animation performance and library choice |  |
| 180 | todo |  | Prototype the sheet spring in WAAPI/linear() easing | Animation performance and library choice |  |
| 181 | todo |  | Measure `motion` bundle cost if considered | Animation performance and library choice |  |
| 182 | todo |  | Profile animations at 4x CPU throttle | Animation performance and library choice |  |
| 183 | todo |  | Add a performance check to Playwright | Animation performance and library choice |  |
| 184 | todo |  | Use will-change sparingly | Animation performance and library choice |  |
| 185 | todo |  | Avoid animating CSS variables that cascade | Animation performance and library choice |  |
| 186 | todo |  | Avoid large blur and backdrop-filter on animated layers | Animation performance and library choice |  |
| 187 | todo |  | Keep the IntersectionObserver reveal cheap | Animation performance and library choice |  |
| 188 | todo |  | Pause hero drift and reveals when the tab is hidden | Animation performance and library choice |  |
| 189 | todo |  | Remove the tap highlight flash | Mobile-native feel |  |
| 190 | todo |  | Replace remaining 100vh uses with svh/dvh | Mobile-native feel |  |
| 191 | todo |  | Audit safe-area handling at every edge | Mobile-native feel |  |
| 192 | todo |  | Pad the listen bar for the home indicator | Mobile-native feel |  |
| 193 | todo |  | Enforce 44px targets on a table of controls | Mobile-native feel |  |
| 194 | todo |  | Add `touch-action: manipulation` to controls | Mobile-native feel |  |
| 195 | todo |  | Stop text selection on controls | Mobile-native feel |  |
| 196 | todo |  | Prevent iOS input zoom | Mobile-native feel |  |
| 197 | todo |  | Contain overscroll in the sheet and bottom bar | Mobile-native feel |  |
| 198 | todo |  | Decide on pull-to-refresh | Mobile-native feel |  |
| 199 | todo |  | Polish the PWA icon set | Mobile-native feel |  |
| 200 | todo |  | Add a splash and standalone status-bar treatment | Mobile-native feel |  |
| 201 | todo |  | Support landscape on phones | Mobile-native feel |  |
| 202 | todo |  | Place primary actions in thumb reach | Mobile-native feel |  |
| 203 | todo |  | Add edge-swipe-safe layouts | Mobile-native feel |  |
| 204 | todo |  | Add sensible gestures only where discoverable | Mobile-native feel |  |
| 205 | todo |  | Fix sticky hover on touch globally | Mobile-native feel |  |
| 206 | todo |  | Redesign the stop marker | Maps UI |  |
| 207 | todo |  | Give markers a 44px touch hit area | Maps UI |  |
| 208 | todo |  | Add marker selection and entry motion | Maps UI |  |
| 209 | todo |  | Decide on marker clustering | Maps UI |  |
| 210 | todo |  | Offer a cluster design for a future overview map | Maps UI |  |
| 211 | todo |  | Restyle Leaflet zoom controls | Maps UI |  |
| 212 | todo |  | Move controls out of the thumb-blocked zone | Maps UI |  |
| 213 | todo |  | Polish the layer switcher | Maps UI |  |
| 214 | todo |  | Persist the chosen layer per visit | Maps UI |  |
| 215 | todo |  | Keep attribution visible and compact | Maps UI |  |
| 216 | todo |  | Style the route line for contrast | Maps UI |  |
| 217 | todo |  | Show tile loading and error states | Maps UI |  |
| 218 | todo |  | Fit bounds with padding that respects the sheet | Maps UI |  |
| 219 | todo |  | Make the map keyboard operable | Maps UI |  |
| 220 | todo |  | Draw the elevation line on first view | Data visualisation |  |
| 221 | todo |  | Fade in the elevation area after the line | Data visualisation |  |
| 222 | todo |  | Keep elevation SVG pre-render identical | Data visualisation |  |
| 223 | todo |  | Add an elevation hover/touch scrub | Data visualisation |  |
| 224 | todo |  | Label elevation axes legibly | Data visualisation |  |
| 225 | todo |  | State when elevation data is missing | Data visualisation |  |
| 226 | todo |  | Make the card sparkline decorative-safe | Data visualisation |  |
| 227 | todo |  | Design the climate chart for contrast and no colour-only meaning | Data visualisation |  |
| 228 | todo |  | Handle small-screen chart layout | Data visualisation |  |
| 229 | todo |  | Source and date the climate and elevation data | Data visualisation |  |
| 230 | todo |  | Define crop rules per slot | Photography treatment |  |
| 231 | todo |  | Store a focal point per photograph | Photography treatment |  |
| 232 | todo |  | Serve responsive image sizes | Photography treatment |  |
| 233 | todo |  | Reserve aspect ratio to stop shift | Photography treatment |  |
| 234 | todo |  | Unify the colour grade lightly | Photography treatment |  |
| 235 | todo |  | Make credits readable on photographs | Photography treatment |  |
| 236 | todo |  | Keep the rights line honest | Photography treatment |  |
| 237 | todo |  | Check photo legibility over text in light and dark grounds | Photography treatment |  |
| 238 | todo |  | Give photographs a torn-edge fallback | Photography treatment |  |
| 239 | todo |  | Home: tune the hero composition | Per-page polish |  |
| 240 | todo |  | Home: make the featured route-card grid breathe | Per-page polish |  |
| 241 | todo |  | Catalogue: polish filter chips and the result count | Per-page polish |  |
| 242 | todo |  | Catalogue: add row hover and press that match cards | Per-page polish |  |
| 243 | todo |  | Route: remove the side-tab border treatment | Per-page polish |  |
| 244 | todo |  | Route: refine the facts grid over the hero | Per-page polish |  |
| 245 | todo |  | Route: stabilise the sticky bar | Per-page polish |  |
| 246 | todo |  | Story: polish the reading column | Per-page polish |  |
| 247 | todo |  | Story: add a reading-progress hairline | Per-page polish |  |
| 248 | todo |  | Studio: smooth the stepper and stop list | Per-page polish |  |
| 249 | todo |  | Journey: animate the progress ring and badges honestly | Per-page polish |  |
| 250 | todo |  | About and 404: finish the plain hero and recovery path | Per-page polish |  |
| 251 | todo |  | Build a client-side search index | Global search and suggestions |  |
| 252 | todo |  | Add a global search box to the header | Global search and suggestions |  |
| 253 | todo |  | Rank results by field weight | Global search and suggestions |  |
| 254 | todo |  | Show typed suggestions as you type | Global search and suggestions |  |
| 255 | todo |  | Write a dedicated no-results state | Global search and suggestions |  |
| 256 | todo |  | Make search results a shareable URL | Global search and suggestions |  |
| 257 | todo |  | Support quoted-phrase and place-name queries | Global search and suggestions |  |
| 258 | todo |  | Log zero-result queries locally only | Global search and suggestions |  |
| 259 | todo |  | Add filter chips on Explore | Filters, sort and recent searches |  |
| 260 | todo |  | Hide filters that have no data | Filters, sort and recent searches |  |
| 261 | todo |  | Add sort options | Filters, sort and recent searches |  |
| 262 | todo |  | Reflect filters in the URL | Filters, sort and recent searches |  |
| 263 | todo |  | Store recent searches locally | Filters, sort and recent searches |  |
| 264 | todo |  | Add a language filter that is honest about coverage | Filters, sort and recent searches |  |
| 265 | blocked | needs-evidence | Add a duration filter with stated ranges | Filters, sort and recent searches | needs-evidence |
| 266 | todo |  | Create an Explore map view toggle | Map-based discovery and nearby routes |  |
| 267 | todo |  | Plot route start points as markers | Map-based discovery and nearby routes |  |
| 268 | todo |  | Add a 'Near me' action behind explicit consent | Map-based discovery and nearby routes |  |
| 269 | todo |  | Compute nearest routes on device | Map-based discovery and nearby routes |  |
| 270 | todo |  | Add a manual place picker fallback | Map-based discovery and nearby routes |  |
| 271 | todo |  | Respect the tile policy on the discovery map | Map-based discovery and nearby routes |  |
| 272 | todo |  | Cluster markers when the catalogue grows | Map-based discovery and nearby routes |  |
| 273 | todo |  | Add a route-start card list under the map | Map-based discovery and nearby routes |  |
| 274 | todo |  | Show a map-free fallback | Map-based discovery and nearby routes |  |
| 275 | todo |  | Define collections as editorial data | Collections, themes and seasonal picks |  |
| 276 | todo |  | Render a Collections index and collection pages | Collections, themes and seasonal picks |  |
| 277 | todo |  | Add theme landing pages from real tags | Collections, themes and seasonal picks |  |
| 278 | blocked | needs-evidence | Add a 'Weekend from city X' finder | Collections, themes and seasonal picks | needs-evidence |
| 279 | blocked | needs-decision | Add seasonal picks editorially | Collections, themes and seasonal picks | needs-decision |
| 280 | todo |  | Add a 'Continue where you left off' strip on Home | Collections, themes and seasonal picks |  |
| 281 | blocked | needs-evidence | Add a 'Short on time' collection from stated durations | Collections, themes and seasonal picks | needs-evidence |
| 282 | todo |  | Add stop-to-stop navigation | Route page: stops, gallery, glossary, qu |  |
| 283 | todo |  | Deep-link every stop | Route page: stops, gallery, glossary, qu |  |
| 284 | todo |  | Build a licensed image gallery | Route page: stops, gallery, glossary, qu |  |
| 285 | todo |  | Add an inline glossary | Route page: stops, gallery, glossary, qu |  |
| 286 | todo |  | Create a Glossary page | Route page: stops, gallery, glossary, qu |  |
| 287 | todo |  | Add per-stop checklists | Route page: stops, gallery, glossary, qu |  |
| 288 | todo |  | Add editorial quests without scoring | Route page: stops, gallery, glossary, qu |  |
| 289 | todo |  | Add a Stop notes field | Route page: stops, gallery, glossary, qu |  |
| 290 | todo |  | Add keyboard shortcuts to the lightbox and stop index | Route page: stops, gallery, glossary, qu |  |
| 291 | todo |  | Add a Share a stop action | Route page: share, print, export, compar |  |
| 292 | todo |  | Add a print stylesheet | Route page: share, print, export, compar |  |
| 293 | todo |  | Export editorial lines as GeoJSON | Route page: share, print, export, compar |  |
| 294 | todo |  | Export editorial lines as GPX | Route page: share, print, export, compar |  |
| 295 | todo |  | Label recorded tracks differently from editorial lines | Route page: share, print, export, compar |  |
| 296 | todo |  | Add a route comparison view | Route page: share, print, export, compar |  |
| 297 | todo |  | Add an accessibility mode toggle | Route page: share, print, export, compar |  |
| 298 | todo |  | Provide a text alternative for every map | Route page: share, print, export, compar |  |
| 299 | todo |  | Add a copy-citation button | Route page: share, print, export, compar |  |
| 300 | todo |  | Add a Start walk screen | Walk mode |  |
| 301 | todo |  | Show live position on the route map | Walk mode |  |
| 302 | todo |  | Show next-stop distance and direction | Walk mode |  |
| 303 | blocked | needs-decision | Give off-route hints gently | Walk mode | needs-decision |
| 304 | todo |  | Hold a screen wake lock during walk mode | Walk mode |  |
| 305 | todo |  | Make walk mode battery-aware | Walk mode |  |
| 306 | todo |  | Record a walk with real measurement | Walk mode |  |
| 307 | todo |  | Auto-pause on stationary periods | Walk mode |  |
| 308 | todo |  | Handle permission and signal failures | Walk mode |  |
| 309 | blocked | needs-decision | Add a compass-free arrival cue | Walk mode | needs-decision |
| 310 | todo |  | Add a Walk summary screen | Walk mode |  |
| 311 | todo |  | Add a listening queue | Audio player |  |
| 312 | todo |  | Add playback speed | Audio player |  |
| 313 | todo |  | Add a sleep timer | Audio player |  |
| 314 | todo |  | Sync a transcript with playback | Audio player |  |
| 315 | todo |  | Resume where you stopped | Audio player |  |
| 316 | todo |  | Bookmark moments | Audio player |  |
| 317 | todo |  | Offer per-stop and per-story playback | Audio player |  |
| 318 | todo |  | Wire up Media Session | Audio player |  |
| 319 | blocked | needs-evidence | Say plainly what background playback can do | Audio player | needs-evidence |
| 320 | todo |  | Make the voice selectable | Audio player |  |
| 321 | blocked | needs-decision | Prepare a recorded-narration slot | Audio player | needs-decision |
| 322 | todo |  | Add a skip-back/skip-forward by sentence control | Audio player |  |
| 323 | todo |  | Pause on audio interruption and resume politely | Audio player |  |
| 324 | todo |  | Show reading progress | Stories reader |  |
| 325 | todo |  | Generate a table of contents | Stories reader |  |
| 326 | todo |  | Add reading modes | Stories reader |  |
| 327 | todo |  | Add text size and line-length controls | Stories reader |  |
| 328 | todo |  | Show related stories and routes | Stories reader |  |
| 329 | todo |  | Support citations and footnotes | Stories reader |  |
| 330 | todo |  | Add a 'Sources' block per story | Stories reader |  |
| 331 | todo |  | Remember reading position per story | Stories reader |  |
| 332 | todo |  | Add a distraction-free focus mode | Stories reader |  |
| 333 | todo |  | Add Save route buttons | My Journey: saved routes, walks, journal |  |
| 334 | todo |  | List completed walks with measured data | My Journey: saved routes, walks, journal |  |
| 335 | todo |  | Add a journal with local photos | My Journey: saved routes, walks, journal |  |
| 336 | todo |  | Strip photo metadata on import | My Journey: saved routes, walks, journal |  |
| 337 | todo |  | Show storage usage and a purge control | My Journey: saved routes, walks, journal |  |
| 338 | todo |  | Request persistent storage politely | My Journey: saved routes, walks, journal |  |
| 339 | todo |  | Award badges only for real achievements | My Journey: saved routes, walks, journal |  |
| 340 | todo |  | Show an honest empty state | My Journey: saved routes, walks, journal |  |
| 341 | todo |  | Add a manual language override in the player | My Journey: saved routes, walks, journal |  |
| 342 | todo |  | Export all journey data as JSON | My Journey: export, import and backups |  |
| 343 | todo |  | Import with validation and preview | My Journey: export, import and backups |  |
| 344 | todo |  | Handle photos in backups | My Journey: export, import and backups |  |
| 345 | todo |  | Prompt periodic device-local backups | My Journey: export, import and backups |  |
| 346 | todo |  | Migrate stored data between versions | My Journey: export, import and backups |  |
| 347 | todo |  | Explain where data lives | My Journey: export, import and backups |  |
| 348 | todo |  | Offer a one-click Delete everything | My Journey: export, import and backups |  |
| 349 | todo |  | Add a data-integrity check | My Journey: export, import and backups |  |
| 350 | todo |  | Extract UI strings to a catalogue | Multilingual UI and language switcher |  |
| 351 | todo |  | Add a language switcher that lists only shipped languages | Multilingual UI and language switcher |  |
| 352 | todo |  | Implement per-unit fallback | Multilingual UI and language switcher |  |
| 353 | todo |  | Set lang and hreflang correctly | Multilingual UI and language switcher |  |
| 354 | blocked | needs-decision | Load script-specific fonts on demand | Multilingual UI and language switcher | needs-decision |
| 355 | todo |  | Format numbers and dates by locale | Multilingual UI and language switcher |  |
| 356 | todo |  | Pick speech voices per language | Multilingual UI and language switcher |  |
| 357 | todo |  | Persist the language choice | Multilingual UI and language switcher |  |
| 358 | todo |  | Add a What's new page | Multilingual UI and language switcher |  |
| 359 | todo |  | Add a skippable first-run welcome | Onboarding, help and feedback |  |
| 360 | todo |  | Add contextual first-use hints | Onboarding, help and feedback |  |
| 361 | todo |  | Build a Help/FAQ page | Onboarding, help and feedback |  |
| 362 | todo |  | Add a Settings page | Onboarding, help and feedback |  |
| 363 | todo |  | Add a feedback widget without a backend | Onboarding, help and feedback |  |
| 364 | todo |  | Collect structured feedback options | Onboarding, help and feedback |  |
| 365 | todo |  | Add a Report a problem on map/GPX | Onboarding, help and feedback |  |
| 366 | blocked | needs-decision | Provide a Contact and corrections page | Onboarding, help and feedback | needs-decision |
| 367 | todo |  | Add a newsletter placeholder component | Newsletter, notifications, sharing and i |  |
| 368 | blocked | needs-backend,needs-decision | Wire a real newsletter provider later | Newsletter, notifications, sharing and i | needs-backend |
| 369 | blocked | needs-backend | Add a web push opt-in for new routes | Newsletter, notifications, sharing and i | needs-backend |
| 370 | blocked | needs-backend,needs-decision | Build the push sender pipeline | Newsletter, notifications, sharing and i | needs-backend |
| 371 | todo |  | Add a manifest and service worker with an app-shell cache | Newsletter, notifications, sharing and i |  |
| 372 | todo |  | Show a custom install prompt | Newsletter, notifications, sharing and i |  |
| 373 | blocked | needs-decision | Register Web Share Target | Newsletter, notifications, sharing and i | needs-decision |
| 374 | todo |  | Add rich share cards | Newsletter, notifications, sharing and i |  |
| 375 | todo |  | Add a performance budget for new features | Newsletter, notifications, sharing and i |  |
| 376 | todo |  | Write the route research template | Research workflow and source rules |  |
| 377 | todo |  | Define the source tiers | Research workflow and source rules |  |
| 378 | todo |  | Forbid uncited claims in published copy | Research workflow and source rules |  |
| 379 | todo |  | Create a claims ledger per route | Research workflow and source rules |  |
| 380 | todo |  | Record access dates on every source | Research workflow and source rules |  |
| 381 | todo |  | Archive cited pages | Research workflow and source rules |  |
| 382 | todo |  | Add a link-rot checker | Research workflow and source rules |  |
| 383 | todo |  | Separate fact from interpretation in copy | Research workflow and source rules |  |
| 384 | todo |  | Write the "unknown" convention | Research workflow and source rules |  |
| 385 | blocked | needs-evidence | Log rejected claims | Research workflow and source rules | needs-evidence |
| 386 | todo |  | Publish a photo licence policy | Licence rules, editorial checklist, fiel |  |
| 387 | todo |  | Ban "found online" images | Licence rules, editorial checklist, fiel |  |
| 388 | todo |  | Define the text-reuse rule | Licence rules, editorial checklist, fiel |  |
| 389 | todo |  | Add a credits page | Licence rules, editorial checklist, fiel |  |
| 390 | todo |  | Write the editorial checklist | Licence rules, editorial checklist, fiel |  |
| 391 | todo |  | Add a style guide for heritage terms | Licence rules, editorial checklist, fiel |  |
| 392 | todo |  | Ban unsearched marketing words | Licence rules, editorial checklist, fiel |  |
| 393 | blocked | needs-evidence | Create a field-verification protocol | Licence rules, editorial checklist, fiel | needs-evidence |
| 394 | todo |  | Add a "verified on site" badge rule | Licence rules, editorial checklist, fiel |  |
| 395 | blocked | needs-decision | Open a community correction channel | Licence rules, editorial checklist, fiel | needs-decision |
| 396 | todo |  | Rank candidate routes by evidence | New routes and stories |  |
| 397 | blocked | needs-decision | Pick the next route from the keyword bank | New routes and stories | needs-decision |
| 398 | todo |  | Draft the Pondicherry walking route outline | New routes and stories |  |
| 399 | todo |  | Complete hours for the 5 stops lacking them | New routes and stories |  |
| 400 | blocked | needs-evidence | Source fees for all 15 stops | New routes and stories | needs-evidence |
| 401 | todo |  | Grow Hampi beyond 8 stops only with sources | New routes and stories |  |
| 402 | todo |  | Write the Thanjavur stop expansion plan | New routes and stories |  |
| 403 | todo |  | Write a new story template | New routes and stories |  |
| 404 | todo |  | Commission three new stories from the claims ledger | New routes and stories |  |
| 405 | todo |  | Add a route-requirements gate | New routes and stories |  |
| 406 | todo |  | Surface content/practical on route pages | Trip-planner pages from content/practica |  |
| 407 | todo |  | Add a "Getting there" section | Trip-planner pages from content/practica |  |
| 408 | todo |  | Add visiting hours table per stop | Trip-planner pages from content/practica |  |
| 409 | todo |  | Show "checked" and source on every practical fact | Trip-planner pages from content/practica |  |
| 410 | todo |  | Set a refresh cadence for practical facts | Trip-planner pages from content/practica |  |
| 411 | todo |  | Write dress and conduct guidance for temples | Trip-planner pages from content/practica |  |
| 412 | blocked | needs-evidence | Add a season chart per route | Trip-planner pages from content/practica | needs-evidence |
| 413 | todo |  | Add a "best time to walk" note without inventing | Trip-planner pages from content/practica |  |
| 414 | todo |  | Build 1-day and 2-day itinerary pages | Trip-planner pages from content/practica |  |
| 415 | todo |  | Add a printable route sheet | Trip-planner pages from content/practica |  |
| 416 | todo |  | Add shareable itinerary links | Trip-planner pages from content/practica |  |
| 417 | todo |  | Add a "what to carry" checklist | Trip-planner pages from content/practica |  |
| 418 | todo |  | Add accessibility notes per stop | Trip-planner pages from content/practica |  |
| 419 | todo |  | Add safety and etiquette box | Trip-planner pages from content/practica |  |
| 420 | todo |  | Add "last reviewed" to the route index | Trip-planner pages from content/practica |  |
| 421 | todo |  | Create the blog index at /blog/ | Blog: index, template, fact-check workfl |  |
| 422 | todo |  | Design the article template | Blog: index, template, fact-check workfl |  |
| 423 | todo |  | Generate a table of contents from headings | Blog: index, template, fact-check workfl |  |
| 424 | todo |  | Set the byline to "Naarad editorial" | Blog: index, template, fact-check workfl |  |
| 425 | todo |  | Add published and updated dates | Blog: index, template, fact-check workfl |  |
| 426 | todo |  | Add a sources section to every article | Blog: index, template, fact-check workfl |  |
| 427 | todo |  | Add related-routes module | Blog: index, template, fact-check workfl |  |
| 428 | todo |  | Add an RSS feed | Blog: index, template, fact-check workfl |  |
| 429 | todo |  | Write the AI-draft fact-check workflow | Blog: index, template, fact-check workfl |  |
| 430 | todo |  | Require a claim table for AI-assisted drafts | Blog: index, template, fact-check workfl |  |
| 431 | blocked | needs-evidence | Fact-check Distribb draft #121532 | Blog: index, template, fact-check workfl | needs-evidence |
| 432 | blocked | needs-evidence | Fact-check Distribb draft #121533 | Blog: index, template, fact-check workfl | needs-evidence |
| 433 | todo |  | Store both drafts in the repo as unpublished | Blog: index, template, fact-check workfl |  |
| 434 | blocked | needs-decision | Decide whether to rewrite or publish after review | Blog: index, template, fact-check workfl | needs-decision |
| 435 | todo |  | Store the keyword bank in the repo | Blog: index, template, fact-check workfl |  |
| 436 | todo |  | Map each keyword to one page | Keyword targets and on-page SEO |  |
| 437 | blocked | needs-decision | Decide the Bangalore getaways page type | Keyword targets and on-page SEO | needs-decision |
| 438 | todo |  | Write the Hampi itinerary page | Keyword targets and on-page SEO |  |
| 439 | blocked | needs-evidence | Write a Chennai getaways page | Keyword targets and on-page SEO | needs-evidence |
| 440 | todo |  | Plan a Pondicherry itinerary route first | Keyword targets and on-page SEO |  |
| 441 | todo |  | Treat "heritage tours in India" as a hub | Keyword targets and on-page SEO |  |
| 442 | todo |  | Do not target "authentic" | Keyword targets and on-page SEO |  |
| 443 | todo |  | Write title patterns | Keyword targets and on-page SEO |  |
| 444 | todo |  | Write unique meta descriptions | Keyword targets and on-page SEO |  |
| 445 | todo |  | Enforce one h1 and ordered headings | Keyword targets and on-page SEO |  |
| 446 | todo |  | Define internal link rules | Keyword targets and on-page SEO |  |
| 447 | todo |  | Write an anchor text guide | Keyword targets and on-page SEO |  |
| 448 | todo |  | Add visible breadcrumbs | Keyword targets and on-page SEO |  |
| 449 | todo |  | Add FAQ blocks only where real questions exist | Keyword targets and on-page SEO |  |
| 450 | todo |  | Set canonical URLs and noindex rules | Keyword targets and on-page SEO |  |
| 451 | todo |  | Add Article JSON-LD to blog posts | Structured data, sitemap, robots |  |
| 452 | todo |  | Add TouristTrip JSON-LD to routes | Structured data, sitemap, robots |  |
| 453 | todo |  | Add Place JSON-LD to stops | Structured data, sitemap, robots |  |
| 454 | todo |  | Extend BreadcrumbList to blog and stories | Structured data, sitemap, robots |  |
| 455 | todo |  | Ban invented ratings | Structured data, sitemap, robots |  |
| 456 | todo |  | Add FAQPage schema only with visible FAQ | Structured data, sitemap, robots |  |
| 457 | todo |  | Generate accurate lastmod in sitemap | Structured data, sitemap, robots |  |
| 458 | todo |  | Include blog, stories and new routes in sitemap | Structured data, sitemap, robots |  |
| 459 | todo |  | Audit robots.txt | Structured data, sitemap, robots |  |
| 460 | todo |  | Add a schema validation step to verify.sh | Structured data, sitemap, robots |  |
| 461 | todo |  | Document the weekly Search Console check | Search Console workflow and AI-search vi |  |
| 462 | todo |  | Log the baseline of 53 impressions/week | Search Console workflow and AI-search vi |  |
| 463 | todo |  | Separate brand from non-brand queries | Search Console workflow and AI-search vi |  |
| 464 | todo |  | Request indexing for new pages once | Search Console workflow and AI-search vi |  |
| 465 | todo |  | Track queries that would deserve FAQ answers | Search Console workflow and AI-search vi |  |
| 466 | todo |  | Publish llms.txt | Search Console workflow and AI-search vi |  |
| 467 | todo |  | Make pages quotable for AI citation | Search Console workflow and AI-search vi |  |
| 468 | blocked | needs-evidence | Test AI-answer visibility manually each quarter | Search Console workflow and AI-search vi | needs-evidence |
| 469 | todo |  | List heritage bodies to contact | Backlinks, PR, Wikipedia and citations |  |
| 470 | todo |  | Write an outreach email template | Backlinks, PR, Wikipedia and citations |  |
| 471 | todo |  | List tourism boards | Backlinks, PR, Wikipedia and citations |  |
| 472 | todo |  | Build a blogger and walk-leader list | Backlinks, PR, Wikipedia and citations |  |
| 473 | todo |  | Check Wikipedia/Wikivoyage hygiene | Backlinks, PR, Wikipedia and citations |  |
| 474 | todo |  | Offer Wikivoyage citations where Naarad's sources help | Backlinks, PR, Wikipedia and citations |  |
| 475 | todo |  | Publish a "cite Naarad" page | Backlinks, PR, Wikipedia and citations |  |
| 476 | blocked | needs-decision | Review the Distribb backlink exchange offer decision | Backlinks, PR, Wikipedia and citations | needs-decision |
| 477 | todo |  | Generate per-route share cards | Social, share cards, short-form and Goog |  |
| 478 | todo |  | Add Open Graph and Twitter tags | Social, share cards, short-form and Goog |  |
| 479 | todo |  | Write a short-form content plan | Social, share cards, short-form and Goog |  |
| 480 | todo |  | Set rules for video | Social, share cards, short-form and Goog |  |
| 481 | blocked | needs-decision | Pick the channels | Social, share cards, short-form and Goog | needs-decision |
| 482 | todo |  | Decide whether a Google Business Profile applies | Social, share cards, short-form and Goog |  |
| 483 | todo |  | Add Maps-friendly stop links | Social, share cards, short-form and Goog |  |
| 484 | blocked | needs-decision | Choose a newsletter approach | Newsletter, analytics and funnels | needs-decision |
| 485 | todo |  | Write the privacy notice for email signup | Newsletter, analytics and funnels |  |
| 486 | todo |  | Define the newsletter format | Newsletter, analytics and funnels |  |
| 487 | todo |  | Define the analytics event list | Newsletter, analytics and funnels |  |
| 488 | todo |  | Make analytics consented and privacy-first | Newsletter, analytics and funnels |  |
| 489 | blocked | needs-budget | Pick an analytics tool within cost limits | Newsletter, analytics and funnels | needs-budget |
| 490 | todo |  | Define the account-free funnel | Newsletter, analytics and funnels |  |
| 491 | todo |  | Require evidence before building from analytics | Newsletter, analytics and funnels |  |
| 492 | blocked | needs-evidence | Assess Kannada, Tamil and Hindi demand | Local-language SEO, calendar, dashboards | needs-evidence |
| 493 | blocked | needs-decision | Plan translation quality control | Local-language SEO, calendar, dashboards | needs-decision |
| 494 | todo |  | Add hreflang only when pages exist | Local-language SEO, calendar, dashboards |  |
| 495 | todo |  | Create a content calendar | Local-language SEO, calendar, dashboards |  |
| 496 | todo |  | Set a realistic cadence | Local-language SEO, calendar, dashboards |  |
| 497 | todo |  | Build a measurement dashboard | Local-language SEO, calendar, dashboards |  |
| 498 | todo |  | Track content quality metrics | Local-language SEO, calendar, dashboards |  |
| 499 | todo |  | Create a competitor and alternative watchlist | Local-language SEO, calendar, dashboards |  |
| 500 | todo |  | Review the roadmap items against evidence each quarter | Local-language SEO, calendar, dashboards |  |
| 501 | todo |  | Define a bundle manifest schema | Offline route bundles v2 |  |
| 502 | todo |  | Generate manifests in build-site.mjs | Offline route bundles v2 |  |
| 503 | todo |  | Verify sha256 on download | Offline route bundles v2 |  |
| 504 | todo |  | Version bundles independently of the shell | Offline route bundles v2 |  |
| 505 | todo |  | Pre-flight storage check | Offline route bundles v2 |  |
| 506 | todo |  | Resumable downloads | Offline route bundles v2 |  |
| 507 | todo |  | Download queue with concurrency cap | Offline route bundles v2 |  |
| 508 | todo |  | Per-bundle delete and delete-all | Offline route bundles v2 |  |
| 509 | todo |  | Update-available flow | Offline route bundles v2 |  |
| 510 | todo |  | Atomic bundle swap | Offline route bundles v2 |  |
| 511 | todo |  | Bundle integrity self-check on open | Offline route bundles v2 |  |
| 512 | todo |  | Offline coverage indicator | Offline route bundles v2 |  |
| 513 | blocked | needs-decision | Cap total offline footprint | Offline route bundles v2 | needs-decision |
| 514 | todo |  | Gate bundles behind F-002 with a kill switch | Offline route bundles v2 |  |
| 515 | blocked | needs-decision | Write a basemap options memo | Basemap strategy under OSM policy | needs-decision |
| 516 | todo |  | Licence review checklist for tile data | Basemap strategy under OSM policy |  |
| 517 | todo |  | Prototype a PMTiles extract for one route | Basemap strategy under OSM policy |  |
| 518 | blocked | needs-budget | Serve PMTiles via HTTP Range from R2 with CORS | Basemap strategy under OSM policy | needs-budget |
| 519 | todo |  | Choose a renderer and measure its weight | Basemap strategy under OSM policy |  |
| 520 | todo |  | Draw a simple vector fallback map | Basemap strategy under OSM policy |  |
| 521 | todo |  | Enforce attribution on every map surface | Basemap strategy under OSM policy |  |
| 522 | todo |  | Add a guard against bulk OSM tile fetching | Basemap strategy under OSM policy |  |
| 523 | todo |  | Document the cache strategy per route type | Service worker architecture |  |
| 524 | todo |  | Implement stale-while-revalidate for content JSON | Service worker architecture |  |
| 525 | todo |  | Use network-first with timeout for HTML navigations | Service worker architecture |  |
| 526 | todo |  | Support Range requests for audio | Service worker architecture |  |
| 527 | todo |  | Do not cache partial 206 responses blindly | Service worker architecture |  |
| 528 | todo |  | Cache-version migration plan | Service worker architecture |  |
| 529 | todo |  | Skip-waiting policy | Service worker architecture |  |
| 530 | todo |  | Rollback-safe SW | Service worker architecture |  |
| 531 | todo |  | Handle navigation preload | Service worker architecture |  |
| 532 | todo |  | Background Sync for queued events | Service worker architecture |  |
| 533 | todo |  | Fallback queue replay for browsers without Background Sync | Service worker architecture |  |
| 534 | todo |  | Dedupe and expire queued events | Service worker architecture |  |
| 535 | todo |  | Request persistent storage at the right moment | Service worker architecture |  |
| 536 | todo |  | Quota and eviction handling | Service worker architecture |  |
| 537 | todo |  | SW error telemetry hooks | Service worker architecture |  |
| 538 | blocked | needs-decision | Set up consented field RUM | Performance: measurement and budgets | needs-decision |
| 539 | blocked | needs-decision | Pick a RUM sink within budget | Performance: measurement and budgets | needs-decision |
| 540 | todo |  | Segment vitals by page type | Performance: measurement and budgets |  |
| 541 | todo |  | Show sample sizes beside every field metric | Performance: measurement and budgets |  |
| 542 | todo |  | Record a lab baseline per page type | Performance: measurement and budgets |  |
| 543 | todo |  | Define a low-end Android throttled profile | Performance: measurement and budgets |  |
| 544 | todo |  | Add a 3G profile run | Performance: measurement and budgets |  |
| 545 | blocked | needs-devices | Run field verification on real low-end phones | Performance: measurement and budgets | needs-devices |
| 546 | todo |  | Set an image budget per template | Performance: measurement and budgets |  |
| 547 | todo |  | Generate AVIF and WebP with fallbacks | Performance: measurement and budgets |  |
| 548 | todo |  | Add responsive `srcset`/`sizes` correctness test | Performance: measurement and budgets |  |
| 549 | todo |  | Reserve image space to prevent CLS | Performance: measurement and budgets |  |
| 550 | todo |  | Font loading and fallback metrics | Performance: measurement and budgets |  |
| 551 | todo |  | JS budget with a CI gate | Performance: measurement and budgets |  |
| 552 | todo |  | Code-split by route and by feature | Performance: measurement and budgets |  |
| 553 | todo |  | Preload and priority hints | Performance: measurement and budgets |  |
| 554 | todo |  | INP investigation on interactive pages | Performance: measurement and budgets |  |
| 555 | todo |  | Document GitHub Pages header limits | Hosting, caching headers and CDN |  |
| 556 | todo |  | Adopt content-hashed filenames for static assets | Hosting, caching headers and CDN |  |
| 557 | todo |  | Use the SW as the long-cache layer | Hosting, caching headers and CDN |  |
| 558 | blocked | needs-decision | Evaluate Cloudflare in front of Pages | Hosting, caching headers and CDN | needs-decision |
| 559 | blocked | needs-decision | Cloudflare Transform Rules for security and cache headers | Hosting, caching headers and CDN | needs-decision |
| 560 | blocked | needs-decision | Compare alternatives to Cloudflare | Hosting, caching headers and CDN | needs-decision |
| 561 | todo |  | Add a cache-header regression check | Hosting, caching headers and CDN |  |
| 562 | todo |  | Write a per-page-type WCAG 2.2 AA audit sheet | Accessibility audit and engineering (WCA |  |
| 563 | todo |  | Add axe-core to Playwright for every template | Accessibility audit and engineering (WCA |  |
| 564 | todo |  | Write keyboard maps per page type | Accessibility audit and engineering (WCA |  |
| 565 | todo |  | Remove keyboard traps | Accessibility audit and engineering (WCA |  |
| 566 | todo |  | Visible, high-contrast focus indicators | Accessibility audit and engineering (WCA |  |
| 567 | todo |  | Focus management on route navigation and dialogs | Accessibility audit and engineering (WCA |  |
| 568 | todo |  | Add skip links and landmark structure | Accessibility audit and engineering (WCA |  |
| 569 | todo |  | Live regions for async status | Accessibility audit and engineering (WCA |  |
| 570 | todo |  | Colour contrast on text over photos | Accessibility audit and engineering (WCA |  |
| 571 | todo |  | Test zoom at 200% and 400% and reflow at 320 CSS px | Accessibility audit and engineering (WCA |  |
| 572 | todo |  | Support text-spacing overrides | Accessibility audit and engineering (WCA |  |
| 573 | todo |  | Forced colors and high-contrast mode | Accessibility audit and engineering (WCA |  |
| 574 | todo |  | Honour prefers-reduced-motion everywhere | Accessibility audit and engineering (WCA |  |
| 575 | todo |  | Target size and spacing (2.5.8) | Accessibility audit and engineering (WCA |  |
| 576 | todo |  | Dragging alternatives (2.5.7) | Accessibility audit and engineering (WCA |  |
| 577 | todo |  | Accessible map alternative | Accessibility audit and engineering (WCA |  |
| 578 | todo |  | Consistent help and accessible authentication checks (3.2.6, 3.3.8) | Accessibility audit and engineering (WCA |  |
| 579 | blocked | needs-devices | Write screen-reader test scripts | Accessibility: assistive tech, audio and | needs-devices |
| 580 | blocked | needs-devices | Run the scripts and log defects | Accessibility: assistive tech, audio and | needs-devices |
| 581 | todo |  | Provide captions or transcripts for all audio | Accessibility: assistive tech, audio and |  |
| 582 | blocked | needs-decision | Transcript quality check | Accessibility: assistive tech, audio and | needs-decision |
| 583 | todo |  | Plain-language pass on core UI and route text | Accessibility: assistive tech, audio and |  |
| 584 | blocked | needs-decision | Dyslexia-friendly reading option | Accessibility: assistive tech, audio and | needs-decision |
| 585 | todo |  | Reading preferences panel | Accessibility: assistive tech, audio and |  |
| 586 | todo |  | Script font coverage test | Internationalisation QA |  |
| 587 | todo |  | Line-breaking and conjunct rendering checks | Internationalisation QA |  |
| 588 | blocked | needs-decision | Numerals policy | Internationalisation QA | needs-decision |
| 589 | blocked | needs-decision | Native-speaker review of UI strings | Internationalisation QA | needs-decision |
| 590 | todo |  | Pseudo-localisation test | Internationalisation QA |  |
| 591 | todo |  | Directionality and font-weight checks for Urdu | Internationalisation QA |  |
| 592 | todo |  | Test pyramid document | Testing: automated |  |
| 593 | todo |  | Property tests for URL helpers | Testing: automated |  |
| 594 | todo |  | Visual regression with Playwright snapshots | Testing: automated |  |
| 595 | todo |  | Mutation testing on core modules | Testing: automated |  |
| 596 | todo |  | Flaky-test policy | Testing: automated |  |
| 597 | todo |  | Lighthouse CI with budgets | Testing: automated |  |
| 598 | todo |  | E2E for offline scenarios | Testing: automated |  |
| 599 | todo |  | Cross-browser Playwright projects | Testing: automated |  |
| 600 | todo |  | Service worker upgrade test | Testing: automated |  |
| 601 | todo |  | Link and asset integrity checker | Testing: automated |  |
| 602 | todo |  | Test the practical-facts linter on its own | Testing: automated |  |
| 603 | todo |  | Coverage for scripts and SW | Testing: automated |  |
| 604 | blocked | needs-devices | Real-device lab plan | User research, usability and device lab | needs-devices |
| 605 | blocked | needs-budget | Acquire the minimum device set | User research, usability and device lab | needs-budget |
| 606 | blocked | needs-budget | Remote device-farm trial | User research, usability and device lab | needs-budget |
| 607 | blocked | needs-budget | Accessibility user testing with disabled users | User research, usability and device lab | needs-budget |
| 608 | blocked | needs-devices | Field usability tests for first-time visitors | User research, usability and device lab | needs-devices |
| 609 | todo |  | Test on poor connectivity in the field | User research, usability and device lab |  |
| 610 | todo |  | Required checks on main | CI/CD and supply chain |  |
| 611 | todo |  | Preview deploys for every PR | CI/CD and supply chain |  |
| 612 | todo |  | Documented rollback procedure | CI/CD and supply chain |  |
| 613 | todo |  | Automated release notes | CI/CD and supply chain |  |
| 614 | todo |  | Pin dependencies and Actions by digest | CI/CD and supply chain |  |
| 615 | todo |  | Dependency update policy | CI/CD and supply chain |  |
| 616 | todo |  | Secret scanning and push protection | CI/CD and supply chain |  |
| 617 | todo |  | Supply-chain check for installed skills and MCP servers | CI/CD and supply chain |  |
| 618 | todo |  | Error reporting without PII | Observability and operations |  |
| 619 | blocked | needs-decision | Choose an error sink within budget | Observability and operations | needs-decision |
| 620 | todo |  | Sourcemaps kept private | Observability and operations |  |
| 621 | todo |  | Uptime checks | Observability and operations |  |
| 622 | todo |  | Synthetic monitoring of key journeys | Observability and operations |  |
| 623 | blocked | needs-decision | Public status page | Observability and operations | needs-decision |
| 624 | todo |  | Alert routing and on-call note | Observability and operations |  |
| 625 | todo |  | Incident review template and monthly health report | Observability and operations |  |
| 626 | todo |  | Write ADR-0001 for Supabase as the backend | Architecture decisions and environments |  |
| 627 | todo |  | Write ADR-0002 for migrations as the only schema path | Architecture decisions and environments |  |
| 628 | todo |  | Write ADR-0003 for dormant-by-default flags | Architecture decisions and environments |  |
| 629 | todo |  | Write ADR-0004 for data residency and personal-data inventory | Architecture decisions and environments |  |
| 630 | todo |  | Define three environments with a config matrix | Architecture decisions and environments |  |
| 631 | todo |  | Create a local environment bootstrap script | Architecture decisions and environments |  |
| 632 | blocked | needs-decision | Add an environment promotion rule | Architecture decisions and environments | needs-decision |
| 633 | todo |  | Fix the backend directory layout | Project layout and migrations tooling |  |
| 634 | todo |  | Add a migration naming and header lint | Project layout and migrations tooling |  |
| 635 | todo |  | Add a migration checksum ledger | Project layout and migrations tooling |  |
| 636 | todo |  | Add a dry-run mode to the applier | Project layout and migrations tooling |  |
| 637 | todo |  | Add a lock-timeout and statement-timeout guard | Project layout and migrations tooling |  |
| 638 | todo |  | Add round-trip tests for every new migration | Project layout and migrations tooling |  |
| 639 | todo |  | Write the expand-then-contract migration playbook | Project layout and migrations tooling |  |
| 640 | blocked | needs-decision | Add a destructive-migration gate | Project layout and migrations tooling | needs-decision |
| 641 | todo |  | Design the roles model | Schema design: profiles, roles and RLS |  |
| 642 | todo |  | Add helper functions has_role and is_staff | Schema design: profiles, roles and RLS |  |
| 643 | todo |  | Extend profiles for 18+ attestation | Schema design: profiles, roles and RLS |  |
| 644 | todo |  | Add a consent ledger table | Schema design: profiles, roles and RLS |  |
| 645 | todo |  | Write RLS policies for every new table before data code | Schema design: profiles, roles and RLS |  |
| 646 | todo |  | Build a pgTAP-style assertion helper in plain SQL | Schema design: profiles, roles and RLS |  |
| 647 | todo |  | Write an RLS matrix test | Schema design: profiles, roles and RLS |  |
| 648 | todo |  | Test privilege escalation paths | Schema design: profiles, roles and RLS |  |
| 649 | todo |  | Add soft-delete columns and partial indexes | Schema design: profiles, roles and RLS |  |
| 650 | todo |  | Define a stable identifier scheme | Schema design: profiles, roles and RLS |  |
| 651 | blocked | needs-owner-account | Specify the Google sign-in flow | Auth and sessions | needs-owner-account |
| 652 | blocked | needs-owner-account | Write the Google OAuth setup checklist | Auth and sessions | needs-owner-account |
| 653 | todo |  | Design phone OTP through MSG91 behind a provider interface | Auth and sessions |  |
| 654 | blocked | needs-owner-account | List the DLT prerequisites for MSG91 | Auth and sessions | needs-owner-account |
| 655 | blocked | needs-decision | Decide OTP abuse limits | Auth and sessions | needs-decision |
| 656 | todo |  | Define session lifetime and refresh policy | Auth and sessions |  |
| 657 | todo |  | Add a role-claim refresh mechanism | Auth and sessions |  |
| 658 | todo |  | Enforce 18+ gate at sign-up | Auth and sessions |  |
| 659 | todo |  | Design the journey_entries table | Journey sync (offline-first, last-write- |  |
| 660 | todo |  | Specify last-write-wins with server clock tiebreak | Journey sync (offline-first, last-write- |  |
| 661 | todo |  | Implement tombstones | Journey sync (offline-first, last-write- |  |
| 662 | todo |  | Define the push and pull endpoints | Journey sync (offline-first, last-write- |  |
| 663 | todo |  | Write conflict rules per field class | Journey sync (offline-first, last-write- |  |
| 664 | todo |  | Build the offline queue in app/journey-store.js | Journey sync (offline-first, last-write- |  |
| 665 | todo |  | Make sync idempotent by mutation id | Journey sync (offline-first, last-write- |  |
| 666 | todo |  | Add first-sign-in merge of on-device journey | Journey sync (offline-first, last-write- |  |
| 667 | todo |  | Cap per-user journey size | Journey sync (offline-first, last-write- |  |
| 668 | todo |  | Extend creator_submissions to full drafts | Studio drafts, publications and versioni |  |
| 669 | todo |  | Define the draft state machine | Studio drafts, publications and versioni |  |
| 670 | todo |  | Sync Studio drafts with optimistic concurrency | Studio drafts, publications and versioni |  |
| 671 | todo |  | Keep draft revision history | Studio drafts, publications and versioni |  |
| 672 | todo |  | Model publications separately from drafts | Studio drafts, publications and versioni |  |
| 673 | todo |  | Version published content | Studio drafts, publications and versioni |  |
| 674 | todo |  | Validate draft content against the same schema as the static site | Studio drafts, publications and versioni |  |
| 675 | todo |  | Block submission without consent and attestation | Studio drafts, publications and versioni |  |
| 676 | todo |  | Create buckets with explicit policies | Recordings and Storage |  |
| 677 | todo |  | Design signed upload URL issuance | Recordings and Storage |  |
| 678 | todo |  | Enforce the 90 second duration limit | Recordings and Storage |  |
| 679 | todo |  | Enforce size and MIME allow-list | Recordings and Storage |  |
| 680 | blocked | needs-decision | Add a malware scan stage | Recordings and Storage | needs-decision |
| 681 | todo |  | Define recording retention | Recordings and Storage |  |
| 682 | todo |  | Handle erasure of recordings on consent withdrawal | Recordings and Storage |  |
| 683 | todo |  | Keep a recording manifest table | Recordings and Storage |  |
| 684 | todo |  | Use signed read URLs with short expiry for playback of unpublished aud | Recordings and Storage |  |
| 685 | todo |  | Design the jobs table | Pipeline state machine, jobs and webhook |  |
| 686 | todo |  | Specify the job states | Pipeline state machine, jobs and webhook |  |
| 687 | todo |  | Claim jobs safely with SKIP LOCKED | Pipeline state machine, jobs and webhook |  |
| 688 | todo |  | Add retry with exponential backoff and jitter | Pipeline state machine, jobs and webhook |  |
| 689 | todo |  | Add a dead-letter table and replay action | Pipeline state machine, jobs and webhook |  |
| 690 | todo |  | Make handlers idempotent by contract | Pipeline state machine, jobs and webhook |  |
| 691 | todo |  | Define the recording pipeline stages | Pipeline state machine, jobs and webhook |  |
| 692 | todo |  | Sign outbound webhooks with HMAC-SHA256 | Pipeline state machine, jobs and webhook |  |
| 693 | blocked | needs-owner-account | Verify inbound provider webhooks and dedupe | Pipeline state machine, jobs and webhook | needs-owner-account |
| 694 | todo |  | Write the edge function design rules | Edge functions and background jobs |  |
| 695 | todo |  | Add a shared function kit | Edge functions and background jobs |  |
| 696 | todo |  | Add per-call timeouts and abort signals | Edge functions and background jobs |  |
| 697 | todo |  | Run functions locally under Deno-compatible tests with mock Supabase | Edge functions and background jobs |  |
| 698 | todo |  | Schedule recurring work with pg_cron or an external trigger | Edge functions and background jobs |  |
| 699 | todo |  | Define a provider abstraction for email and SMS | Edge functions and background jobs |  |
| 700 | todo |  | Build the moderation queue table and view | Moderation, audit, abuse and rate limits |  |
| 701 | todo |  | Record every moderation decision with a reason code | Moderation, audit, abuse and rate limits |  |
| 702 | todo |  | Add an append-only audit log | Moderation, audit, abuse and rate limits |  |
| 703 | todo |  | Add a reports table for user reports | Moderation, audit, abuse and rate limits |  |
| 704 | blocked | needs-decision | Write abuse handling procedures | Moderation, audit, abuse and rate limits | needs-decision |
| 705 | todo |  | Implement database-level rate limiting | Moderation, audit, abuse and rate limits |  |
| 706 | todo |  | Set per-action limits | Moderation, audit, abuse and rate limits |  |
| 707 | todo |  | Add a user suspension flow | Moderation, audit, abuse and rate limits |  |
| 708 | todo |  | Log breach-relevant events for the 72 hour report | Moderation, audit, abuse and rate limits |  |
| 709 | todo |  | Choose PostgREST tables versus RPC functions per use case | API design, errors and pagination |  |
| 710 | todo |  | Write the OpenAPI 3.1 spec for custom endpoints | API design, errors and pagination |  |
| 711 | todo |  | Define the error envelope | API design, errors and pagination |  |
| 712 | todo |  | Use keyset pagination | API design, errors and pagination |  |
| 713 | todo |  | Version the API in the path | API design, errors and pagination |  |
| 714 | todo |  | Define the idempotency header for create endpoints | API design, errors and pagination |  |
| 715 | todo |  | Create the search index with Postgres FTS | Search, caching and static export |  |
| 716 | todo |  | Add trigram fuzzy matching | Search, caching and static export |  |
| 717 | todo |  | Add PostGIS bbox and nearby queries | Search, caching and static export |  |
| 718 | todo |  | Cap search cost | Search, caching and static export |  |
| 719 | todo |  | Define cache headers and a cache-or-not table | Search, caching and static export |  |
| 720 | todo |  | Export approved content into the static site | Search, caching and static export |  |
| 721 | todo |  | Gate the export on moderator approval and a content hash | Search, caching and static export |  |
| 722 | todo |  | Add a stale-check between database and static site | Search, caching and static export |  |
| 723 | todo |  | Build the user data export | Privacy, backups, recovery and cost |  |
| 724 | todo |  | Extend delete_my_account to cover new tables and Storage | Privacy, backups, recovery and cost |  |
| 725 | todo |  | Write a data-retention schedule | Privacy, backups, recovery and cost |  |
| 726 | blocked | needs-decision | Write the grievance and breach procedure | Privacy, backups, recovery and cost | needs-decision |
| 727 | blocked | needs-decision | Plan backups and PITR | Privacy, backups, recovery and cost | needs-decision |
| 728 | todo |  | Script a restore drill | Privacy, backups, recovery and cost |  |
| 729 | todo |  | Write the disaster recovery plan | Privacy, backups, recovery and cost |  |
| 730 | todo |  | Build a cost guard against the Rs 1,000 cap | Privacy, backups, recovery and cost |  |
| 731 | todo |  | Create deterministic seed data | Seed data and test strategy |  |
| 732 | todo |  | Create fixture audio files | Seed data and test strategy |  |
| 733 | todo |  | Run the whole suite from one command | Seed data and test strategy |  |
| 734 | todo |  | Write contract tests against a mock Supabase | Seed data and test strategy |  |
| 735 | todo |  | Add a mutation check on RLS tests | Seed data and test strategy |  |
| 736 | todo |  | Write a load test plan with a local harness | Seed data and test strategy |  |
| 737 | todo |  | Add a schema snapshot test | Seed data and test strategy |  |
| 738 | todo |  | Add backend feature flags in app/config.js | Client integration |  |
| 739 | todo |  | Extend app/backend.js with a typed request wrapper | Client integration |  |
| 740 | todo |  | Design the auth UI states | Client integration |  |
| 741 | todo |  | Add optimistic updates with rollback | Client integration |  |
| 742 | todo |  | Make journey and Studio stores offline-first | Client integration |  |
| 743 | todo |  | Add a central error toast component | Client integration |  |
| 744 | todo |  | Add loading skeletons for account, sync and Studio lists | Client integration |  |
| 745 | todo |  | Add a recording upload UI with progress and limits | Client integration |  |
| 746 | todo |  | Add an account page for consent, export and deletion | Client integration |  |
| 747 | blocked | needs-owner-account | Write the owner-created accounts and secrets list | Deploy runbook | needs-owner-account |
| 748 | todo |  | Write the first deploy sequence | Deploy runbook |  |
| 749 | blocked | needs-owner-account | Write the smoke test script for live verification | Deploy runbook | needs-owner-account |
| 750 | blocked | needs-decision | Define the flag-on sequence and kill rule hook | Deploy runbook | needs-decision |
| 751 | todo |  | Define a provider interface | Provider abstraction and Sarvam limits |  |
| 752 | blocked | needs-sarvam | Encode Sarvam translate limits | Provider abstraction and Sarvam limits | needs-sarvam |
| 753 | todo |  | Encode Bulbul v3 limits | Provider abstraction and Sarvam limits |  |
| 754 | todo |  | Strip SSML before TTS | Provider abstraction and Sarvam limits |  |
| 755 | blocked | needs-sarvam | Wire Saaras v4 STT with a duration router | Provider abstraction and Sarvam limits | needs-sarvam |
| 756 | todo |  | Handle sarvam-105b reasoning-token budgeting | Provider abstraction and Sarvam limits |  |
| 757 | todo |  | Write a capability matrix doc generated from code | Provider abstraction and Sarvam limits |  |
| 758 | blocked | needs-decision | Replace outdated model names in the integration blueprint plan | Provider abstraction and Sarvam limits | needs-decision |
| 759 | blocked | needs-sarvam | Add a provider health probe | Provider abstraction and Sarvam limits | needs-sarvam |
| 760 | blocked | needs-sarvam | Create a 403 runbook | Provider abstraction and Sarvam limits | needs-sarvam |
| 761 | todo |  | Add an optional OpenAI-compatible fallback ChatProvider | Fallback LLM and secrets hygiene |  |
| 762 | todo |  | Add a secret-scan CI gate | Fallback LLM and secrets hygiene |  |
| 763 | todo |  | Keep keys out of artifacts | Fallback LLM and secrets hygiene |  |
| 764 | blocked | needs-decision | Define fallback policy | Fallback LLM and secrets hygiene | needs-decision |
| 765 | blocked | needs-decision | Add a fallback quality bar | Fallback LLM and secrets hygiene | needs-decision |
| 766 | blocked | needs-decision | Document free-tier terms check | Fallback LLM and secrets hygiene | needs-decision |
| 767 | todo |  | Assign stable unit ids | Localisation pipeline core |  |
| 768 | todo |  | Chunk by sentence under caps | Localisation pipeline core |  |
| 769 | todo |  | Cache by source hash | Localisation pipeline core |  |
| 770 | todo |  | Make runs idempotent | Localisation pipeline core |  |
| 771 | todo |  | Add `--dry-run` | Localisation pipeline core |  |
| 772 | blocked | needs-budget | Implement the budget guard | Localisation pipeline core | needs-budget |
| 773 | blocked | needs-budget | Add a first-call check | Localisation pipeline core | needs-budget |
| 774 | blocked | needs-decision | Add per-language spend caps | Localisation pipeline core | needs-decision |
| 775 | todo |  | Store outputs as reviewable files | Localisation pipeline core |  |
| 776 | todo |  | Mark stale translations | Localisation pipeline core |  |
| 777 | todo |  | Script-block match gate | Quality gates and human review |  |
| 778 | todo |  | Length-ratio gate | Quality gates and human review |  |
| 779 | todo |  | Digits-preserved gate | Quality gates and human review |  |
| 780 | todo |  | Place-name gate | Quality gates and human review |  |
| 781 | blocked | needs-human-reviewer | Glossary of heritage terms | Quality gates and human review | needs-human-reviewer |
| 782 | blocked | needs-sarvam | Back-translation spot check | Quality gates and human review | needs-sarvam |
| 783 | todo |  | Define the `needsReview` state machine | Quality gates and human review |  |
| 784 | blocked | needs-human-reviewer | Build a reviewer workflow | Quality gates and human review | needs-human-reviewer |
| 785 | blocked | needs-human-reviewer | Log reviewer corrections as glossary candidates | Quality gates and human review | needs-human-reviewer |
| 786 | todo |  | Publish per-language review coverage | Quality gates and human review |  |
| 787 | todo |  | Add the AI voice badge | Labelling and disclosure |  |
| 788 | todo |  | Add the machine translation label | Labelling and disclosure |  |
| 789 | todo |  | Label device speech too | Labelling and disclosure |  |
| 790 | todo |  | Mark English as source of truth | Labelling and disclosure |  |
| 791 | todo |  | Add provenance to exported data | Labelling and disclosure |  |
| 792 | todo |  | Write a plain-language AI disclosure page | Labelling and disclosure |  |
| 793 | blocked | needs-decision | Normalise loudness | Audio mastering and manifests | needs-decision |
| 794 | blocked | needs-decision | Encode Opus and MP3 variants | Audio mastering and manifests | needs-decision |
| 795 | todo |  | Trim leading and trailing silence | Audio mastering and manifests |  |
| 796 | todo |  | Emit chapter markers per paragraph | Audio mastering and manifests |  |
| 797 | todo |  | Write a duration manifest | Audio mastering and manifests |  |
| 798 | todo |  | Hash every audio file | Audio mastering and manifests |  |
| 799 | todo |  | Enforce the 90-second stop cap | Audio mastering and manifests |  |
| 800 | todo |  | Run clipping and artefact checks | Audio mastering and manifests |  |
| 801 | blocked | needs-budget | Keep a regeneration rule | Audio mastering and manifests | needs-budget |
| 802 | blocked | needs-human-reviewer | Build the place-name pronunciation lexicon | Pronunciation lexicon and voice selectio | needs-human-reviewer |
| 803 | todo |  | Apply lexicon substitution before TTS only | Pronunciation lexicon and voice selectio |  |
| 804 | todo |  | Prioritise lexicon by stop frequency | Pronunciation lexicon and voice selectio |  |
| 805 | blocked | needs-human-reviewer,needs-sarvam | Run pronunciation listening tests | Pronunciation lexicon and voice selectio | needs-human-reviewer |
| 806 | blocked | needs-human-reviewer,needs-sarvam | Select voices per language | Pronunciation lexicon and voice selectio | needs-human-reviewer |
| 807 | todo |  | Keep voice stable per route | Pronunciation lexicon and voice selectio |  |
| 808 | todo |  | Mark unsupported-voice languages explicitly | Pronunciation lexicon and voice selectio |  |
| 809 | blocked | needs-budget | Record a voice-change protocol | Pronunciation lexicon and voice selectio | needs-budget |
| 810 | todo |  | Add transcript cleanup stage | Studio pipeline and moderation |  |
| 811 | todo |  | Fact-check against stop text | Studio pipeline and moderation |  |
| 812 | todo |  | Fact-check against the Cultural Graph | Studio pipeline and moderation |  |
| 813 | blocked | needs-decision | Moderate hate and discrimination | Studio pipeline and moderation | needs-decision |
| 814 | todo |  | Moderate defamation risk | Studio pipeline and moderation |  |
| 815 | blocked | needs-human-reviewer | Moderate religious sensitivity | Studio pipeline and moderation | needs-human-reviewer |
| 816 | todo |  | Moderate safety content | Studio pipeline and moderation |  |
| 817 | todo |  | Detect doxxing and PII | Studio pipeline and moderation |  |
| 818 | todo |  | Run copyright and plagiarism checks | Studio pipeline and moderation |  |
| 819 | blocked | needs-decision | Apply child-safety checks | Studio pipeline and moderation | needs-decision |
| 820 | blocked | needs-human-reviewer | Ship static pre-generated Q&A first | Ask NAARAD | needs-human-reviewer |
| 821 | todo |  | Require source quotes in answers | Ask NAARAD |  |
| 822 | blocked | needs-sarvam | Design live RAG with citations | Ask NAARAD | needs-sarvam |
| 823 | todo |  | Refuse when ungrounded | Ask NAARAD |  |
| 824 | todo |  | Defend against prompt injection | Ask NAARAD |  |
| 825 | todo |  | Add abuse controls | Ask NAARAD |  |
| 826 | blocked | needs-decision,needs-sarvam | Set latency targets | Ask NAARAD | needs-decision |
| 827 | todo |  | Compute cost per question | Ask NAARAD |  |
| 828 | todo |  | Cache answers | Ask NAARAD |  |
| 829 | blocked | needs-human-reviewer | Build the golden evaluation set | Ask NAARAD | needs-human-reviewer |
| 830 | todo |  | Write red-team prompts | Ask NAARAD |  |
| 831 | todo |  | Track hallucination metrics | Ask NAARAD |  |
| 832 | todo |  | Reuse the static Q&A as the live fallback | Ask NAARAD |  |
| 833 | todo |  | Give feedback controls | Ask NAARAD |  |
| 834 | todo |  | Define the entity schema | Cultural Knowledge Graph |  |
| 835 | todo |  | Require sources on every claim | Cultural Knowledge Graph |  |
| 836 | blocked | needs-decision | Choose open licences | Cultural Knowledge Graph | needs-decision |
| 837 | todo |  | Model uncertain dates honestly | Cultural Knowledge Graph |  |
| 838 | todo |  | Link to Wikidata ids where they exist | Cultural Knowledge Graph |  |
| 839 | blocked | needs-human-reviewer | Build editor tools | Cultural Knowledge Graph | needs-human-reviewer |
| 840 | todo |  | Add graph integrity checks | Cultural Knowledge Graph |  |
| 841 | todo |  | Version and slice the graph | Cultural Knowledge Graph |  |
| 842 | todo |  | Scope the trip assistant narrowly | Trip-planning assistant, personalisation |  |
| 843 | todo |  | State assistant limits in the UI | Trip-planning assistant, personalisation |  |
| 844 | todo |  | Refuse out-of-scope requests | Trip-planning assistant, personalisation |  |
| 845 | todo |  | Personalise on-device only | Trip-planning assistant, personalisation |  |
| 846 | todo |  | Offer a visible reset | Trip-planning assistant, personalisation |  |
| 847 | todo |  | Recommend with transparent rules first | Trip-planning assistant, personalisation |  |
| 848 | blocked | needs-decision | Evaluate recommendations by coverage, not clicks | Trip-planning assistant, personalisation | needs-decision |
| 849 | blocked | needs-human-reviewer | Make human fact-check mandatory | AI-assisted workflows, evaluation and re | needs-human-reviewer |
| 850 | todo |  | Create a fact-check checklist | AI-assisted workflows, evaluation and re |  |
| 851 | todo |  | Build an evaluation harness | AI-assisted workflows, evaluation and re |  |
| 852 | blocked | needs-sarvam | Add model-change regression tests | AI-assisted workflows, evaluation and re | needs-sarvam |
| 853 | todo |  | Create a prompt registry | AI-assisted workflows, evaluation and re |  |
| 854 | todo |  | Version prompts semantically | AI-assisted workflows, evaluation and re |  |
| 855 | todo |  | Review prompt changes like code | AI-assisted workflows, evaluation and re |  |
| 856 | blocked | needs-budget | Build a cost dashboard | AI-assisted workflows, evaluation and re | needs-budget |
| 857 | blocked | needs-budget | Set alert thresholds | AI-assisted workflows, evaluation and re | needs-budget |
| 858 | todo |  | Log every AI call | AI-assisted workflows, evaluation and re |  |
| 859 | todo |  | Separate training consent from service consent | Data governance and safety policy |  |
| 860 | blocked | needs-decision | Make consent revocable | Data governance and safety policy | needs-decision |
| 861 | blocked | needs-decision | Never use creator or traveller data for training by default | Data governance and safety policy | needs-decision |
| 862 | todo |  | Publish a generated-content safety policy | Data governance and safety policy |  |
| 863 | todo |  | Define an incident process for bad AI output | Data governance and safety policy |  |
| 864 | blocked | needs-decision | Record data inventory for AI features | Data governance and safety policy | needs-decision |
| 865 | todo |  | Provide a transcript for every audio | Accessibility, offline models and on-dev |  |
| 866 | todo |  | Support captions and reading speed controls | Accessibility, offline models and on-dev |  |
| 867 | blocked | needs-human-reviewer | Test generated audio for intelligibility | Accessibility, offline models and on-dev | needs-human-reviewer |
| 868 | blocked | needs-decision | Run an offline small-model feasibility study | Accessibility, offline models and on-dev | needs-decision |
| 869 | todo |  | Improve WebSpeech fallback quality | Accessibility, offline models and on-dev |  |
| 870 | todo |  | Detect missing device voices | Accessibility, offline models and on-dev |  |
| 871 | blocked | needs-decision | Fix the rollout order | Language rollout and reviewer recruitmen | needs-decision |
| 872 | blocked | needs-human-reviewer | Set a per-language launch gate | Language rollout and reviewer recruitmen | needs-human-reviewer |
| 873 | blocked | needs-human-reviewer | Recruit reviewers per language | Language rollout and reviewer recruitmen | needs-human-reviewer |
| 874 | blocked | needs-human-reviewer | Define reviewer tasks and credit | Language rollout and reviewer recruitmen | needs-human-reviewer |
| 875 | blocked | needs-budget,needs-human-reviewer,needs-sarvam | Pilot one language end to end | Language rollout and reviewer recruitmen | needs-budget |
| 876 | blocked | needs-decision | Record a pay-or-stay-free decision | Payments and entitlements (all later, fo | needs-decision |
| 877 | blocked | later,needs-decision | Write the District Pass concept note | Payments and entitlements (all later, fo | later |
| 878 | blocked | later | Draft an entitlement model | Payments and entitlements (all later, fo | later |
| 879 | blocked | later,needs-evidence | Compare Razorpay subscriptions against UPI autopay and one-off UPI | Payments and entitlements (all later, fo | later |
| 880 | blocked | later | Design payment-failure and grace-period behaviour | Payments and entitlements (all later, fo | later |
| 881 | blocked | later,needs-lawyer | Specify the refund and cancellation policy | Payments and entitlements (all later, fo | later |
| 882 | blocked | later,needs-lawyer | Map GST registration and invoicing duties | Payments and entitlements (all later, fo | later |
| 883 | blocked | later,needs-lawyer | Map TDS and TCS touchpoints on payments received and creator payouts | Payments and entitlements (all later, fo | later |
| 884 | blocked | later,needs-budget | Set a payments kill switch and spend-cap check | Payments and entitlements (all later, fo | later |
| 885 | blocked | needs-decision | Define who a creator is | Creator programme: onboarding, guideline | needs-decision |
| 886 | blocked | later | Draft the creator onboarding flow | Creator programme: onboarding, guideline | later |
| 887 | todo |  | Write creator content guidelines | Creator programme: onboarding, guideline |  |
| 888 | todo |  | Publish a source-and-citation standard for stories | Creator programme: onboarding, guideline |  |
| 889 | blocked | later | Design a creator verification ladder | Creator programme: onboarding, guideline | later |
| 890 | blocked | later | Define reputation signals without gaming | Creator programme: onboarding, guideline | later |
| 891 | blocked | needs-lawyer | Draft the creator agreement outline | Creator programme: onboarding, guideline | needs-lawyer |
| 892 | blocked | needs-evidence | Run five creator discovery conversations | Creator programme: onboarding, guideline | needs-evidence |
| 893 | todo |  | Create a creator feedback and correction loop | Creator programme: onboarding, guideline |  |
| 894 | todo |  | Set a story retirement rule | Creator programme: onboarding, guideline |  |
| 895 | blocked | needs-decision,needs-evidence | Pilot with a few invited creators before any open programme | Creator programme: onboarding, guideline | needs-decision |
| 896 | blocked | needs-decision | Reconcile the 'monthly UPI' and 'per-listen' wording | Revenue share and creator payouts (later | needs-decision |
| 897 | blocked | later,needs-evidence | Model three payout options on paper | Revenue share and creator payouts (later | later |
| 898 | blocked | later | Define what a countable listen is | Revenue share and creator payouts (later | later |
| 899 | blocked | later,needs-budget | Assess RazorpayX payouts for creators | Revenue share and creator payouts (later | later |
| 900 | blocked | later,needs-lawyer | Specify payout dispute and clawback rules | Revenue share and creator payouts (later | later |
| 901 | blocked | later,needs-lawyer | Collect creator tax details only at payout time | Revenue share and creator payouts (later | later |
| 902 | blocked | later | Draft the circuit digitisation workflow | Partner and tourism-board portal, API an | later |
| 903 | blocked | later,needs-evidence | Design a partner dashboard wireframe | Partner and tourism-board portal, API an | later |
| 904 | blocked | needs-evidence | Choose partner metrics that boards say they need | Partner and tourism-board portal, API an | needs-evidence |
| 905 | blocked | later | Define partner roles and permissions | Partner and tourism-board portal, API an | later |
| 906 | blocked | later,needs-lawyer | Write an invoicing and agreement template for partner pilots | Partner and tourism-board portal, API an | later |
| 907 | blocked | later | Draft an OpenAPI 3 spec for read-only route data | Partner and tourism-board portal, API an | later |
| 908 | blocked | later,needs-budget | Specify API keys and rate limits | Partner and tourism-board portal, API an | later |
| 909 | blocked | later | Specify signed webhooks for partners | Partner and tourism-board portal, API an | later |
| 910 | blocked | later | Design an embeddable route widget | Partner and tourism-board portal, API an | later |
| 911 | blocked | later | Document widget sandboxing and CSP needs | Partner and tourism-board portal, API an | later |
| 912 | blocked | needs-lawyer | Publish a partner data-sharing and licence statement | Partner and tourism-board portal, API an | needs-lawyer |
| 913 | todo |  | Log every outreach in the evidence ledger | CSR, temple-trust and heritage-body enga |  |
| 914 | blocked | needs-evidence | Hold the first three temple-trust interviews with the existing guide | CSR, temple-trust and heritage-body enga | needs-evidence |
| 915 | blocked | needs-evidence | Hold the first three CSR-team interviews | CSR, temple-trust and heritage-body enga | needs-evidence |
| 916 | blocked | needs-evidence | Hold the first three tourism-board interviews | CSR, temple-trust and heritage-body enga | needs-evidence |
| 917 | blocked | needs-decision | Define what counts as a T3 ask | CSR, temple-trust and heritage-body enga | needs-decision |
| 918 | blocked | needs-evidence | Design a no-cost pilot with one heritage site | CSR, temple-trust and heritage-body enga | needs-evidence |
| 919 | todo |  | Write pilot success metrics up front | CSR, temple-trust and heritage-body enga |  |
| 920 | todo |  | Prepare a CSR one-pager that states only what exists | CSR, temple-trust and heritage-body enga |  |
| 921 | blocked | later,needs-decision | Gate any marketplace on the stop rule | Marketplace (later, not before evidence) | later |
| 922 | blocked | later,needs-lawyer | Define guide verification criteria | Marketplace (later, not before evidence) | later |
| 923 | blocked | later,needs-evidence | Study ASI e-ticketing integration feasibility | Marketplace (later, not before evidence) | later |
| 924 | blocked | later | Sketch ticket and stay listing models | Marketplace (later, not before evidence) | later |
| 925 | blocked | later | Design an availability and calendar model | Marketplace (later, not before evidence) | later |
| 926 | blocked | later,needs-lawyer | Draft cancellation and no-show rules | Marketplace (later, not before evidence) | later |
| 927 | blocked | later,needs-lawyer | Assess marketplace liability and consumer-law exposure | Marketplace (later, not before evidence) | later |
| 928 | blocked | later | Write a fraud threat list | Trust and safety | later |
| 929 | blocked | later | Set a review-integrity policy | Trust and safety | later |
| 930 | blocked | later | Design a report button and intake form | Trust and safety | later |
| 931 | blocked | later,needs-budget | Set moderation SLAs | Trust and safety | later |
| 932 | todo |  | Define an escalation ladder | Trust and safety |  |
| 933 | todo |  | Stand up a support inbox and macros | Trust and safety |  |
| 934 | blocked | needs-budget | Plan multilingual support | Trust and safety | needs-budget |
| 935 | todo |  | Write a safety notice for walking routes | Trust and safety |  |
| 936 | blocked | needs-lawyer | Draft the privacy notice for today's no-account state | Legal and compliance (counsel review req | needs-lawyer |
| 937 | blocked | needs-lawyer | Prepare a DPDP data inventory | Legal and compliance (counsel review req | needs-lawyer |
| 938 | blocked | later,needs-lawyer | Design the consent flow for later accounts | Legal and compliance (counsel review req | later |
| 939 | blocked | needs-lawyer | Draft terms of use | Legal and compliance (counsel review req | needs-lawyer |
| 940 | blocked | later,needs-lawyer | Plan a DPDP rights portal | Legal and compliance (counsel review req | later |
| 941 | blocked | needs-lawyer | Write the retention schedule | Legal and compliance (counsel review req | needs-lawyer |
| 942 | blocked | needs-lawyer | List processor agreements needed | Legal and compliance (counsel review req | needs-lawyer |
| 943 | blocked | needs-decision,needs-lawyer | Appoint and publish a grievance officer | Legal and compliance (counsel review req | needs-decision |
| 944 | blocked | needs-lawyer | Write a breach response runbook | Legal and compliance (counsel review req | needs-lawyer |
| 945 | blocked | needs-lawyer | Draft a children's data policy | Legal and compliance (counsel review req | needs-lawyer |
| 946 | todo |  | Publish an accessibility statement | Legal and compliance (counsel review req |  |
| 947 | blocked | needs-lawyer | Write a content licensing and attribution policy | Legal and compliance (counsel review req | needs-lawyer |
| 948 | blocked | needs-lawyer | Create a photo permission and takedown policy | Legal and compliance (counsel review req | needs-lawyer |
| 949 | blocked | needs-budget,needs-lawyer | Check trademark and domain posture | Legal and compliance (counsel review req | needs-budget |
| 950 | todo |  | Write a threat model for the static site and service worker | Security |  |
| 951 | todo |  | Document CSP limits on GitHub Pages | Security |  |
| 952 | todo |  | Add SRI for third-party scripts and styles | Security |  |
| 953 | todo |  | Review dependencies and lockfiles | Security |  |
| 954 | todo |  | Review skills and MCP servers as supply chain | Security |  |
| 955 | todo |  | Write a secret rotation schedule | Security |  |
| 956 | todo |  | Apply least privilege to agents and tokens | Security |  |
| 957 | blocked | later | Design audit logging for later accounts | Security | later |
| 958 | blocked | later,needs-budget | Plan a penetration test | Security | later |
| 959 | blocked | later,needs-budget | Define a bug bounty or disclosure path | Security | later |
| 960 | todo |  | Write an incident response plan | Security |  |
| 961 | todo |  | Review the event schema against consent | Data and analytics governance |  |
| 962 | blocked | needs-lawyer | Define a consent gate for analytics | Data and analytics governance | needs-lawyer |
| 963 | blocked | needs-decision | Choose a north-star metric | Data and analytics governance | needs-decision |
| 964 | todo |  | Choose guardrail metrics | Data and analytics governance |  |
| 965 | todo |  | Write an A/B test policy | Data and analytics governance |  |
| 966 | todo |  | Enforce decision-log discipline | Organisation and evidence discipline |  |
| 967 | todo |  | Run a quarterly roadmap review | Organisation and evidence discipline |  |
| 968 | todo |  | Keep roadmap hygiene rules | Organisation and evidence discipline |  |
| 969 | todo |  | Write onboarding docs for a new contributor | Organisation and evidence discipline |  |
| 970 | todo |  | Publish a contributor guide | Organisation and evidence discipline |  |
| 971 | blocked | needs-decision | Adopt a code of conduct | Organisation and evidence discipline | needs-decision |
| 972 | todo |  | Run the stranger test | Organisation and evidence discipline |  |
| 973 | blocked | needs-evidence | Run twenty customer-discovery interviews | Organisation and evidence discipline | needs-evidence |
| 974 | todo |  | Apply the T2/T3 stop rule honestly | Organisation and evidence discipline |  |
| 975 | blocked | needs-lawyer | Check Seed Fund and TANSEED eligibility items | Funding and grants alignment | needs-lawyer |
| 976 | blocked | needs-decision | Prepare an incorporation and DPIIT status note | Funding and grants alignment | needs-decision |
| 977 | todo |  | Draft a grant narrative using only ledger facts | Funding and grants alignment |  |
| 978 | todo |  | Create a brand asset sheet | Brand, press and community |  |
| 979 | todo |  | Write a partnership attribution kit | Brand, press and community |  |
| 980 | todo |  | Build a press kit | Brand, press and community |  |
| 981 | blocked | later | Design a heritage walker community plan | Brand, press and community | later |
| 982 | todo |  | Write a volunteer role list | Brand, press and community |  |
| 983 | blocked | later,needs-budget | Design a field-verification network | Brand, press and community | later |
| 984 | todo |  | Record community contributions with consent | Brand, press and community |  |
| 985 | blocked | needs-evidence | Identify accessibility partner organisations | Accessibility partnerships and open data | needs-evidence |
| 986 | blocked | needs-budget | Plan audio-description and screen-reader testing with users | Accessibility partnerships and open data | needs-budget |
| 987 | todo |  | Publish accessible-route information standards | Accessibility partnerships and open data |  |
| 988 | blocked | needs-decision | Decide the open-data release scope | Accessibility partnerships and open data | needs-decision |
| 989 | blocked | needs-lawyer | Choose a licence for route data | Accessibility partnerships and open data | needs-lawyer |
| 990 | blocked | needs-decision | Decide open-source scope for the site code | Accessibility partnerships and open data | needs-decision |
| 991 | todo |  | Create a third-party data provenance register | Accessibility partnerships and open data |  |
| 992 | todo |  | Inventory all roadmap items 1 to 1000 by status | Retire, merge or archive pass |  |
| 993 | todo |  | Merge duplicate items | Retire, merge or archive pass |  |
| 994 | todo |  | Retire items contradicted by evidence | Retire, merge or archive pass |  |
| 995 | todo |  | Archive stale docs | Retire, merge or archive pass |  |
| 996 | todo |  | Remove unused skills and scripts | Retire, merge or archive pass |  |
| 997 | todo |  | Reconcile the site's claims with reality | Retire, merge or archive pass |  |
| 998 | todo |  | Close stale decision-log proposals | Retire, merge or archive pass |  |
| 999 | todo |  | Re-run the stop-rule status check | Retire, merge or archive pass |  |
| 1000 | todo |  | Publish an honest roadmap status page | Retire, merge or archive pass |  |
