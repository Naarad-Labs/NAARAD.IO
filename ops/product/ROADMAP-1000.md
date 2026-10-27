# naarad.io: 1,000-point roadmap

Built from the review findings, the installed design skills (taste, Impeccable, UI UX Pro Max, Emil Kowalski's motion skills), the Playwright and Figma MCPs, the existing ops/ governance on main, and the backend already started there. Items are ordered by theme, not by priority: start with 1-20.

Tags: [needs-decision] founder call; [needs-evidence] ops gate G1 evidence first; [needs-budget] costs money (cloud spend is capped at Rs 1,000 in total); [needs-owner-account] you create the account or secret; [needs-sarvam] Sarvam connector must be reconnected; [needs-devices] physical devices; [needs-lawyer] legal review; [later] not before the earlier tiers. Nothing here claims a feature exists today: no recorded narration, accounts, app or paid plans are live.

| Items | Theme |
|---|---|
| 1-125 | Foundation, governance, design system |
| 126-250 | Visual polish, motion, mobile |
| 251-375 | Frontend functionality |
| 376-500 | Content, trip planning, SEO, growth |
| 501-625 | Offline, performance, accessibility, quality |
| 626-750 | Backend (Supabase, creator pipeline) |
| 751-875 | AI, voice, languages |
| 876-1000 | Platform, trust, compliance, business |

# Naarad.io roadmap, part 1 (items 1-125): Foundation, governance and design system

## Merge the pending review-fix branch
1. **Inventory the unmerged commits** — list every commit on claude/trusting-ritchie-i9vvsi after d428e11 with `git log d428e11..HEAD --stat` and tag each a11y, service worker, honest-data or other; done when a table of all ~11 commits with file lists sits in the PR description.
2. **Dry-run the merge against main** — run `git merge-tree` (or a throwaway branch merge) of the review-fix branch onto main (~31 commits ahead) and record conflicting files; done when the conflict list is written down before any real merge.
3. **Predict the sw.js conflict** — compare the review-fix service-worker changes with any sw.js or offline-bundle edits on main and feature/offline-route-bundles; done when each overlapping hunk has a stated keep/merge decision.
4. **Rebase review fixes onto main in small steps** — rebase the commits in groups (a11y, service worker, honest data) rather than one big merge; done when each group builds and passes scripts/verify.sh on its own.
5. **Re-run verify.sh after every group** — execute scripts/verify.sh after each rebased group and paste the tail of the output in the PR; done when every group shows a green run with no skipped stage.
6. **Re-run Playwright e2e on the merged result** — run the full e2e suite against the rebased tree with a built site; done when all specs pass or each failure is logged as a bug with an owner.
7. **Regenerate pre-rendered pages after the merge** — run scripts/build-site.mjs and commit the refreshed pre-rendered output so `data-prerendered` matches a fresh render; done when a second build produces zero git diff.
8. **Re-check the honest-data fixes against ops/ rules** — confirm each honest-data commit removes or hedges claims instead of adding new ones, citing ledger entries where numbers remain; done when no number in the diff lacks a ledger or content/ source.
9. **Open one PR with a review checklist** — open a single PR from the rebased branch containing a checklist for a11y, SW cache version, honest-data and governance files; done when every box is ticked by a named reviewer or the founder.
10. **Log the merge in the decision log** — add a decision entry (next after D-0006) stating that the review-fix branch was merged, what was dropped and why; done when the entry exists and is linked from the PR.
11. **Delete stale remote branches** — review claude/beautiful-lamport-1m25ue, dreamy-maxwell-8t0wxb, lucid-carson-kpkkkj, serene-ride-7d7q01 and merged ones, deleting those fully contained in main; done when `git branch -r` lists only branches with open work, each named in a branch note.
12. **Write a branch naming and lifetime rule** — document in the repo contribution notes that branches are `type/short-topic`, live at most two weeks, and are rebased not merged; done when the rule exists and the next branch follows it.

## Governance gates (ops/ decision log and feature register)
13. **Add a CI check that features need evidence** — script that fails when a feature in ops/features/features.json moves to building or live without a ledger evidence id, a G1 pass or a logged override; done when a test fixture with a missing id turns CI red.
14. **Add a CI check that overrides are logged** — require any feature status that bypasses G1 to reference a decision-log id marked founder override; done when removing the reference fails the check.
15. **Validate features.json against a JSON schema** — add a schema for id, status, flag, gate, evidence, owner and last-reviewed fields; done when malformed entries fail with a line-accurate message.
16. **Reconcile F-001 and F-002 status with reality** — check that F-001 (creator accounts, building) and F-002 (offline bundles, flagged) match the code actually behind flags; done when each register row names the flag, the files and the current gate state.
17. **Make the register readable on a public page or keep it explicitly private** — decide whether ops/ is served by GitHub Pages and record the choice; done when the decision is logged and the live URL either 404s or shows a curated view.
18. **Add decision-log numbering lint** — script that checks D-0001..D-0006 and later ids are sequential, unique and each has date, context, decision and consequence; done when a duplicated id fails CI.
19. **Add an evidence-ledger staleness report** — list ledger entries older than a chosen number of days with no recheck; done when the report runs in verify.sh as a warning and names stale entries.
20. **Require a source for every number in content/** — scan content/*.json and views for digits that describe the real world (heights, years, distances) and demand a source field or ledger id; done when an unsourced figure fails the check.
21. **Write the cloud-spend guard** — record the Rs 1,000 total cap in ops/ with a running spend table (even if zero) and a rule that any paid service needs a logged entry first; done when the table exists and verify.sh fails if a paid-service config appears without an entry.
22. **Log the Sarvam 403 block as a risk** — add a risk entry stating translate, TTS, STT and chat are blocked, with the date first seen, and mark every roadmap item depending on Sarvam as blocked; done when the dependency list is searchable by tag.
23. **Log the local-only LLM endpoint as non-shippable** — record that the free OpenAI-compatible endpoint lives on the owner's machine only, so no site feature may call it at runtime; done when a lint forbids its host name in app/ and sw.js.
24. **Define the G1 gate in one page** — write the exact criteria for G1 (what evidence, who signs, what counts as pass) with a worked example for F-001; done when a reviewer can decide pass/fail without asking the founder.
25. **Add a PR template with governance fields** — template asks for feature id, gate status, ledger evidence, honesty-rule check (no invented numbers, no recorded narration/accounts/app/paid plans claim) and rollback; done when a new PR shows the template.
26. **Add a weekly governance review note** — a short recurring entry in ops/ summarising gate changes, spend and stale evidence; done when four consecutive weeks exist or the process is explicitly cancelled in the log.

## verify.sh and CI
27. **Document what verify.sh checks** — list each stage of scripts/verify.sh with its purpose and the command to run it alone; done when a header comment or README section matches the script line by line.
28. **Make verify.sh fail fast with clear stage names** — print a banner per stage and exit non-zero on the first failure with the stage name; done when a deliberately broken file reports its stage.
29. **Time every verify.sh stage** — print elapsed seconds per stage so slow steps are visible; done when the last line of a run shows a per-stage timing table.
30. **Add an HTML validity stage** — validate the generated pages (index, routes, stories, 404) with an HTML validator and fail on errors; done when a stray unclosed tag in a view breaks the stage.
31. **Add an internal link checker** — crawl the built site and fail on any href or src that does not resolve to a built file; done when a renamed route without a redirect fails.
32. **Check sitemap.xml matches the built pages** — compare sitemap URLs with pre-rendered routes, stories and static pages; done when adding a route without a sitemap line fails.
33. **Check canonical, title and description on every built page** — assert one canonical, a unique title and a unique meta description per page via app/seo.js output; done when duplicate titles fail.
34. **Check the service worker cache list against built files** — assert sw.js precache entries exist and that the cache version changes when assets change; done when a stale cache name fails verify.
35. **Add a pre-render determinism check** — build twice and diff the outputs to uphold the "same markup for same data" contract in app/visual-contract.md; done when any clock or random id makes the diff non-empty and fails.
36. **Cache npm and Playwright browsers in CI** — configure CI caches keyed on lockfile and Playwright version; done when a warm CI run is measurably shorter and the numbers are recorded.
37. **Run e2e on a built site, not the dev tree** — point Playwright at the output of build-site.mjs served statically as GitHub Pages would; done when a bug only present in the build is caught in CI.
38. **Upload Playwright traces and screenshots on failure** — attach trace.zip and failure screenshots as CI artifacts; done when a forced failure produces a downloadable trace.
39. **Add a CI size budget** — fail the build if total JS, CSS or any single image exceeds a recorded budget for the entry page; done when the budget file exists and a 1 MB test image trips it.
40. **Protect main with required checks** — require the CI workflow and PR review before merge on main; done when a direct push to main is rejected.

## Public repo hygiene (what GitHub Pages serves)
41. **List every file reachable on the live domain** — from the repo root, enumerate what Pages serves (Images, replica, docs, tests, scripts, convert-*.js, skills-lock.json, googlecc72b0f2c9685bc7.html); done when a spreadsheet marks each path serve/keep-private/delete.
42. **Move non-site files out of the published root** — move scripts, tests and converters out of the served tree or publish only a build directory; done when requesting /scripts/ or /convert-gpx.js on the live site returns 404.
43. **Decide the fate of the replica/ folder** — inspect what replica/ is for and whether it should be public; done when it is either documented, relocated or removed with a decision entry.
44. **Check docs/ for internal content** — read everything in docs/ for secrets, drafts or ops detail that should not be public; done when each file is tagged public-safe or moved.
45. **Add a secret scan to CI** — run a secret scanner over the full history for keys, Supabase service roles and Sarvam keys; done when the first scan result is archived and any hit is rotated.
46. **Keep the Supabase service key out of the client bundle** — grep built output for service_role and non-anon keys; done when CI fails on any match and only the anon key may appear.
47. **Add .gitattributes and .editorconfig** — normalise line endings, indentation and binary flags; done when a fresh checkout on another OS produces no whitespace diffs.
48. **Pin or lockfile vendored libraries** — record versions and checksums for app/vendor (Leaflet and others) in a manifest; done when a modified vendor file fails verification.
49. **Compress and size-audit Images/** — list originals over a size threshold, produce responsive derivatives, and keep licences next to them; done when no image on the entry page exceeds the budget and each has a credit line.
50. **Add a credits and licences file for imagery and data** — record source and licence for every photo and for the GPS tracks, plus the vendor libraries; done when a /credits page or file lists every asset in Images/.
51. **Verify CNAME and Pages settings stay intact** — add a check that CNAME still contains the production domain after a build; done when a build that drops it fails.
52. **Keep googlecc72b0f2c9685bc7.html deliberately** — confirm the Search Console verification file is still needed and document it so it is not "cleaned up"; done when a comment in the hygiene notes explains it and a test asserts it exists.

## Design tokens and DESIGN.md
53. **Audit current CSS custom properties** — extract every `--*` and every hard-coded colour, size and radius from app/*.css; done when a table shows tokens in use, duplicates and raw values.
54. **Write DESIGN.md** — use the impeccable skill's documentation flow to capture colour, type, spacing, radius, elevation, motion and component rules from the actual site; done when DESIGN.md exists and every value in it is found in the CSS.
55. **Create a single tokens.css** — move colour, type, space, radius, shadow, z-index and duration tokens into one stylesheet imported by base.css; done when no other stylesheet declares a colour literal.
56. **Name tokens by role, not value** — rename tokens like `--ink`, `--surface`, `--accent`, `--line` rather than `--brown-3`; done when a rename sweep leaves no hue-named tokens in components.
57. **Add a stylelint rule banning raw colours** — configure stylelint so hex, rgb and hsl literals outside tokens.css fail; done when a literal in route.css fails verify.sh.
58. **Add a z-index scale** — define tokens for sticky route-bar, header, map controls, sheet and toast and replace magic numbers; done when grep finds no numeric z-index outside tokens.
59. **Add a motion token set** — define durations and easings in tokens, with a `prefers-reduced-motion` override and motion.js reading them; done when no duration is hard-coded in CSS or JS.
60. **Define breakpoint tokens and use them consistently** — list the widths in use today, collapse them to a short set, and document them; done when each stylesheet uses only the listed values.
61. **Export tokens to a machine-readable file** — generate tokens.json from tokens.css so Figma and docs consume the same source; done when a script round-trips and a test confirms parity.
62. **Sync tokens with a Figma file** — once the Figma MCP is authorised, create variables from tokens.json and link them in DESIGN.md; done when the Figma variable count equals the token count.
63. **Add a visual token reference page for development only** — a non-indexed page showing swatches, type scale, spacing and components from live tokens; done when it renders every token and is excluded from the sitemap.
64. **Version the design system** — add a changelog section in DESIGN.md with a version number bumped on token or component changes; done when the last token PR bumps it.
65. **Contrast-check every colour pair automatically** — script that computes WCAG ratios for declared text and surface token pairs; done when body text, muted text, links and buttons all meet AA and failures block CI.
66. **Document dark-mode status honestly** — decide whether a dark theme exists, and if not, state "light only" in DESIGN.md and set `color-scheme` accordingly; done when browser form controls render consistently with the chosen scheme.

## Using the installed skills and MCPs
67. **Write a skills playbook for this repo** — one page saying which skill runs when: impeccable for audit and DESIGN.md, design-taste-frontend for hero art direction, ui-ux-pro-max for component checks, emil-design-eng for polish, animate family for motion; done when the page lists a trigger and an output for each.
68. **Run an impeccable audit of every page type** — audit home, explore, route, story, journey, studio and info views and file findings with severity; done when findings are logged as issues with page and selector.
69. **Run a design-taste anti-slop pass on the home hero** — compare against its checklist for templated patterns and fix the ones that apply; done when the pass notes list changes made and patterns deliberately kept.
70. **Run ui-ux-pro-max accessibility and touch checks** — apply its UX guideline set to forms, filters and the map controls; done when each guideline is marked pass, fail or n/a with evidence.
71. **Run an emil-design-eng detail review** — review hover, press, focus and transition details on cards, buttons and tabs; done when a punch list with before/after values exists and is ticked off.
72. **Run find-animation-opportunities, then improve-animations** — survey motion.js and CSS transitions, produce a prioritised list, and reject items that should not animate; done when the audit lists accepted and rejected items with reasons.
73. **Use Playwright MCP for visual capture at fixed viewports** — capture each page at 360, 768 and 1280 px widths into a baseline folder; done when the baseline set exists and a script regenerates it.
74. **Add Playwright screenshot regression tests** — compare against the baseline with a tolerance and mask dynamic regions such as the map tiles; done when a one-pixel colour token change fails the test.
75. **Gate Figma MCP work on authorisation** — note that the Figma MCP needs sign-in before use and list which tasks depend on it (token sync, mockup comparison); done when those tasks are tagged blocked-on-auth until it works.
76. **Create a mockup parity checklist** — for each page, list sections in the mockup versus the live page with status match, deviation-accepted or missing; done when every page has a completed row set.
77. **Measure mockup parity with overlay screenshots** — overlay live screenshots on mockup exports at the same width and record the percentage of mismatched regions; done when each page has a recorded figure and a list of deviations.
78. **Keep visual-contract.md in lockstep with CSS** — add a test that every hook and class named in app/visual-contract.md exists in views or CSS and vice versa for the stable hooks; done when removing `#catalogue-count` fails.
79. **Add the Leaflet marker size to the contract** — state the minimum marker hit size (44 px target) in visual-contract.md and test it with Playwright bounding boxes; done when the current small markers fail and then pass after the fix.
80. **Record skill outputs in the repo** — store each audit's report under docs/audits with date and commit hash; done when the latest audit is linked from DESIGN.md.

## Brand, typography and colour
81. **Write a brand brief** — a one-page statement of what Naarad is (free heritage walking-route atlas for India), voice, what it never claims, and audience; done when the page exists and is referenced by DESIGN.md.
82. **Audit logo usage** — find every logo, favicon and manifest icon in the repo and confirm sizes and transparency; done when a table shows each asset, its size and where it is used.
83. **Produce a complete icon set for the manifest** — 192, 512 and maskable PNGs plus an apple-touch icon and favicon.svg, referenced in manifest.json; done when Lighthouse installability reports no icon warnings.
84. **Create a default social share image** — design a 1200x630 image with the wordmark and no invented claims, and wire it as the og:image fallback via app/seo.js; done when a share-preview check shows it for the home page.
85. **Create per-route share images** — generate one for Hampi, Thanjavur and Auroville from the existing photographs with the route name; done when each route's og:image resolves and has alt text.
86. **Inventory fonts in app/fonts** — list families, weights, formats and byte sizes; done when unused weights are removed and the list is in DESIGN.md.
87. **Subset and self-host fonts with woff2** — subset to Latin plus punctuation used and add `font-display: swap`; done when total font bytes fall and no layout shift appears on load in a Playwright trace.
88. **Define the type scale** — set a modular scale with named steps (caption to display), line heights and measure limits (~65ch for prose); done when all font-size declarations use scale tokens.
89. **Check Indic script readiness without claiming support** — verify the font stack falls back gracefully for Devanagari and Tamil place names that appear in content; done when a test page with such names renders without tofu boxes.
90. **Fix heading hierarchy on every page** — one h1, ordered h2/h3, matching the visual hierarchy; done when an automated outline check passes on all built pages.
91. **Define the colour palette with roles and usage rules** — primary, accent, surface, ink, line, success, warning, danger, route-line colours; done when each has a stated use and a forbidden use.
92. **Choose a colour-blind-safe set for route lines and map layers** — verify the three editorial routes and eight Chennai tracks are distinguishable by more than hue (dash pattern or width); done when a simulation check shows all lines separable.
93. **Define an on-photo text treatment** — specify the scrim and minimum contrast for text over hero photographs (`.torn-left` heroes); done when contrast is measured at the worst crop and is AA.
94. **Standardise imagery style** — set crop ratios, treatment and alt-text rules for hero and card photographs; done when every image in content/ has the ratio and a written alt.

## Spacing, layout and components
95. **Define the spacing scale** — a 4 px based set (4, 8, 12, 16, 24, 32, 48, 64) as tokens, replacing ad-hoc paddings; done when grep finds no px padding or margin outside the scale in app/*.css.
96. **Standardise page gutters and max widths** — one content width token for prose, one for grids, 16 px phone gutters; done when no page scrolls horizontally at 320 px in Playwright.
97. **Build a button component spec** — primary, secondary, quiet, destructive, with hover, focus-visible, active, disabled and loading states at 44 px minimum height; done when every button in the app uses these classes.
98. **Build a card component spec** — one catalogue/route/story card with image ratio, title lines clamp, meta row and focus ring; done when the three card variants in the app share one base class.
99. **Standardise the focus ring** — one visible `:focus-visible` outline token used on links, buttons, tabs and map markers; done when keyboard tabbing through each page shows a visible ring in a screenshot test.
100. **Unify tab components** — `data-tab`, `data-stop-tab` and `data-journey-tab` share one tab style and keyboard behaviour (arrow keys, aria-selected); done when one e2e test drives all three the same way.
101. **Build a form-field component** — label, hint, error, input states for `#catalogue-query`, `#route-search` and studio inputs; done when each field has a programmatic label and 16 px font so iOS does not zoom.
102. **Standardise chips and filter controls** — one style for `data-filter-*` controls with pressed state and count; done when filters expose aria-pressed and look identical on explore and home.
103. **Define the fact-grid component** — lock the eight-cell `.route-facts` layout, including behaviour with missing facts and long values; done when a worst-case data test (break-ui style) shows no overflow or empty boxes.
104. **Enlarge Leaflet markers and controls** — raise marker and zoom-control hit areas to at least 44 px with visible state for selected stop; done when Playwright confirms the bounding box size and the selected marker is distinguishable without colour alone.

## Content design and UX copy
105. **Write a voice and tone guide** — plain, warm, specific, no hype, with do/don't examples drawn from the real routes; done when ten example rewrites sit beside the originals.
106. **Audit all UI strings into one list** — extract buttons, labels, errors, empty states and aria-labels from views into a spreadsheet; done when every string has location, purpose and a reviewed flag.
107. **Centralise UI strings in a module** — move repeated UI copy into one strings file so wording is consistent and later translation is possible; done when views import strings and no label is duplicated in two forms.
108. **Rewrite the home hero copy honestly** — state what exists (three routes with stops, three stories, eight recorded Chennai tracks, nine catalogue rows) without implying more; done when every claim maps to a content file.
109. **Label narration accurately** — everywhere audio appears, say it is read aloud by your device's voice and that there is no recorded narration; done when the phrase appears wherever the play control appears.
110. **Write the sign-in screen copy for a flagged feature** — keep the screen behind its flag, and make its text say what accounts will do without promising dates; done when the screen has no unreleased claim and the flag is off in production.
111. **Write microcopy for the practical-facts block** — design a section title, source line and "last checked" label for content/practical/*.json facts before showing them; done when the copy is approved and a mock render has no invented value.
112. **Standardise date, distance and duration formats** — pick units (km, minutes), 24-hour or 12-hour, and date style for India, and apply them in one formatter; done when a unit test covers each format.
113. **Write alt text and caption standards** — rules for decorative versus informative images and for credit lines; done when every image in the built output has either alt text or an empty alt on purpose.
114. **Write error and permission messages for geolocation** — plain messages for denied, unavailable and timeout cases on journey and map features; done when each case has distinct copy and an e2e test with a mocked permission.

## Information architecture, navigation and chrome
115. **Map the current site structure** — draw the sitemap of /, explore, discover, routes, stories, journey, creators, about, studio and info pages with the 3/3/8/9 content counts per area; done when the diagram is checked against sitemap.xml.
116. **Decide the primary navigation set** — choose at most five top-level items from the current pages and demote the rest to the footer; done when the header links equal the chosen set on every page.
117. **Make header behaviour consistent on mobile** — define the collapsed menu, its focus trap, Escape to close and `aria-expanded`; done when an e2e test opens, tabs through and closes it at 360 px.
118. **Rework the footer into grouped link columns** — group Explore, Learn, About and Legal, with the data credits link and contact; done when no footer link is a dead end and each group has a heading.
119. **Add current-page state to header and footer links** — verify `.is-current` and `aria-current="page"` update on in-place navigation as promised in the contract; done when an e2e test follows three links and checks the attribute each time.
120. **Add breadcrumbs on route and story pages** — Home / Routes / Hampi style, marked up as a nav with structured data matching visible text; done when the structured-data test passes and screen readers get a landmark.
121. **Design the 404 page** — a helpful page at 404.html with search, links to the three routes, and `data-prerendered="404"` behaviour preserved; done when an unknown address shows it with a 404-appropriate title and no indexable canonical.
122. **Design a client-side error state** — a visible recovery panel for failed data load or map failure with retry and a plain-language reason; done when a blocked network request in Playwright shows it.
123. **Design empty states** — catalogue with zero search matches, empty journey, empty studio, with next-step links; done when each state exists with copy and a screenshot in the parity checklist.
124. **Design loading states and skeletons** — reserved-space skeletons for catalogue cards, route hero and map to avoid layout shift; done when Cumulative Layout Shift stays under the budget in a lab run and the figure is logged as lab-only.
125. **Add a skip link and landmark audit** — skip-to-content link, one main, labelled nav and footer landmarks on every page; done when axe reports no landmark violations across built pages.

## Type scale, tracking and spacing

126. **Raise the header motto to a legible size** — `.brand-motto` is 9.5px at .14em tracking in base.css; set it to at least 11px with .08em or less, keeping the cream palette; done when computed font-size >= 11px and the impeccable detector no longer flags the tagline.
127. **Raise the footer brand tagline the same way** — `.footer-brand small` is 9.5px/.14em; match the header motto token; done when no text under 11px remains in the footer in a computed-style sweep.
128. **Define a minimum-size type token** — add `--text-min: 12px` (or the chosen floor) in base.css and route every small label through it; done when a grep for font-size values below the token in app/*.css returns only the map pin numerals (or none).
129. **Review the map pin numeral size** — `.nr-map-stop-marker` text is 10px in map.css; either enlarge the marker to carry 12px numerals or document it as an icon glyph; done when the decision is written in visual-contract.md and the CSS matches it.
130. **Cap tracking on body-adjacent text** — uppercase labels run .08em to .16em (`.story-pull cite` .16em); define `--track-label: .08em` and `--track-caps: .12em` tokens and drop everything else; done when only those two tracking values (plus negative display tracking) appear in app/*.css.
131. **Remove letter-spacing from sentence-case copy** — .02em on `.listen-source` and similar running text adds nothing; set it to 0 for non-uppercase text; done when no non-uppercase rule has positive letter-spacing above .01em.
132. **Loosen hero heading line-height** — `h1..h4` use line-height 1.05 and the impeccable finding flags the hero at 1.02; set hero h1 to 1.08-1.12 and check two-line wraps at 360px; done when computed hero line-height >= 1.08 and no descender clips in a Playwright screenshot.
133. **Set a body line-height token pair** — define `--lh-body` (about 1.6) and `--lh-tight` (about 1.15) and replace ad-hoc values; done when app/*.css has no raw line-height decimals outside the two tokens and headings.
134. **Cap reading measure on story and stop text** — constrain `.story-body` article paragraphs and `.stop-panel` prose to 62-72ch; done when measured characters per line stay inside that range at 1440px and 390px viewports.
135. **Give route-card media and map preview a visible inset** — the impeccable finding says media/map sit flush with the background; add a 1px inner border or 8px paper frame with radius to `.route-card` figure and `.route-preview`; done when the card thumbnail edge is distinguishable from `--paper` in a screenshot diff.
136. **Standardise card inner padding** — pick one inset (for example 20px desktop, 16px phone) for `.route-card`, `.story-card`, `.note-card`, `.stat` boxes via `--card-pad`; done when all card classes read that variable and compute equal padding.
137. **Replace the hero eyebrow chip and kicker-over-heading pattern** — the detector flags the chip and the kicker above the h1; fold the place name into the heading line or demote the chip to plain `.eyebrow` text; done when the impeccable detector reports neither finding on home and route heroes.

## Motion tokens and principles

138. **Define duration tokens** — replace ad-hoc .18s/.2s/.25s/460ms/520ms/760ms/900ms with `--dur-press: 120ms`, `--dur-hover: 180ms`, `--dur-ui: 240ms`, `--dur-enter: 400ms`, `--dur-hero: 700ms` in base.css; done when no raw time literal remains in transition declarations.
139. **Define easing tokens beyond the single ease-out** — add `--ease-out-strong` (cubic-bezier(.23,1,.32,1)), `--ease-in-out` (cubic-bezier(.77,0,.175,1)) and `--ease-drawer` (cubic-bezier(.32,.72,0,1)) next to the existing `--ease-out`; done when each token is used by at least one rule and documented in visual-contract.md.
140. **Ban the default `ease` and bare transitions** — rules like home.css `transition: transform .2s, box-shadow .2s` and story.css's equivalent use the default curve; give each an explicit token curve; done when a grep for transitions without a `var(--ease` finds none.
141. **Ban `transition: all` and list properties explicitly** — audit every transition for property lists limited to transform, opacity and colours; done when a grep for `transition: all` returns nothing.
142. **Keep UI motion under 300ms** — audit that hover, press, tab and dropdown transitions are <=300ms and only entrance/hero reveals exceed it; done when a script reading computed transition durations on interactive elements reports max 300ms.
143. **Restrict animated properties to transform and opacity** — `map.css`/`journey.css` animate stroke-dashoffset and clip-path (base.css 430); decide per case, keeping compositor-safe ones and documenting the SVG/clip exceptions; done when a motion inventory table in docs lists every animated property with its category.
144. **Write a motion inventory in visual-contract.md** — list each animation (reveal, hero-drift, card hover, marker, ring) with purpose, duration token and easing; done when every `transition`/`@keyframes` in app/*.css appears in the table.
145. **Decide which surfaces get no motion** — keep the route workspace (map, rail, stop story) still as motion.js states, and write the rule as a testable list; done when an e2e check asserts no `[data-reveal]` hidden state exists inside `.route-workspace`.
146. **Add a global reduced-motion safety net in base.css** — only map.css has the blanket `animation-duration: .01ms` rule; add the same to base.css so every stylesheet is covered, while keeping opacity fades allowed; done when emulating reduced motion yields no animation running per `document.getAnimations()` on every page.
147. **Test reduced motion across all views** — add a Playwright run with `reducedMotion: 'reduce'` over home, catalogue, a route, a story, studio, journey, about and 404; done when it asserts `html[data-motion]` is not `on` and `getAnimations().length === 0`.
148. **Stop the infinite hero drift from running forever** — `hero-drift` loops 28s alternate infinite on story hero photos; stop after one cycle or pause off-screen with IntersectionObserver; done when `getAnimations()` shows no running infinite animation after 60s with the hero off-screen.
149. **Keep motion frequency-aware** — never animate the stop-selection tap, tab switches inside the route workspace, or the keyboard focus ring beyond 100ms; done when e2e asserts those transitions compute to <=100ms.
150. **Use scale(0.97) on press consistently** — define `--press-scale: .97` and apply to `.button`, `.icon-button`, `.chip` and card links inside `:active`; done when a computed-style test on `:active` shows the same scale for every button class.

## Page transitions, cards and hover

151. **Add a view-level page transition** — in main.js's in-place draw, fade/translate `#app-content` by 8px over `--dur-enter` using opacity and transform only; done when navigating home to catalogue shows an opacity change measured in the Web Animations API and stays under 300ms.
152. **Evaluate the View Transitions API as progressive enhancement** — try `document.startViewTransition` wrapping the draw behind a feature check, default off if it lengthens navigation; done when a benchmark note compares time-to-interactive with and without and the shipped choice is recorded.
153. **Keep focus handling intact through transitions** — the contract says the `h1` receives keyboard focus after a draw; verify the animation does not delay or steal it; done when the existing focus e2e passes with the transition enabled.
154. **Gate card hover on real pointers** — hover transforms in base.css/home.css/story.css are not inside `@media (hover: hover) and (pointer: fine)`; wrap them; done when emulating a touch device shows no lingering lift on a tapped `.route-card`.
155. **Refine the route-card hover** — replace `box-shadow` animation with a pseudo-element opacity fade and a 2px translateY, 180ms `--ease-out-strong`; done when a performance trace shows no paint on hover and the lift is visible.
156. **Add card press feedback** — `.route-card` and `.story-card` get `:active { transform: scale(.985) }` at 100ms; done when computed transform on `:active` is not none and releases without jump.
157. **Make card links one tap target** — ensure the whole `.route-card` link surface responds to press, with the nested actions still separately focusable; done when Playwright taps the card image and lands on the route.
158. **Stagger home card reveal by a capped step** — motion.js already caps at 420ms; confirm cards in the catalogue grid stagger at <=60ms steps and never exceed 8 items; done when a 9-row catalogue renders with the last card revealed by 600ms.
159. **Do not re-reveal on back navigation** — returning to a page should not replay entrances for content already seen; done when navigating home to route and back shows `data-reveal='in'` immediately on the home sections.
160. **Add a skeleton for the generated route preview** — while the per-card SVG preview or photo loads, show a paper-deep placeholder with a 1.4s opacity pulse limited to the media box; done when throttled 3G screenshots show the placeholder without layout shift (CLS 0).
161. **Add skeletons for the route map container** — the map loads lazily; show a static tile-coloured frame with the route preview SVG until Leaflet is ready; done when no blank white rectangle appears in a throttled filmstrip.
162. **Fade photographs in on load** — set images to opacity 0 until `decode()` resolves, 240ms fade; no hidden state without JS; done when JS-disabled screenshots show all photos and JS-enabled show a fade without CLS.
163. **Add icon morphs for play/pause and menu** — use two stacked SVG glyphs cross-fading with scale .25 to 1 and blur 4px to 0 over 160ms in `.listen-play` and the menu toggle; done when toggling shows both icons transitioning and reduced motion swaps instantly.

## Stop selection, bottom sheet and listen bar

164. **Define the stop-selection sync model** — selecting a stop in the rail, a map marker or the panel must update one `selectedStop` state and animate once; done when e2e asserts all three entry points leave marker, rail row and panel on the same stop.
165. **Animate the rail-to-marker highlight** — on select, scale the marker 1.0 to 1.18 and the active rail row's accent bar with transform only, 180ms; done when the marker transform changes within 200ms of a rail click.
166. **Pan the map on select without competing animations** — use one `flyTo`/`panTo` of <=450ms, cancelled by a newer selection; done when rapid-clicking three stops ends on the third with no stuck intermediate view.
167. **Crossfade the stop panel content** — swap the stop title and text with a 160ms opacity crossfade and no height jump (fixed min-height or measured container); done when a layout-shift trace reports zero CLS on stop change.
168. **Respect scroll position on select** — selecting from the rail on desktop must not scroll the page unexpectedly; scroll only the panel into view if offscreen; done when page scrollY is unchanged after a rail click with the panel visible.
169. **Build the phone story sheet as a draggable bottom sheet** — route.css describes a sheet below the map; add pointer-driven drag with three snap points (peek, half, full) moving by `transform: translateY`; done when drag between snaps works on a touch emulator and uses no height animation.
170. **Drive sheet release with velocity-aware springs** — on release project the final position from velocity and pick the nearest snap, settling with a spring (stiffness ~300, damping ~30) via WAAPI or a tiny spring function; done when a fast flick advances one snap and a slow drag returns to the nearest.
171. **Make the sheet interruptible** — grabbing the sheet mid-settle must take over from its current transform (read from computed matrix), not restart; done when a Playwright script starts a drag during the settle and the sheet never jumps.
172. **Add sheet rubber-banding at the extremes** — dragging beyond the top or bottom snap applies a damped offset (about 0.3x) and springs back; done when overdrag shows resistance and returns to the snap on release.
173. **Resolve sheet-versus-content scroll** — inner story content scrolls only when the sheet is at full, otherwise the drag moves the sheet; use `touch-action: pan-y` only on the content and `none` on the handle; done when scrolling at half snap does not lock or fight the sheet.
174. **Add a sheet handle with a 44px hit area and keyboard path** — a visible grabber plus buttons or arrow keys to step snaps and `aria-expanded`; done when keyboard-only users can reach all three snaps and axe passes.
175. **Dim the map behind the full sheet** — fade an overlay to .25 opacity as the sheet passes half, tied to the sheet transform via a CSS variable; done when overlay opacity tracks drag without layout or paint cost.
176. **Animate the listen bar in and out** — `.listen-bar` slides in by translateY(100%) to 0 over `--dur-ui` with `--ease-drawer`, and out when stopped; done when starting speech shows the slide and `--player-h` updates without layout jump of page content.
177. **Add a listen-bar progress indicator using transform** — scaleX on a full-width track rather than width changes, only for what the speech engine actually reports (no fake percentages); done when the bar is hidden when no progress signal exists.
178. **Update the listen bar's "next stop" label with a short slide** — 8px translate and fade when the stop changes, no animation on reduced motion; done when a stop change produces a 160ms transition and e2e text assertions still pass.

## Animation performance and library choice

179. **Decide on the `motion` library** — record the decision: stay with CSS plus WAAPI because the site is vanilla ESM with a tiny motion layer, and revisit only if the sheet spring needs more than ~60 lines; done when the decision and revisit trigger are written in app/motion.js header and docs.
180. **Prototype the sheet spring in WAAPI/linear() easing** — generate a spring as a CSS `linear()` timing function to test the no-dependency route; done when the prototype passes the drag/interrupt tests or a comparison notes why `motion` is needed.
181. **Measure `motion` bundle cost if considered** — build a spike with the `motion` mini `animate` and report gzip bytes versus current JS and the no-JS-first rule; done when the number is in the doc and the choice is justified.
182. **Profile animations at 4x CPU throttle** — record Chrome performance traces for page transition, card hover, sheet drag and reveal at 4x slowdown; done when each stays above 50fps or has a ticket with the cause.
183. **Add a performance check to Playwright** — measure long animation frames or dropped frames during the sheet drag with tracing on throttled CPU; done when CI fails above a documented threshold.
184. **Use will-change sparingly** — apply it only during an active drag or hero drift and remove after; done when a grep shows no permanent `will-change` and layers count stays low in the Layers panel.
185. **Avoid animating CSS variables that cascade** — update the sheet and listen-bar via direct `style.transform` on one element rather than inherited custom properties on the page root; done when style recalculation counts per frame stay low in a trace.
186. **Avoid large blur and backdrop-filter on animated layers** — check the sticky header and sheet for backdrop-filter while moving and replace with solid paper tints if costly; done when traces show no heavy raster during scroll on 4x throttle.
187. **Keep the IntersectionObserver reveal cheap** — confirm one shared observer unobserves after reveal; done when a heap or devtools check shows no observers retained after all sections are seen.
188. **Pause hero drift and reveals when the tab is hidden** — use `visibilitychange` to pause WAAPI/CSS animations; done when `getAnimations()` shows paused animations while hidden.

## Mobile-native feel

189. **Remove the tap highlight flash** — set `-webkit-tap-highlight-color: transparent` on interactive elements and supply `:active` states instead; done when no grey flash appears on iOS/Android emulation and every button has an `:active` style.
190. **Replace remaining 100vh uses with svh/dvh** — home.css, route.css and studio.css use `100vh - header` while base uses `100svh`; switch to `100svh` (or dvh where the layout tracks the toolbar); done when a grep for `100vh` returns nothing and the hero fits an iPhone SE viewport.
191. **Audit safe-area handling at every edge** — only route.css bottom bar uses `env(safe-area-inset-bottom)`; add left/right insets for landscape and top for the header in standalone mode; done when screenshots at a notched emulation show no clipped content.
192. **Pad the listen bar for the home indicator** — add `padding-bottom: env(safe-area-inset-bottom)` and include it in `--player-h`; done when the bar's controls clear the inset on an iPhone emulation.
193. **Enforce 44px targets on a table of controls** — extend the e2e list to icon buttons, chips, filter checkboxes, rail play buttons, map controls and footer links; done when all measured >=44px each way at 390px width.
194. **Add `touch-action: manipulation` to controls** — removes the 300ms double-tap delay on buttons and links; done when computed touch-action on `.button` and `.icon-button` is manipulation.
195. **Stop text selection on controls** — `user-select: none` plus `-webkit-touch-callout: none` on buttons, chips and the bottom sheet handle only; done when long-press on a button selects nothing while article text stays selectable.
196. **Prevent iOS input zoom** — ensure catalogue search and Studio inputs use font-size >=16px on phones; done when focusing each input on iOS emulation does not change the visual viewport scale.
197. **Contain overscroll in the sheet and bottom bar** — `overscroll-behavior: contain` on the sheet content and rail; done when scrolling to the end of the sheet does not scroll the page behind.
198. **Decide on pull-to-refresh** — the site is static, so choose to leave the browser's native refresh, and set `overscroll-behavior-y: none` only on the map; done when the map pan does not trigger refresh and the decision is documented.
199. **Polish the PWA icon set** — manifest reuses the 512 icon for maskable; produce a dedicated maskable icon with safe-zone padding (80% centre) and an Apple touch icon; done when the maskable preview tool shows no clipped mark.
200. **Add a splash and standalone status-bar treatment** — set `apple-mobile-web-app-status-bar-style`, matching background and theme colour, and add dark `theme-color` only if a dark mode ships; done when standalone iOS shows no white flash on launch.
201. **Support landscape on phones** — manifest locks `portrait-primary`; test route, map and sheet at 844x390, and decide to relax the lock or document it; done when screenshots at landscape show usable map and reachable controls, or the lock decision is recorded.
202. **Place primary actions in thumb reach** — verify the walk actions bar, listen toggle and filter apply sit in the lower third on phones; done when a reach-map screenshot shows all primary actions below 55% of viewport height.
203. **Add edge-swipe-safe layouts** — keep draggable elements 16px away from the screen edge to avoid the iOS back gesture conflict; done when the sheet and carousels have no drag handle within the edge zone.
204. **Add sensible gestures only where discoverable** — allow swipe between stops on the phone panel with visible prev/next buttons retained; done when swipe changes stop and the buttons still work and are announced.
205. **Fix sticky hover on touch globally** — one audit of all `:hover` rules in base, journey, home and story CSS, wrapping in the hover media query; done when the iOS emulation shows no stuck hover after tapping.

## Maps UI

206. **Redesign the stop marker** — current marker is a numbered circle at 10px text; make a 32px numbered pin with paper ring, ink fill and terracotta selected state, never colour alone (selected also gets larger size and ring); done when selected and unselected markers differ in size and shape in greyscale.
207. **Give markers a 44px touch hit area** — extend the clickable area with a transparent padded wrapper while keeping the visual 32px; done when a Playwright tap 6px off the pin still selects it.
208. **Add marker selection and entry motion** — scale from .6 and fade in staggered 40ms on route load, transform only; done when reduced motion shows markers immediately.
209. **Decide on marker clustering** — with at most eight stops per route no clustering is needed; for the future all-routes map define a threshold (such as >12 points) and document; done when the doc states the rule and the route map shows no clustering today.
210. **Offer a cluster design for a future overview map** — spec a numeric ring marker using the same tokens and 44px target, without shipping a plugin until the data needs it; done when the spec exists in docs and no dependency is added.
211. **Restyle Leaflet zoom controls** — enlarge to 44px buttons with paper background, ink icon, 1px line border and radius from tokens; done when computed button size >=44px and focus rings are visible.
212. **Move controls out of the thumb-blocked zone** — place zoom and layer controls at the right edge above the sheet peek, not under it; done when controls remain visible and tappable at every sheet snap.
213. **Polish the layer switcher** — present Street/Satellite as a two-option segmented control with labels (not icons only) and `aria-pressed`; done when keyboard toggling calls `setLayer` and the active option is distinguishable without colour.
214. **Persist the chosen layer per visit** — remember street or satellite in localStorage wrapped in try/catch; done when reload keeps the layer and a blocked storage still renders the default.
215. **Keep attribution visible and compact** — OSM and Esri attributions are required; collapse into an "i" toggle on phones that remains tappable (44px) and never hides behind the sheet; done when both attribution strings are reachable at every snap.
216. **Style the route line for contrast** — keep casing and bright centre layers; check against satellite and street tiles at 3:1; done when contrast of the line against both tile samples is measured and passes.
217. **Show tile loading and error states** — a subtle shimmer border while tiles load and an inline "map tiles unavailable" note on error (tileerror exists); done when blocking the tile host shows the note and the stop list still works.
218. **Fit bounds with padding that respects the sheet** — pass bottom padding equal to sheet height on phones; done when the whole route is visible above the sheet at peek snap.
219. **Make the map keyboard operable** — ensure markers are reachable and the map has an accessible name and skip link past it; done when tabbing through the page reaches every stop marker or its equivalent rail button and passes axe.

## Data visualisation

220. **Draw the elevation line on first view** — animate `.ep-line` with stroke-dashoffset over 700ms `--ease-out-strong` once when it enters the viewport, with `pathLength=1`; done when the line draws in a recorded video and renders complete with reduced motion.
221. **Fade in the elevation area after the line** — `.ep-area` opacity 0 to 1 after a 200ms delay; done when no layout or colour banding appears and the final state matches the static render.
222. **Keep elevation SVG pre-render identical** — the draw-on must be applied by JS after boot so the pre-rendered markup matches a fresh render (contract rule); done when the build's identical-render check still passes.
223. **Add an elevation hover/touch scrub** — pointer or touch moves a vertical guide and reads the real altitude and distance at the nearest recorded point, syncing a marker on the map; done when the readout matches data points and works with keyboard arrow keys.
224. **Label elevation axes legibly** — `.ep-axis` text at >=12px with units, min/max labelled, and no invented values; done when every axis label traces to route data and none is below the type floor.
225. **State when elevation data is missing** — routes without published elevation show the explicit empty state instead of a chart; done when a route without data shows no chart and a visible reason.
226. **Make the card sparkline decorative-safe** — `.is-spark` should carry `aria-hidden` plus a text fact beside it (gain/range from data); done when screen readers get the figure once and the sparkline is hidden.
227. **Design the climate chart for contrast and no colour-only meaning** — if climate data is shown, use ink line with direct labels, a dashed second series, and a data table fallback; done when greyscale screenshots still distinguish series and a table is exposed.
228. **Handle small-screen chart layout** — elevation viewBox keeps readable text on 360px by switching to fewer ticks rather than shrinking text; done when text computes to >=12px rendered size at 360px.
229. **Source and date the climate and elevation data** — add a `.data-note` under each chart naming provenance and method as recorded in the repo; done when each chart has a note and none states an unrecorded source.

## Photography treatment

230. **Define crop rules per slot** — document focal-point crops for hero (wide, subject right of the torn edge), card (4:3) and story (16:9) using `object-position` per image; done when no hero face or monument is cut in a screenshot review of all three editorial routes.
231. **Store a focal point per photograph** — add optional `focus` x/y in content metadata consumed as `object-position`; done when a test changes the value and the crop shifts, with a default of centre.
232. **Serve responsive image sizes** — verify `srcset`/`sizes` on route cards and heroes give a phone <=800px wide files; done when a 390px load transfers no image wider than 800px.
233. **Reserve aspect ratio to stop shift** — every `.photo` has width/height or `aspect-ratio`; done when CLS from images measures 0 in Lighthouse.
234. **Unify the colour grade lightly** — apply a consistent warm tone via CSS filter only if it does not alter heritage accuracy, otherwise leave originals untouched; done when the decision is recorded and applied uniformly or not at all.
235. **Make credits readable on photographs** — `.photo-credit` over images gets a paper-tinted pill or gradient scrim with 4.5:1 contrast and 12px text; done when contrast measures >=4.5:1 on the lightest and darkest hero.
236. **Keep the rights line honest** — images without a recorded author/licence display "rights not recorded" per the contract; done when a test lists every photo and none is missing either state.
237. **Check photo legibility over text in light and dark grounds** — hero copy over photographs uses a measured scrim, not a blur; done when the heading contrast over the worst-case photo region is >=4.5:1.
238. **Give photographs a torn-edge fallback** — if clip-path or the torn mask is unsupported, show a clean 8px-radius edge; done when a browser without the property still shows a bounded image.

## Per-page polish

239. **Home: tune the hero composition** — reduce hero min-height so the first card row peeks on a 390x844 viewport and the torn photograph keeps its focal subject; done when a screenshot shows the section below the hero beginning above the fold.
240. **Home: make the featured route-card grid breathe** — gap and inset tokens consistent with `--card-pad`, no orphan single card on tablet; done when 768px and 1024px screenshots show balanced rows.
241. **Catalogue: polish filter chips and the result count** — 44px chips, `aria-live` count update with 120ms number fade, and clear-all; done when filtering updates the count politely and empty results show the empty state.
242. **Catalogue: add row hover and press that match cards** — the nine catalogue rows use the same token timings and touch-safe hover; done when behaviour matches `.route-card` in a computed-style test.
243. **Route: remove the side-tab border treatment** — `.overview-geometry` uses a 2px left border accent flagged by impeccable; replace it with a full 1px border or an icon-led block; done when the detector no longer flags route.css.
244. **Route: refine the facts grid over the hero** — eight cells with equal inset, 12px labels and tabular numerals, collapsing to 2 columns at 390px; done when no cell overflows and numerals align.
245. **Route: stabilise the sticky bar** — `.route-bar` shadow appears only after stick via an IntersectionObserver class and opacity transition; done when the bar has no shadow at top of page and gains one on scroll.
246. **Story: polish the reading column** — drop caps or pull quotes use token spacing, `.story-pull cite` tracking reduced, images full-bleed on phone with captions in 12px+; done when a 390px screenshot shows no horizontal scroll and readable captions.
247. **Story: add a reading-progress hairline** — a 2px transform-scaleX bar tied to scroll using rAF throttled or scroll-timeline when supported, hidden under reduced motion; done when it tracks scroll and is absent with reduced motion.
248. **Studio: smooth the stepper and stop list** — step titles at the type floor, reorder feedback with transform-only lift, and clear empty state; done when a drag or move shows a lift of the row and no layout jump.
249. **Journey: animate the progress ring and badges honestly** — ring stroke transitions from the previous to the new value (journey.css `.ring-value`), badges appear only for real stored progress; done when clearing storage shows an empty state and no badges.
250. **About and 404: finish the plain hero and recovery path** — `.is-plain` heroes get a considered illustration or generous type, 404 offers search, home and routes links with 44px targets and keeps `data-prerendered="404"`; done when both pages screenshot cleanly at 390px and 1440px and the 404 links all work.

## Global search and suggestions
251. **Build a client-side search index** — generate a JSON index of routes, stops, stories, tracks and catalogue rows in scripts/build-site.mjs, loaded lazily on first focus; done when a unit test confirms every route, story and catalogue row id appears in the index.
252. **Add a global search box to the header** — keyboard shortcut `/` focuses it and Escape closes it, with a labelled input and role=search; done when a Playwright test opens it by `/` and tabs through it with no mouse.
253. **Rank results by field weight** — title matches outrank stop names, which outrank body text, with diacritic-insensitive matching (Hampi/Hampī); done when a fixture test shows a title hit ranked above a body-only hit.
254. **Show typed suggestions as you type** — grouped Places, Routes, Stories, Stops with a maximum of 8 rows and an arrow-key listbox (aria-activedescendant); done when axe passes and arrow/Enter navigation works in e2e.
255. **Write a dedicated no-results state** — offers spelling-tolerant alternatives from the index and links to Explore, never an empty page; done when searching a nonsense string renders the message and at least one link.
256. **Make search results a shareable URL** — `/search?q=` is pre-rendered as a shell with noindex and resolves the query client-side; done when a copied URL reopens with the same results.
257. **Support quoted-phrase and place-name queries** — "quoted" exact match and aliases such as old/new place names only where editors record them; done when an alias fixture returns its route.
258. **Log zero-result queries locally only** — keep a device-local list the user can export for feedback, with no analytics call; done when no network request is made on search.

## Filters, sort and recent searches
259. **Add filter chips on Explore** — place, theme, difficulty, duration and language chips derived only from fields that exist in data.js; done when each chip filters the 9 catalogue rows correctly in a test.
260. **Hide filters that have no data** — a facet with fewer than two distinct values is not rendered, so no empty difficulty control appears before difficulty is edited; done when a fixture with one value renders no such facet.
261. **Add sort options** — A-Z, number of stops, and nearest-to-me (only after location consent), with the current sort in the URL; done when reload preserves the sort.
262. **Reflect filters in the URL** — query-string state with back/forward support and a visible 'N results' live region; done when the back button restores the previous filter set.
263. **Store recent searches locally** — last 8 queries in localStorage with a Clear button and a private-mode try/catch fallback; done when clearing empties the list and a blocked-storage test does not throw.
264. **Add a language filter that is honest about coverage** — shows English only until a second language ships, and lists a unit as unavailable rather than hiding it; done when the filter renders no non-English option today.
265. **Add a duration filter with stated ranges** — buckets built only from editor-stated durations, with unknown ones listed under 'Not stated' [needs-evidence]; done when no route lacking a duration appears in a bucket.

## Map-based discovery and nearby routes
266. **Create an Explore map view toggle** — a list/map switch that lazy-loads Leaflet only when the map is chosen, keeping Leaflet off other pages; done when the Network panel shows no Leaflet request on first load of Home and Explore list.
267. **Plot route start points as markers** — one marker per route with an accessible name and a popup linking to the route; done when each editorial route marker opens its route page.
268. **Add a 'Near me' action behind explicit consent** — requests geolocation only on button press, explains why, and reports denial gracefully; done when no permission prompt fires on page load.
269. **Compute nearest routes on device** — haversine distance from the user position to route starts, never sent to a server, with a label showing straight-line distance; done when a unit test matches a known-distance fixture and no network call carries coordinates.
270. **Add a manual place picker fallback** — choose a city from a list when location is denied or unavailable; done when the nearest list works with location blocked.
271. **Respect the tile policy on the discovery map** — online tiles only, no pre-fetching or bulk caching, attribution visible; done when the service worker (if any) excludes tile URLs and the attribution check in verify.sh passes.
272. **Cluster markers when the catalogue grows** — a small in-house grid cluster or pinned library version with SRI, activating above a documented marker count; done when 200 synthetic markers render without overlap in a test.
273. **Add a route-start card list under the map** — synced scrolling so selecting a card pans the map and vice versa; done when both selections stay in step in e2e.
274. **Show a map-free fallback** — if Leaflet or tiles fail, the list view stays usable with an inline notice; done when blocking the tile host leaves the list working.

## Collections, themes and seasonal picks
275. **Define collections as editorial data** — a collections array in data.js listing route/story ids with a hand-written blurb; done when the build fails on a collection that references a missing id.
276. **Render a Collections index and collection pages** — pre-rendered with canonical URLs and breadcrumbs; done when the pages appear in the sitemap and pass the link checker.
277. **Add theme landing pages from real tags** — themes generated only from tags that two or more units actually carry; done when no theme page lists fewer than two items.
278. **Add a 'Weekend from city X' finder** — pick a city and show routes the editors have tagged as reachable, with the editorial basis shown and no invented travel times [needs-evidence]; done when every suggestion cites a ledger entry id.
279. **Add seasonal picks editorially** — a season tag per route set by the founder with a note on why, and a 'Best months' line only where sourced [needs-decision]; done when a route without a source shows no months.
280. **Add a 'Continue where you left off' strip on Home** — shows the last-opened route or story from local state, hidden for new visitors; done when it is absent on first visit and present after viewing a route.
281. **Add a 'Short on time' collection from stated durations** — built only from routes carrying an editor-stated duration [needs-evidence]; done when each member shows its source.

## Route page: stops, gallery, glossary, quests
282. **Add stop-to-stop navigation** — Previous/Next stop controls and a sticky stop index, synced with the map selection; done when keyboard focus moves between stops and the map highlights the same stop.
283. **Deep-link every stop** — fragment URLs like `#stop-virupaksha` scroll and focus the stop heading; done when loading the URL lands on the correct stop with focus visible.
284. **Build a licensed image gallery** — a lightbox using media.js with per-image licence, credit and alt text, Escape to close, focus trap; done when an image lacking licence data is not rendered.
285. **Add an inline glossary** — terms defined once in data and shown as dotted-underline tooltips that also work on tap and keyboard; done when a term is announced by a screen reader with its definition.
286. **Create a Glossary page** — an A-Z index that aggregates all defined terms and links back to the places they occur; done when each term lists its source units.
287. **Add per-stop checklists** — 'What to look for' items drawn from the editorial text and ticked locally; done when ticks persist after reload and are cleared by Reset.
288. **Add editorial quests without scoring** — a short sequence of observation tasks per route (no points, no leaderboard); done when completing a quest writes a local record but awards nothing.
289. **Add a Stop notes field** — private local notes per stop shown on the route page and in My Journey; done when notes round-trip through export.
290. **Add keyboard shortcuts to the lightbox and stop index** — arrow keys and a help overlay listing them; done when the overlay opens on ? and is axe-clean.

## Route page: share, print, export, compare, accessibility
291. **Add a Share a stop action** — uses navigator.share when available and copies the stop deep-link otherwise; done when the fallback copies the correct URL and announces it politely.
292. **Add a print stylesheet** — a clean one-page-per-stop layout with the static map and QR-free plain URL, no nav chrome; done when a Playwright print-to-PDF has no clipped text.
293. **Export editorial lines as GeoJSON** — a download of the route line and stop points, with properties.note stating the line is an interpolated editorial connector and not a survey; done when the file validates and the note is present.
294. **Export editorial lines as GPX** — track plus waypoints with a name and description repeating the 'not a surveyed path' disclaimer; done when the GPX opens in a parser test with the disclaimer in metadata.
295. **Label recorded tracks differently from editorial lines** — the 8 Chennai tracks export as recorded data with their own provenance, and the UI never mixes the two terms; done when both export types carry distinct labels in a test.
296. **Add a route comparison view** — side-by-side of two or three routes on stops, stated distances and sources, showing 'not stated' where data is missing; done when a missing value never renders as 0.
297. **Add an accessibility mode toggle** — a persistent switch for larger targets, stronger contrast, no map, and a plain list of stops; done when the mode applies on reload and axe passes in both states.
298. **Provide a text alternative for every map** — a stop list and a described route summary that carries the same information as the map; done when the map can be skipped by a skip link.
299. **Add a copy-citation button** — produces a stable citation (title, site, URL, date accessed) for a route or story; done when the clipboard text includes all four parts.

## Walk mode
300. **Add a Start walk screen** — an explicit consent explainer before geolocation, with what is and is not stored; done when no location request fires before the consent button is pressed.
301. **Show live position on the route map** — watchPosition with accuracy circle and a stop button, no coordinates sent anywhere; done when the Network panel stays silent during a simulated walk.
302. **Show next-stop distance and direction** — straight-line distance and compass bearing to the next stop, labelled approximate; done when the value updates in a mocked-geolocation test.
303. **Give off-route hints gently** — when the user is further than a stated threshold from the editorial line, show a neutral note that the line is an editorial connector, not a path to follow [needs-decision]; done when the threshold lives in one config constant and the text avoids the word 'wrong'.
304. **Hold a screen wake lock during walk mode** — navigator.wakeLock with re-acquire on visibilitychange and a visible toggle; done when the toggle releases the lock and unsupported browsers hide it.
305. **Make walk mode battery-aware** — reduce update frequency and offer a low-power mode when the Battery API reports under 20% or is unsupported-safe; done when the lower-frequency option is selectable and works without the API.
306. **Record a walk with real measurement** — store timestamped points on-device and compute distance and elapsed time from them, discarding fixes with poor accuracy; done when a replayed fixture yields the expected distance within a stated tolerance.
307. **Auto-pause on stationary periods** — exclude time standing still from moving time and show both; done when a fixture with a 10-minute stop shows distinct elapsed and moving times.
308. **Handle permission and signal failures** — clear states for denied, unavailable and timeout with a manual 'I'm at stop N' control; done when each state is covered by a mocked test.
309. **Add a compass-free arrival cue** — vibrate (when supported) and show a banner as the user comes within a stated radius of a stop [needs-decision]; done when the radius is one config constant and the cue is opt-out.
310. **Add a Walk summary screen** — shows measured distance, moving time and stops reached, with a save/discard choice; done when discard leaves no stored record.

## Audio player
311. **Add a listening queue** — add/remove/reorder tracks, persistent across navigation in audio.js; done when a queue of three plays in order and survives a route change.
312. **Add playback speed** — 0.75x to 1.75x for speechSynthesis rate with the choice remembered; done when changing speed applies to the next utterance and persists.
313. **Add a sleep timer** — 5/10/20/30 minutes or end of stop, with a visible countdown and a fade-safe stop; done when the speech cancels at expiry in a fake-timer test.
314. **Sync a transcript with playback** — highlight the sentence being spoken using boundary events where the voice supports them, with a fallback to per-paragraph highlight; done when the fallback runs under a voice that emits no boundaries.
315. **Resume where you stopped** — store the unit and sentence index locally and offer 'Resume' on return; done when reload shows Resume pointing at the saved position.
316. **Bookmark moments** — a bookmark button saves unit, sentence and an optional note locally, listed in My Journey; done when a bookmark deep-links back to the sentence.
317. **Offer per-stop and per-story playback** — play one stop, the whole route or a whole story from distinct buttons; done when each button queues the expected units.
318. **Wire up Media Session** — set metadata, play/pause/next/previous/seekto handlers so lock-screen controls work, with no artwork that lacks a licence; done when handlers are registered and verified in a browser test.
319. **Say plainly what background playback can do** — speechSynthesis can stop when a tab is backgrounded on some phones, so show a one-line caveat and detect interruption [needs-evidence]; done when the caveat shows only on browsers tested in the ledger.
320. **Make the voice selectable** — list installed system voices filtered by language with a preview, and the first-run default stated honestly as a device voice and not recorded narration; done when the label 'device voice' appears in the player.
321. **Prepare a recorded-narration slot** — an optional audio file field per unit that, when present, replaces speechSynthesis and uses a real audio element with proper seeking [needs-decision]; done when a unit with a test mp3 plays through the audio element.
322. **Add a skip-back/skip-forward by sentence control** — 10-sentence jumps and a scrub list; done when jumps land on sentence boundaries.
323. **Pause on audio interruption and resume politely** — handle speechSynthesis cancel from phone calls with a visible Resume; done when a simulated cancel shows Resume.

## Stories reader
324. **Show reading progress** — a thin progress bar and 'N min left' computed from word count at a stated words-per-minute constant; done when the bar reaches 100% at the last paragraph.
325. **Generate a table of contents** — from h2/h3 headings with scrollspy and a collapsible mobile drawer; done when each TOC link focuses its heading.
326. **Add reading modes** — light, dark, sepia and a plain high-contrast mode honouring prefers-color-scheme as default; done when the choice persists and contrast passes in each.
327. **Add text size and line-length controls** — five steps from 87% to 150% via CSS variable, with a comfortable measure cap; done when layout does not overflow at the largest step on a 320px viewport.
328. **Show related stories and routes** — based on shared tags and places, never a fake 'trending' list; done when each related item shares at least one real tag.
329. **Support citations and footnotes** — numbered inline markers that open the note in a popover and appear as endnotes in print; done when every marker has a matching note and the build fails otherwise.
330. **Add a 'Sources' block per story** — links the evidence entries behind claims, labelled by type; done when each story lists at least one source or the build warns.
331. **Remember reading position per story** — store the scroll anchor locally and restore on return, with a 'Start over' link; done when reload returns to the same paragraph.
332. **Add a distraction-free focus mode** — hides nav and related blocks, keeping progress and size controls; done when exiting restores the layout without a reload.

## My Journey: saved routes, walks, journal
333. **Add Save route buttons** — a bookmark on cards and route pages writing to journey-store.js; done when saved routes appear on My Journey and survive reload.
334. **List completed walks with measured data** — only walks recorded in walk mode show distance and time, and manually marked walks show 'completed' without numbers; done when a manual entry never displays a distance.
335. **Add a journal with local photos** — notes plus images stored in IndexedDB, resized client-side to a stated maximum, never uploaded; done when a photo entry reloads offline and the Network panel shows no upload.
336. **Strip photo metadata on import** — remove EXIF location by re-encoding the image through a canvas, with a note shown to the user; done when a fixture with GPS EXIF has none after saving.
337. **Show storage usage and a purge control** — navigator.storage.estimate where available, with per-category delete; done when deleting journal photos lowers the shown figure.
338. **Request persistent storage politely** — ask via navigator.storage.persist only after the user saves their first photo, and explain the effect; done when no request fires before that.
339. **Award badges only for real achievements** — badges derive from recorded data (e.g. a measured walk completed on a named route) with the rule shown on each; done when no badge unlocks from a manual tick alone.
340. **Show an honest empty state** — My Journey with no data explains what appears here and links to Explore, with no placeholder statistics; done when a fresh profile shows zero fabricated figures.
341. **Add a manual language override in the player** — choose the speech language independent of UI language; done when the override persists and is shown in the player.

## My Journey: export, import and backups
342. **Export all journey data as JSON** — a versioned file containing saved routes, walks, bookmarks and journal text; done when the file has a schemaVersion field and validates against a schema in tests.
343. **Import with validation and preview** — parse, schema-check and show what will be added or overwritten before merging; done when a malformed file is rejected with a readable message and no state change.
344. **Handle photos in backups** — an optional zip or multi-file bundle including images with a size warning; done when a round-trip export-import restores byte-identical photos.
345. **Prompt periodic device-local backups** — a gentle reminder after a stated number of new entries, saving to a user-chosen file with the File System Access API where supported and a download otherwise; done when the fallback download works in a non-supporting browser.
346. **Migrate stored data between versions** — a migration function chain run on load, covered by fixture snapshots of earlier schemas; done when each old fixture loads to the current shape.
347. **Explain where data lives** — a plain note that data stays in this browser, can be lost by clearing site data, and is not synced anywhere; done when the note appears next to Export.
348. **Offer a one-click Delete everything** — typed confirmation then clearing localStorage, IndexedDB and caches the app owns; done when all app keys are gone afterwards.
349. **Add a data-integrity check** — a Settings action that counts entries and flags corrupt records without deleting them; done when a corrupt fixture is reported and left intact.

## Multilingual UI and language switcher
350. **Extract UI strings to a catalogue** — move interface text into per-locale JSON with stable keys and an English source of truth; done when a lint step reports any hard-coded string left in views.
351. **Add a language switcher that lists only shipped languages** — hidden while there is one, so no non-working choices appear; done when the control renders only when two or more locales exist.
352. **Implement per-unit fallback** — a story or stop missing a translation shows the English text with a visible 'shown in English' marker and lang attribute; done when a missing-key fixture renders the marker and lang="en".
353. **Set lang and hreflang correctly** — html lang per page and hreflang links only for pages that exist in that language; done when verify.sh finds no hreflang to a missing page.
354. **Load script-specific fonts on demand** — subset webfonts for Devanagari, Tamil, Kannada and others requested by locale, with font-display swap and checked licences [needs-decision]; done when an English visit downloads none of them.
355. **Format numbers and dates by locale** — via Intl with explicit timeZone Asia/Kolkata for any shown times; done when a test renders the same value under two locales.
356. **Pick speech voices per language** — match speechSynthesis voices to the content language and tell the user when none is installed; done when a missing voice shows an explanatory message rather than silence.
357. **Persist the language choice** — URL prefix wins, then a local preference, then a one-time suggestion from navigator.languages that never auto-redirects; done when no redirect occurs on first load.
358. **Add a What's new page** — a hand-written changelog of shipped routes and features, linked from the footer; done when each entry has a date and a link.

## Onboarding, help and feedback
359. **Add a skippable first-run welcome** — three short cards on what Naarad is, that it is free and what is not yet there (no accounts, no app, no recorded narration); done when it appears once and Skip leaves no re-prompt.
360. **Add contextual first-use hints** — one-time coach marks for walk mode and the listening bar, dismissible and resettable in Settings; done when a hint shows once per feature.
361. **Build a Help/FAQ page** — grouped questions with expandable details markup and FAQ structured data only where answers are visible on the page; done when each question is real, answered, and JSON-LD matches the visible text.
362. **Add a Settings page** — consolidates text size, reading mode, accessibility mode, language, reset of hints and data controls; done when each setting persists independently.
363. **Add a feedback widget without a backend** — a form that composes a mailto or opens a pre-filled public issue link, including page URL and app version only, with a note of what is included; done when no data is sent without the user pressing send.
364. **Collect structured feedback options** — 'Report a factual error' with unit id and quoted passage auto-filled for editorial review; done when the link carries the unit id.
365. **Add a Report a problem on map/GPX** — links the exact route and export type for line-quality reports; done when the prefilled message names the route and the editorial-line disclaimer.
366. **Provide a Contact and corrections page** — states the corrections policy and response expectation only as the founder decides [needs-decision]; done when the page exists and makes no promised response time unless approved.

## Newsletter, notifications, sharing and install
367. **Add a newsletter placeholder component** — shows 'Not open yet' with an interest note stored locally and nothing transmitted; done when submitting stores nothing off-device and says so.
368. **Wire a real newsletter provider later** — form action, consent text and double opt-in with a DPDP-aligned notice [needs-backend] [needs-decision]; done when provider choice is logged and an end-to-end opt-in test passes.
369. **Add a web push opt-in for new routes** — a prompt shown only from a user-initiated settings toggle, never on load; done when no Notification permission request occurs without a click [needs-backend].
370. **Build the push sender pipeline** — VAPID keys, subscription storage and a publish-time trigger when a route ships, within the Rs 1,000 cloud cap [needs-backend] [needs-decision]; done when a test subscription receives one notification and the monthly cost is logged.
371. **Add a manifest and service worker with an app-shell cache** — cache only the site's own static assets, excluding map tiles, with a versioned cache name and update toast; done when verify.sh confirms no tile host in the cache list.
372. **Show a custom install prompt** — capture beforeinstallprompt, show a quiet Install item in the menu after a second visit, and provide iOS Add-to-Home-Screen instructions; done when the item stays hidden if the event never fires.
373. **Register Web Share Target** — manifest share_target so a shared link opens a 'Save to My Journey' screen with the URL as a saved note; done when a simulated share request produces a saved entry [needs-decision].
374. **Add rich share cards** — per-route Open Graph and Twitter tags with a licensed, build-generated image and honest titles; done when every route page has a unique og:image URL that resolves.
375. **Add a performance budget for new features** — verify.sh fails if the home page JS exceeds a stated size or if search/map/walk code is eagerly loaded; done when a deliberate oversize import trips the check.

# Part 4 (items 376-500): Content, trip planning, SEO and growth

## Research workflow and source rules
376. **Write the route research template** — one `docs/research-template.md` with sections for site, dates, sources, claims, open questions; done when a new route can be started from it without asking anyone what to fill in.
377. **Define the source tiers** — tier 1 ASI/state archaeology notices, UNESCO, official boards; tier 2 published scholarship and museum pages; tier 3 blogs/forums as leads only; done when the tiers are written in docs and every practical JSON claim names its tier.
378. **Forbid uncited claims in published copy** — every date, dimension, fee, hour or name on a page maps to a source row; done when a script fails the build on a claim id with no source.
379. **Create a claims ledger per route** — `content/claims/<route>.json` listing claim, source URL, access date, verifier; done when Hampi, Thanjavur and Auroville each have a ledger covering every number in their pages.
380. **Record access dates on every source** — ISO date field required beside each URL; done when the schema check rejects a source without one.
381. **Archive cited pages** — save each tier 1/2 source to the Wayback Machine and store the archive link beside the original; done when a dead link in the ledger still resolves via its archive link.
382. **Add a link-rot checker** — a monthly script that requests each ledger URL and reports non-200 responses; done when a deliberately broken URL shows up in the report.
383. **Separate fact from interpretation in copy** — mark stories' interpretive lines versus sourced facts in the ledger; done when each story paragraph is tagged and no untagged paragraph exists.
384. **Write the "unknown" convention** — pages say "not yet verified" for missing hours or fees instead of guessing; done when the 5 stops without hours and all fee fields render that exact wording.
385. **Log rejected claims** — keep `content/claims/rejected.md` with claims dropped as unciteable (like the removed bus data) and why; done when each past removal has an entry. [needs-evidence]

## Licence rules, editorial checklist, field verification, community review
386. **Publish a photo licence policy** — allow only own photos, CC0, CC BY/BY-SA with attribution, public-domain with proof; done when `docs/licences.md` lists allowed and banned licences and `media.js` rejects images lacking a licence field.
387. **Ban "found online" images** — no image without recorded author, source URL and licence; done when a build check lists zero images missing those three fields.
388. **Define the text-reuse rule** — no copying from Wikipedia/guides beyond short quotes; CC BY-SA text is only reused with share-alike marked; done when the policy is written and a copied-paragraph similarity check runs on new content.
389. **Add a credits page** — list every photo author, licence and source on one page generated from data; done when the page builds from the same fields `media.js` uses.
390. **Write the editorial checklist** — one-page pre-publish list: sources cited, claims ledgered, licences checked, place names spelled consistently, dates dated, no superlatives without proof; done when each merged content PR links a ticked copy.
391. **Add a style guide for heritage terms** — fixed spellings and diacritics policy (Vijayanagara, Brihadisvara etc.) with a glossary; done when a lint flags variant spellings across content.
392. **Ban unsearched marketing words** — "authentic", "hidden gem", "must-see" blocked in headings unless sourced; done when the linter fails on them in titles and h2s.
393. **Create a field-verification protocol** — checklist for a walker to confirm hours, gates, shade, toilets, water, path surface on site with date-stamped photo proof; done when one stop is verified by the protocol and its record is committed. [needs-evidence]
394. **Add a "verified on site" badge rule** — badge only when a dated field record exists in the repo; done when no stop shows the badge without a matching record.
395. **Open a community correction channel** — a public "report a correction" link (GitHub issue form, no account on Naarad) with fields for page, claim, source; done when a test correction round-trips from form to ledger edit. [needs-decision]

## New routes and stories
396. **Rank candidate routes by evidence** — shortlist Pondicherry heritage quarter, Mahabalipuram, Badami-Aihole-Pattadakal, Belur-Halebidu, Mysuru, Kanchipuram; scored on available sourced facts, not search volume alone; done when a ranked table sits in docs with source counts.
397. **Pick the next route from the keyword bank** — decide between Pondicherry itinerary (1,900/mo) and Chennai getaways (1,300/mo) angles against what can be honestly sourced; done when the founder choice is logged. [needs-decision]
398. **Draft the Pondicherry walking route outline** — stops list with sourced one-line facts and open questions, no copy yet; done when every stop has at least two cited sources or is marked pending.
399. **Complete hours for the 5 stops lacking them** — find official sources for each missing timing or mark them "no official hours published"; done when all 15 stops carry either a cited hour or that explicit statement.
400. **Source fees for all 15 stops** — look up official ticket pricing (ASI/state) with date; done when each stop has a cited fee or an explicit "unverified" flag. [needs-evidence]
401. **Grow Hampi beyond 8 stops only with sources** — add a stop only when ledger rows exist; done when any new Hampi stop has tier 1/2 sources and a licence-cleared image.
402. **Write the Thanjavur stop expansion plan** — list which of the nearby Chola sites could be added and what must be verified first; done when each candidate lists missing evidence.
403. **Write a new story template** — structure with a hook, 3 sourced facts, a place link, a "what we are not sure of" box; done when the three existing stories validate against it.
404. **Commission three new stories from the claims ledger** — each tied to an existing route stop; done when each story links to its route and every sentence of fact has a ledger id.
405. **Add a route-requirements gate** — a route cannot publish unless it has GPX/geometry, ≥3 stops, hours or unknown flags, licences and a reviewer; done when a stub route fails the build.

## Trip-planner pages from content/practical
406. **Surface content/practical on route pages** — render a "Plan your visit" block from the JSON that is currently hidden; done when Hampi, Thanjavur and Auroville show it and the build fails if JSON and page disagree.
407. **Add a "Getting there" section** — only sourced rail/air/road starting points with distance marked computed (OSRM) and no bus claims; done when each statement shows source or "computed" tag.
408. **Add visiting hours table per stop** — hours with weekly closures and a "checked on <date>" line; done when the 10 known stops render and 5 unknown show the explicit statement.
409. **Show "checked" and source on every practical fact** — small footnote with date and link; done when no practical fact renders without both.
410. **Set a refresh cadence for practical facts** — recheck hours/fees every 6 months or sooner on seasonal change; done when a script flags any fact older than its cadence.
411. **Write dress and conduct guidance for temples** — shoulders/knees, footwear removal, photography limits, each sourced from the site or board; done when each guidance line has a citation or is cut.
412. **Add a season chart per route** — heat, rain and festival windows from IMD climate normals or similar official data, shown with source; done when each chart value maps to a cited table. [needs-evidence]
413. **Add a "best time to walk" note without inventing** — time-of-day guidance only from sunrise/sunset computed from coordinates; done when the note names the computation method.
414. **Build 1-day and 2-day itinerary pages** — itineraries composed only from existing route stops and computed walking times; done when each itinerary sums to its stated total using the OSRM figures.
415. **Add a printable route sheet** — print CSS giving one A4 page with map, stops, hours and QR to the live page; done when print preview of Hampi fits one sheet and offline text is readable.
416. **Add shareable itinerary links** — itinerary encoded in the URL hash, no accounts, no server; done when a copied link reopens the same selection in a fresh browser.
417. **Add a "what to carry" checklist** — water, hat, footwear, cash for entry (only if fees are sourced); done when each item is tied to site conditions in the ledger.
418. **Add accessibility notes per stop** — steps, gradients, seating, surface, marked "unverified" until a field record exists; done when no stop claims step-free access without a record.
419. **Add safety and etiquette box** — emergency numbers from official sources, heat advice, respect-for-worship text; done when each number is cited to a government page.
420. **Add "last reviewed" to the route index** — each card shows when its practical block was last checked; done when cards read from the JSON dates.

## Blog: index, template, fact-check workflow
421. **Create the blog index at /blog/** — list articles with date, summary, route links, no tracking; done when it builds into a static page and is in the sitemap.
422. **Design the article template** — title, byline, dates, TOC, body, sources list, related routes, FAQ only when real; done when a sample article renders and passes the head checks.
423. **Generate a table of contents from headings** — anchors from h2/h3 at build time; done when links work without JavaScript.
424. **Set the byline to "Naarad editorial"** — no invented personal authors or bios; done when every article shows that byline plus a linked editorial policy.
425. **Add published and updated dates** — visible on page and in Article schema, updated only when content changes; done when the two match for every article.
426. **Add a sources section to every article** — numbered list with access dates; done when each in-text claim number resolves to an entry.
427. **Add related-routes module** — each article links to its relevant route pages chosen manually; done when no article has zero route links.
428. **Add an RSS feed** — `/blog/feed.xml` with full text of the latest items; done when a feed validator passes and it is linked from `<head>`.
429. **Write the AI-draft fact-check workflow** — draft → claim extraction → each claim matched to a source → reviewer sign-off → publish; done when the doc exists and the first draft goes through it.
430. **Require a claim table for AI-assisted drafts** — table of every number, name and date in the draft with source link and verdict; done when a draft with an unmatched row cannot be merged.
431. **Fact-check Distribb draft #121532** — verify every claim against sources, delete or fix invented ones, log verdicts; done when the claim table is complete and the reviewer signs off or the draft is dropped. [needs-evidence]
432. **Fact-check Distribb draft #121533** — same process, separate claim table; done when each claim has a verdict and all fails are removed before any publish. [needs-evidence]
433. **Store both drafts in the repo as unpublished** — save under `content/drafts/` with status "unverified" and noindex excluded from build; done when neither draft appears in the site, sitemap or feed.
434. **Decide whether to rewrite or publish after review** — founder chooses per draft after seeing fail rate; done when the decision is logged. [needs-decision]
435. **Store the keyword bank in the repo** — `content/seo/keywords.json` holding term, monthly volume, source tool, date captured, target page; done when the five known terms and their volumes are recorded with the Distribb capture date.

## Keyword targets and on-page SEO
436. **Map each keyword to one page** — Bangalore weekend getaways (9,900/mo), Pondicherry itinerary (1,900), Chennai getaways (1,300), Hampi itinerary (1,000), heritage tours in India (590); done when each has exactly one target URL and no two share.
437. **Decide the Bangalore getaways page type** — a curated guide linking to Hampi and others, only if the content can honestly be sourced; done when the founder confirms scope. [needs-decision]
438. **Write the Hampi itinerary page** — built from the existing route, 1-day and 2-day variants; done when the page has sourced hours, computed walking times and a "checked" date.
439. **Write a Chennai getaways page** — only places with sourced practical facts and travel approach from the site data; done when each place has at least one citation. [needs-evidence]
440. **Plan a Pondicherry itinerary route first** — publish the route before the blog post so the guide has substance; done when the route is live before the itinerary article ships.
441. **Treat "heritage tours in India" as a hub** — a page explaining Naarad's walking routes rather than selling tours; done when it links to every route and states Naarad is a free atlas.
442. **Do not target "authentic"** — the term is unsearched, so no keyword effort; done when the keyword bank records it as rejected with that reason.
443. **Write title patterns** — "Route name walking route: stops, hours | Naarad" with a 60-character limit; done when a check lists no title over limit or duplicated.
444. **Write unique meta descriptions** — 140-160 characters, factual, no superlatives; done when every page has one and none duplicates another.
445. **Enforce one h1 and ordered headings** — build lint for exactly one h1 and no skipped levels; done when it passes on all pages.
446. **Define internal link rules** — each route links to its stories and each story to its route; routes link to neighbouring routes; done when a crawl shows no orphan page.
447. **Write an anchor text guide** — descriptive anchors ("Hampi walking route") instead of "click here"; done when a lint flags generic anchors.
448. **Add visible breadcrumbs** — Home › Routes › Hampi matching the schema; done when screen reader and markup both show the same trail.
449. **Add FAQ blocks only where real questions exist** — questions from search console or contact messages with sourced answers; done when each FAQ item has a source and none was written to fill a template.
450. **Set canonical URLs and noindex rules** — canonical on every page, noindex on drafts and test pages; done when a crawl reports one canonical per page.

## Structured data, sitemap, robots
451. **Add Article JSON-LD to blog posts** — headline, dates, publisher Naarad, image; done when the Rich Results Test shows no errors.
452. **Add TouristTrip JSON-LD to routes** — name, itinerary of stops, no offers or prices not sourced; done when validator shows no errors and no invented fields.
453. **Add Place JSON-LD to stops** — name, coordinates, address if cited; done when all 15 stops have valid objects.
454. **Extend BreadcrumbList to blog and stories** — same trail as visible breadcrumbs; done when schema and visible trail match on every page.
455. **Ban invented ratings** — no AggregateRating or Review markup unless real, collected reviews exist; done when a grep for those types returns nothing.
456. **Add FAQPage schema only with visible FAQ** — schema generated from the on-page FAQ data; done when no page has FAQ schema without matching visible text.
457. **Generate accurate lastmod in sitemap** — from content date fields, not build time; done when unchanged pages keep their old lastmod across builds.
458. **Include blog, stories and new routes in sitemap** — generated by the build; done when a diff of sitemap against built pages shows zero missing.
459. **Audit robots.txt** — allow content, block drafts and test paths, reference sitemap; done when a robots tester confirms key pages are allowed.
460. **Add a schema validation step to verify.sh** — parse JSON-LD in built pages and fail on syntax errors or banned types; done when a broken schema fails the script.

## Search Console workflow and AI-search visibility
461. **Document the weekly Search Console check** — a 15-minute routine reading queries, pages, coverage and indexing; done when the doc exists and the first dated log entry is committed.
462. **Log the baseline of 53 impressions/week** — note it is mostly brand queries with capture date; done when the baseline file is in the repo with the date.
463. **Separate brand from non-brand queries** — regex filter for "naarad" in saved reports; done when the log reports both groups separately.
464. **Request indexing for new pages once** — record the date after publishing; done when each new URL has an inspection date logged.
465. **Track queries that would deserve FAQ answers** — collect real queries from Search Console as FAQ sources; done when each FAQ item cites the query log entry.
466. **Publish llms.txt** — short description, route list, source policy and licence contact; done when the file at the root contains only claims present on the site.
467. **Make pages quotable for AI citation** — short factual summary block with sources at the top of each route; done when each route has the block and it matches the ledger.
468. **Test AI-answer visibility manually each quarter** — ask a fixed set of 10 questions in major assistants and record whether Naarad is cited and whether answers are accurate; done when the first dated results table is stored without claiming improvement. [needs-evidence]

## Backlinks, PR, Wikipedia and citations
469. **List heritage bodies to contact** — ASI circles, state archaeology departments, Hampi World Heritage Area authority, INTACH chapters; done when a contact sheet with official pages exists.
470. **Write an outreach email template** — a short ask to verify facts or link the atlas, offering free use; done when the template contains no traffic or ranking claim.
471. **List tourism boards** — Karnataka, Tamil Nadu, Puducherry tourism pages that accept resource links; done when each has a submission path recorded.
472. **Build a blogger and walk-leader list** — heritage writers and walk organisers, with their licence for any quoted material; done when each entry has a rationale and a contact path.
473. **Check Wikipedia/Wikivoyage hygiene** — follow their conflict-of-interest rules; propose edits on talk pages only; done when a policy note says Naarad never edits its own links in without disclosure.
474. **Offer Wikivoyage citations where Naarad's sources help** — contribute source-based corrections, not promotional links; done when each contribution cites the original source rather than Naarad.
475. **Publish a "cite Naarad" page** — suggested citation format and licence of text and data; done when the page exists and matches the licence policy.
476. **Review the Distribb backlink exchange offer decision** — subscription cancelled; no paid link schemes; done when the policy says no paid or exchanged links. [needs-decision]

## Social, share cards, short-form and Google presence
477. **Generate per-route share cards** — Open Graph images from route data (name, stops, distance computed); done when each route shares a unique image and alt text.
478. **Add Open Graph and Twitter tags** — title, description, image on every page; done when a debugger tool shows correct previews for 5 sample pages.
479. **Write a short-form content plan** — one fact per post drawn from the ledger with a source in the caption; done when a 4-week queue exists with ledger ids.
480. **Set rules for video** — no recorded narration is promised; silent map-walkthroughs only until audio exists; done when the plan carries that rule.
481. **Pick the channels** — choose among Instagram, YouTube Shorts, X by capacity; done when the founder picks max two. [needs-decision]
482. **Decide whether a Google Business Profile applies** — Naarad has no physical visit location; done when the decision and reasoning are recorded.
483. **Add Maps-friendly stop links** — outbound "open in maps" links using coordinates from the data; done when each stop's link opens at the right point.

## Newsletter, analytics and funnels
484. **Choose a newsletter approach** — a plain double-opt-in email tool or an RSS-to-email service, free tier only within the Rs 1,000 cap; done when a tool is chosen and cost recorded. [needs-decision]
485. **Write the privacy notice for email signup** — what is collected, why, how to unsubscribe; done when the notice is linked at the form.
486. **Define the newsletter format** — monthly: one new fact set, one route update, corrections; done when the first issue template is in the repo.
487. **Define the analytics event list** — route_view, stop_open, print_click, share_click, itinerary_copy, newsletter_submit, no personal data; done when the list is documented with purpose per event.
488. **Make analytics consented and privacy-first** — no events before consent, no cross-site IDs, honour Do Not Track; done when a test shows zero network calls before consent.
489. **Pick an analytics tool within cost limits** — cookieless or self-hosted option under the spend cap; done when cost and data location are recorded. [needs-budget]
490. **Define the account-free funnel** — landing → route → stop → print/share/subscribe; done when each step maps to an event and the funnel report works without any login.
491. **Require evidence before building from analytics** — a feature change needs a logged observation or an override per the ops rules; done when a change template has an evidence field.

## Local-language SEO, calendar, dashboards and watchlist
492. **Assess Kannada, Tamil and Hindi demand** — check Search Console and keyword tools for non-English queries before translating; done when a demand note exists. [needs-evidence]
493. **Plan translation quality control** — native reviewer for every translated route, with the English source ledger shared; done when a reviewer sign-off field is required. [needs-decision]
494. **Add hreflang only when pages exist** — never for untranslated pages; done when no hreflang points to a missing URL.
495. **Create a content calendar** — one route update or story per month tied to festivals and seasons that are cited; done when 6 months of entries exist with sources.
496. **Set a realistic cadence** — limit to what the fact-check workflow can handle (for example one article and one route fix monthly); done when the cadence is stated and reviewed after 3 months.
497. **Build a measurement dashboard** — a single page of Search Console exports and event counts, no promises, recording dates; done when data is updated by a documented manual step.
498. **Track content quality metrics** — percent of claims with sources, facts older than cadence, open corrections; done when the dashboard reports all three from the repo.
499. **Create a competitor and alternative watchlist** — list guides, tourism sites and apps covering the same places, with what each cites; done when a quarterly review note lists gaps Naarad can fill.
500. **Review the roadmap items against evidence each quarter** — remove content or SEO items whose assumptions fail; done when a dated review note lists kept, dropped and why.

# Naarad roadmap, items 501-625: Offline/PWA, performance, accessibility, quality engineering

Tags: [needs-budget] paid service, [needs-decision] founder call, [needs-devices] physical devices. Every feature item ships behind a flag and needs evidence/G1 or a logged override (ops rule). Spend stays within the Rs 1,000 cap. No number below is a claim; every target is set only after a baseline is measured.

## Offline route bundles v2

501. **Define a bundle manifest schema** — one JSON per route listing every URL, byte size, sha256, content type, schemaVersion and bundleVersion, documented in docs/; done when a node test validates all generated manifests against the schema and rejects a manifest with a missing hash.
502. **Generate manifests in build-site.mjs** — emit `/offline/<slug>.manifest.json` from the same file list the prerender writes, so manifest and pages cannot drift; done when scripts/verify.sh fails if a manifest URL 404s in the built output.
503. **Verify sha256 on download** — hash each fetched asset with SubtleCrypto before it enters the cache and discard on mismatch; done when an e2e test that tampers one byte shows the bundle refusing to finish and no partial entry left in the cache.
504. **Version bundles independently of the shell** — bundleVersion is a content hash of the manifest so a typo fix in one route invalidates only that route; done when a test changes one story and exactly one bundle reports update-available.
505. **Pre-flight storage check** — before download compute manifest total plus 20% headroom and compare with `navigator.storage.estimate()` free space, showing a plain-language "needs X MB, Y MB free" message; done when a Playwright test with a stubbed small quota blocks the download and shows that message.
506. **Resumable downloads** — persist per-asset progress in IndexedDB and skip already-verified assets after a reload, tab kill or network drop; done when an e2e test that goes offline at 50% and back online completes without refetching verified assets.
507. **Download queue with concurrency cap** — fetch at most 4 assets at once, retry with backoff, and pause on `saveData` or a metered connection unless the user confirms; done when a throttled-network test shows the cap held and the pause prompt appearing.
508. **Per-bundle delete and delete-all** — a Saved-offline screen lists bundles with size and date and removes cache entries plus IndexedDB rows in one transaction; done when after delete the cache keys for that bundle are zero and the stats readout agrees.
509. **Update-available flow** — when a newer manifest hash is seen, show "Update available (N KB changed)" and download only changed assets (diff by sha256), keeping the old bundle usable until the swap; done when an offline reload mid-update still serves the old bundle intact.
510. **Atomic bundle swap** — stage new assets in a temporary cache, then rename or commit the pointer in a single IndexedDB write; done when a fault-injection test that kills the tab mid-commit leaves either the old or the new bundle fully readable, never a mix.
511. **Bundle integrity self-check on open** — when an offline route opens, confirm all manifest URLs exist in cache and offer "Repair" if any are missing (eviction); done when manually deleting one cache entry surfaces the repair prompt and Repair restores it.
512. **Offline coverage indicator** — show per-route state (not saved, saving, saved, update, damaged) with text and icon, not colour alone; done when axe passes and all five states are reachable in an e2e test.
513. **Cap total offline footprint** — set a default soft cap (value chosen after measuring real bundle sizes) with oldest-unopened-first suggestion to remove; done when exceeding the cap triggers the suggestion and never deletes anything without a tap. [needs-decision]
514. **Gate bundles behind F-002 with a kill switch** — a remote-readable `offline-flags.json` can disable new downloads and purge on next visit if a bad bundle ships; done when flipping the flag in a staging build stops downloads within one page load, verified by e2e.

## Basemap strategy under OSM policy

515. **Write a basemap options memo** — compare self-hosted PMTiles on Cloudflare R2, a permitted commercial source with offline terms, and a no-map text/elevation fallback, with cost per month at expected traffic; done when the memo names one recommended path and its cost sits under the Rs 1,000 cap. [needs-decision]
516. **Licence review checklist for tile data** — record ODbL attribution, share-alike scope, and any provider terms for each candidate source in docs/; done when each source has a dated row with the URL of the terms read and a yes/no on offline caching.
517. **Prototype a PMTiles extract for one route** — extract a bounding box around a single walk with the pmtiles CLI at limited zoom range and measure the file size; done when the file size is recorded in docs/ and the route renders from it with no network to tile.openstreetmap.org.
518. **Serve PMTiles via HTTP Range from R2 with CORS** — configure bucket CORS and Range support and verify the SW can cache the Range responses; done when a Playwright test loads the map offline from a saved PMTiles chunk. [needs-budget]
519. **Choose a renderer and measure its weight** — compare MapLibre GL, a raster-PMTiles layer, and the current renderer by gzipped JS size and low-end Android frame time; done when the choice is written down with the measured sizes and the JS budget impact.
520. **Draw a simple vector fallback map** — render route polyline, start/end and key stops as inline SVG with no tiles, used when no basemap is saved; done when the offline route page shows the path and stops with tiles blocked in Playwright.
521. **Enforce attribution on every map surface** — render "© OpenStreetMap contributors" (and any provider credit) in the map UI, in the offline map and in exports; done when an e2e test finds the attribution link in each map view including offline.
522. **Add a guard against bulk OSM tile fetching** — a lint/test fails the build if any bundle manifest or SW rule references `tile.openstreetmap.org`; done when a deliberately added URL makes verify.sh fail.

## Service worker architecture

523. **Document the cache strategy per route type** — table in docs/ for shell, route pages, story pages, JSON content, images, audio, fonts and tiles: strategy, cache name, max entries, expiry; done when sw.js has a matching code branch for every row, checked by a node test that reads the table.
524. **Implement stale-while-revalidate for content JSON** — serve cached JSON immediately and refresh in the background with a "content updated" signal to the page; done when an e2e test changes the JSON on the server and sees the new text on the second load.
525. **Use network-first with timeout for HTML navigations** — fall back to cached page after a set timeout and to an offline page as last resort; done when a throttled test shows the cached page appearing after the timeout and the offline page only when nothing is cached.
526. **Support Range requests for audio** — respond to `Range: bytes=` from the cached full file with 206, correct Content-Range and Accept-Ranges; done when a Playwright test seeks in offline audio and playback resumes at the right second in Chromium and WebKit.
527. **Do not cache partial 206 responses blindly** — never `cache.put` a 206; fetch the full file during bundle save instead; done when a unit test shows the SW refusing to store a 206 and a test confirming audio still plays offline after bundle save.
528. **Cache-version migration plan** — on activate, delete only caches with the `naarad-` prefix that are not in the current set, and migrate IndexedDB schema with versioned steps; done when a test upgrading from v12 fixtures to current keeps saved bundles and drops stale shell caches.
529. **Skip-waiting policy** — do not call skipWaiting automatically; show "New version ready, reload" and apply on confirmation or next cold start; done when e2e shows an open tab keeps the old shell until the user accepts.
530. **Rollback-safe SW** — keep the previous SW version loadable by publishing a one-line `sw-kill.js` switch that unregisters and clears caches; done when a staging drill using the kill switch returns a tab to network-only operation.
531. **Handle navigation preload** — enable `navigationPreload` for network-first routes to cut cold-start delay; done when a trace shows the preload response used and a test confirms offline still works.
532. **Background Sync for queued events** — queue feedback and reports (no PII) in IndexedDB and replay through Background Sync where supported, with a visible "Will send when online" state; done when an offline submission is delivered after reconnect in Chromium and the page shows the queue emptied.
533. **Fallback queue replay for browsers without Background Sync** — replay on `online` event and next page load (Safari, Firefox); done when the same e2e passes with the Background Sync API stubbed out.
534. **Dedupe and expire queued events** — assign idempotency keys, drop events older than a set age and cap queue length; done when a unit test shows duplicates collapsed and old events dropped.
535. **Request persistent storage at the right moment** — call `navigator.storage.persist()` only after the user saves a first bundle, with a plain explanation, and record the result; done when e2e shows no prompt on first visit and a request after the first save.
536. **Quota and eviction handling** — catch QuotaExceededError on put, free the lowest-priority cache first (media before shell) and tell the user; done when a test with a tiny quota produces the message and the shell stays cached.
537. **SW error telemetry hooks** — wrap fetch handler failures and report counts via the consented error channel with no URLs containing user data; done when a forced SW exception appears in the test sink with only route type and error name.

## Performance: measurement and budgets

538. **Set up consented field RUM** — collect LCP, INP, CLS, TTFB via web-vitals with an opt-in banner, no cookies, no IP storage, to a small endpoint; done when nothing is sent before consent in a network-log test and a consented visit produces one beacon. [needs-decision]
539. **Pick a RUM sink within budget** — compare a free-tier worker plus KV/D1 on Cloudflare against self-hosted counters, with a monthly cost estimate; done when the choice is recorded and cost is within the Rs 1,000 cap. [needs-decision]
540. **Segment vitals by page type** — tag beacons with route, story, discover, explore, app and offline pages, plus device class and connection type; done when the report groups p75 per page type with sample count shown beside each figure.
541. **Show sample sizes beside every field metric** — dashboards hide any percentile built from fewer than a stated minimum of visits; done when a table with too few samples renders "not enough data" instead of a number.
542. **Record a lab baseline per page type** — run Lighthouse and the existing perf.cjs on each template under one fixed profile and commit the raw JSON; done when the baseline files exist and cite tool version and date.
543. **Define a low-end Android throttled profile** — Playwright/Chromium with 4x or 6x CPU slowdown and Slow 4G, documented as an approximation; done when the profile is a reusable script and its readme says it is not a substitute for real devices.
544. **Add a 3G profile run** — a separate emulated 3G test of the home, one route and one story reporting LCP, total bytes and first interaction; done when the CI job publishes those numbers as an artifact.
545. **Run field verification on real low-end phones** — measure the same pages on two or three actual budget Android phones over mobile data and compare with the emulated profile; done when the gap between emulated and real is written down. [needs-devices]
546. **Set an image budget per template** — maximum bytes for above-the-fold images and total image bytes per page, chosen after measuring the current pages; done when a build check fails over budget and lists the offending files.
547. **Generate AVIF and WebP with fallbacks** — extend scripts/build-photos.py to produce AVIF, WebP and JPEG at defined widths, served with `<picture>`; done when a test shows each photo has three formats and the smallest supported one loads in Chromium.
548. **Add responsive `srcset`/`sizes` correctness test** — check that the declared sizes match layout widths and no image downloads more than 2x its displayed width; done when the Playwright test reports zero oversized images on key pages.
549. **Reserve image space to prevent CLS** — every img has width/height or aspect-ratio; done when a lint over built HTML finds none missing and the CLS in the lab run is recorded.
550. **Font loading and fallback metrics** — subset and preload the one critical font per script, use `font-display: swap` or optional, and set `size-adjust`/`ascent-override` on fallbacks; done when the lab CLS contribution of font swap is recorded before and after.
551. **JS budget with a CI gate** — set maximum gzipped JS per page type from the current measured values minus a margin, enforced by a size check script; done when a deliberately added 20 KB module fails the check.
552. **Code-split by route and by feature** — load map, audio player, offline manager and search only on the pages that use them via dynamic import; done when the home page network log shows none of those modules.
553. **Preload and priority hints** — preload the LCP image and critical font, add `fetchpriority="high"` to the LCP image only, and `loading="lazy"` below the fold; done when each template's LCP element is identified in a trace and has the right hints.
554. **INP investigation on interactive pages** — record interactions (filter, search, map pan, play audio) with the Performance panel under the throttled profile and log the slowest handler; done when the top three long tasks have tickets with trace files attached.

## Hosting, caching headers and CDN

555. **Document GitHub Pages header limits** — record that Pages sets its own Cache-Control (short max-age) and does not allow custom headers or immutable asset caching; done when docs/ lists observed headers from a live `curl -I` for HTML, JS, image and font.
556. **Adopt content-hashed filenames for static assets** — emit `app.<hash>.js` and `img.<hash>.avif` in build-site.mjs so staleness is solved by name even without long max-age; done when two builds with no changes produce identical names and a changed file gets a new name.
557. **Use the SW as the long-cache layer** — since headers cannot be set, cache hashed assets cache-first in the SW and verify they refresh on deploy; done when an e2e test shows a second visit makes zero network requests for hashed assets.
558. **Evaluate Cloudflare in front of Pages** — free-plan proxy for headers, Brotli, caching rules and HTTP/3, with DNS and CNAME impact written out; done when a staging domain test shows immutable headers on hashed assets and the memo lists risks. [needs-decision]
559. **Cloudflare Transform Rules for security and cache headers** — set Cache-Control, CSP, Referrer-Policy and Permissions-Policy at the edge; done when securityheaders-style scan on staging shows them present and the site still passes the full e2e suite. [needs-decision]
560. **Compare alternatives to Cloudflare** — Netlify, Vercel or Cloudflare Pages as the host, with migration steps and what is lost (Pages preview URL, CNAME); done when the memo scores each against cost, header control and rollback ease. [needs-decision]
561. **Add a cache-header regression check** — a script fetches the live site's key URLs and compares headers to the expected table, run weekly; done when a changed header opens an issue automatically.

## Accessibility audit and engineering (WCAG 2.2 AA)

562. **Write a per-page-type WCAG 2.2 AA audit sheet** — one row per success criterion for home, discover, explore, route, story, creators, app and offline pages with pass/fail/NA and evidence; done when every cell is filled and each fail has a ticket.
563. **Add axe-core to Playwright for every template** — run axe on each built page type in default, dark, zoomed and forced-colors states; done when CI fails on any serious or critical violation.
564. **Write keyboard maps per page type** — document tab order, shortcuts, and expected focus for home, route, map, audio player and offline manager; done when a Playwright test walks each map and asserts the focus sequence.
565. **Remove keyboard traps** — verify map, dialogs, audio controls and carousels can be entered and exited with keyboard alone; done when automated tab-through finds no element where Tab or Esc fails to escape.
566. **Visible, high-contrast focus indicators** — define one focus style with at least 3:1 against adjacent colours and not clipped by overflow; done when a visual snapshot of focus on every interactive component type passes the contrast check.
567. **Focus management on route navigation and dialogs** — move focus to the page heading after client navigation and return it to the trigger when a dialog closes; done when e2e asserts document.activeElement in each case.
568. **Add skip links and landmark structure** — one main, labelled nav regions, skip to main and to route content; done when axe landmark rules pass and a screen-reader script confirms the landmarks list.
569. **Live regions for async status** — use polite regions for offline save progress, queue sent, search result counts and errors, with assertive only for failures; done when a test captures the live-region text for each event.
570. **Colour contrast on text over photos** — add scrim or text-shadow tokens and compute contrast against the worst-case pixels in the text region of each hero image at build time; done when the build lists any hero below 4.5:1 and fails on it.
571. **Test zoom at 200% and 400% and reflow at 320 CSS px** — no horizontal scroll, no clipped controls, no overlapping fixed bars; done when Playwright at 320 px width and 400% equivalent passes on every template.
572. **Support text-spacing overrides** — apply the WCAG text-spacing bookmarklet values and check nothing is clipped; done when a test injecting those styles shows no overflow or hidden text.
573. **Forced colors and high-contrast mode** — use system colours and `forced-colors` media query for borders, icons and focus; done when Playwright with `forcedColors: 'active'` screenshots show all controls distinguishable.
574. **Honour prefers-reduced-motion everywhere** — remove parallax, autoplay and smooth-scroll, and make sure map fly-to animations stop; done when a test with reduced motion finds zero running CSS animations over 5 s duration.
575. **Target size and spacing (2.5.8)** — every pointer target is at least 24x24 CSS px or has spacing, with 44 px for primary controls on mobile; done when an automated bounding-box test lists no undersized targets.
576. **Dragging alternatives (2.5.7)** — every map pan, slider or reorder interaction has a button or keyboard equivalent; done when a keyboard-only e2e completes each task.
577. **Accessible map alternative** — provide a text list of stops with distances and directions next to the map and make map controls labelled; done when the route page can be fully understood and used with the map hidden.
578. **Consistent help and accessible authentication checks (3.2.6, 3.3.8)** — verify help/contact appears in the same place and no cognitive tests exist in any flow; done when the audit sheet marks both criteria with evidence.

## Accessibility: assistive tech, audio and readable content

579. **Write screen-reader test scripts** — step-by-step scripts for NVDA+Firefox/Chrome, VoiceOver+Safari (macOS and iOS) and TalkBack+Chrome covering home, find a route, read a story, play audio, save offline; done when each script has expected announcements and one run is logged per reader. [needs-devices]
580. **Run the scripts and log defects** — execute every script on real software, record what was announced and file issues with severity; done when a results table exists with date, version and pass/fail per step. [needs-devices]
581. **Provide captions or transcripts for all audio** — a transcript on the page for every audio clip with speaker labels and sound cues, synced captions if video appears; done when a build check fails if an audio element has no transcript link.
582. **Transcript quality check** — a second person reads a sample of transcripts against the audio and logs errors; done when sample error rate is recorded and anything above the agreed threshold is corrected. [needs-decision]
583. **Plain-language pass on core UI and route text** — rewrite interface strings and route summaries to short sentences and common words, and keep a style note; done when a readability tool reports a grade level for each page type and the numbers are recorded as a baseline.
584. **Dyslexia-friendly reading option** — a user setting for wider spacing, left-aligned text, no justified or italic blocks and an open-licensed dyslexia-friendly font, stored locally; done when toggling it changes computed styles and persists across reload. [needs-decision]
585. **Reading preferences panel** — text size, line height, theme (light/dark/high contrast) and motion setting in one accessible dialog; done when each setting works by keyboard and survives navigation.

## Internationalisation QA

586. **Script font coverage test** — render a sample of every supported script (Devanagari, Bengali, Tamil, Telugu, Kannada, Malayalam, Gujarati, Gurmukhi, Odia, Urdu) and fail on tofu boxes; done when a Playwright check finds no missing glyphs on the sample page.
587. **Line-breaking and conjunct rendering checks** — test long words, ZWJ/ZWNJ and conjuncts do not break mid-cluster at narrow widths and set `lang` correctly; done when screenshots at 320 px for each script are reviewed and logged.
588. **Numerals policy** — decide Latin versus native digits per language and format distances, dates and times with `Intl`; done when a unit test shows consistent output per locale and the decision is recorded. [needs-decision]
589. **Native-speaker review of UI strings** — one reviewer per language checks truncation, tone and meaning in context; done when each language has a signed-off checklist. [needs-decision]
590. **Pseudo-localisation test** — expand strings 40% and add accents to find overflow and hard-coded text; done when the pseudo build shows no clipped controls on key pages.
591. **Directionality and font-weight checks for Urdu** — verify RTL layout, mirrored icons, punctuation and mixed-direction text with English place names; done when a RTL Playwright pass shows no overlaps and logical CSS properties are used.

## Testing: automated

592. **Test pyramid document** — state what belongs in the 110 node tests, integration checks and ~107 Playwright tests, with a target ratio and run times; done when docs/ lists each layer's scope and current counts taken from a run.
593. **Property tests for URL helpers** — use fast-check to verify slug/URL round-trips, no double slashes, idempotent normalisation and that every generated URL resolves in the build; done when the property tests run in verify.sh with a recorded seed on failure.
594. **Visual regression with Playwright snapshots** — baseline screenshots for each template at mobile, tablet and desktop in light and dark, with masked dynamic regions; done when a CSS change causes a reviewable diff and an unchanged build passes twice.
595. **Mutation testing on core modules** — run Stryker on URL helpers, bundle manifest logic and queue code and record the survival rate; done when surviving mutants have tickets or new tests and the score is committed.
596. **Flaky-test policy** — a test failing then passing on retry gets quarantined within one day with an owner and an issue, and retries are capped at one; done when CI reports retried tests in the summary and the policy is in docs/.
597. **Lighthouse CI with budgets** — assert performance, accessibility and best-practice scores and numeric budgets for LCP, CLS, bytes and JS using values from the committed baseline; done when a regression PR fails the Lighthouse step.
598. **E2E for offline scenarios** — tests for save bundle, go offline, reload, play audio, delete bundle, update flow and quota failure using Playwright `context.setOffline`; done when all six pass and are part of verify.sh.
599. **Cross-browser Playwright projects** — add WebKit and Firefox to the config for the smoke set, since PWA and SW behaviour differ; done when the smoke set runs green on all three engines in CI.
600. **Service worker upgrade test** — install a previous release's SW fixture, then load the new build and confirm migration, saved bundles and update prompt; done when this passes from v12 and v13 fixtures.
601. **Link and asset integrity checker** — crawl the built site for broken internal links, missing images, wrong hashes and orphan files; done when the crawler exits non-zero on a planted broken link.
602. **Test the practical-facts linter on its own** — fixtures of good and bad facts so the linter's rules do not silently regress; done when each rule has a failing and a passing fixture.
603. **Coverage for scripts and SW** — measure node coverage for scripts/ and sw.js logic split into testable modules and publish the figure with the commit; done when the coverage number is recorded without a target claimed before it is measured.

## User research, usability and device lab

604. **Real-device lab plan** — list the target devices (low-end Android on Chrome, a recent Android, an older iPhone on Safari, a mid laptop), OS versions, and test frequency; done when the plan names each device slot and the test script to run on it. [needs-devices]
605. **Acquire the minimum device set** — borrow or buy two budget Android phones and use one iPhone from a volunteer within the budget; done when each device has an inventory row and a successful smoke run. [needs-budget]
606. **Remote device-farm trial** — try a free tier or short paid session on BrowserStack or similar for WebKit/Android checks; done when one run's results are saved and cost is logged against the cap. [needs-budget]
607. **Accessibility user testing with disabled users** — recruit and pay screen-reader, low-vision, keyboard-only, and cognitive-disability participants for task sessions on the core flows, with consent and anonymised notes; done when each participant group has at least one session report with issues ranked. [needs-budget]
608. **Field usability tests for first-time visitors** — observe first-time visitors on their own phones at a real heritage site for the tasks "find a walk near me", "start it", "save it offline", with no coaching; done when task completion and stuck points are recorded for each participant and top issues become tickets. [needs-devices]
609. **Test on poor connectivity in the field** — repeat the offline save and play flow at a site with weak signal and record what failed; done when the field notes list each failure with a linked issue.

## CI/CD and supply chain

610. **Required checks on main** — branch protection requiring verify (build twice, node tests), Playwright, axe, Lighthouse CI and secret scan to pass before merge; done when a PR with a failing check cannot be merged.
611. **Preview deploys for every PR** — build to a per-PR preview (Pages artifact, Cloudflare Pages or similar) and comment the URL; done when a PR shows a working preview link that the e2e smoke tests can target.
612. **Documented rollback procedure** — revert commit plus SW kill-switch steps with a timed drill; done when one rehearsal is logged with elapsed time and result.
613. **Automated release notes** — generate notes from merged PR titles and labels with user-facing changes separated from internal ones; done when a tagged release produces a notes file without manual editing.
614. **Pin dependencies and Actions by digest** — lockfiles committed, GitHub Actions pinned to commit SHAs, Playwright version pinned; done when a check fails on any unpinned `uses:` reference.
615. **Dependency update policy** — Dependabot or Renovate weekly grouped PRs, security fixes within a stated window, all gated by the required checks; done when the config is committed and a test update PR runs the full suite.
616. **Secret scanning and push protection** — enable GitHub secret scanning and a gitleaks run in CI, including a pre-commit hook; done when a planted fake token is blocked in a test PR.
617. **Supply-chain check for installed skills and MCP servers** — review skills-lock.json entries and any MCP config, pin sources to commit hashes, and diff on every change; done when CI fails if a skill file changes without a matching lockfile hash and a written review note.

## Observability and operations

618. **Error reporting without PII** — capture window.onerror and unhandledrejection with message, route type, app version and browser class, stripping query strings and any free text; done when a test error appears in the sink and a scan finds no URL parameters or user text.
619. **Choose an error sink within budget** — compare a tiny self-run endpoint and a free tier of a hosted tool with retention and data-location notes; done when the choice and its monthly cost are recorded. [needs-decision]
620. **Sourcemaps kept private** — upload sourcemaps to the error tool only and exclude them from the published site; done when a built-output check finds no `.map` files and a test error symbolicates in the tool.
621. **Uptime checks** — a free monitor probing home, one route, one story, sitemap.xml and sw.js every few minutes, with alerts to email; done when a deliberate 404 on a staging path triggers an alert.
622. **Synthetic monitoring of key journeys** — a scheduled Playwright run against production for load, search, open route, play audio and the offline manifest fetch, results stored as artifacts; done when a failure opens an issue automatically.
623. **Public status page** — a static page showing monitor state and incidents with plain-language updates, hosted separately from the main site; done when it stays reachable with the main site's Pages deployment disabled in a drill. [needs-decision]
624. **Alert routing and on-call note** — define who is told, by what channel, and response targets for outage, bad deploy and broken offline bundles; done when a test alert reaches the named owner and the runbook exists.
625. **Incident review template and monthly health report** — blameless template plus a monthly note combining uptime, error counts, field vitals with sample sizes and a11y open issues; done when the first report is published using real data and states clearly where data is missing.

# Naarad backend roadmap, items 626-750


## Architecture decisions and environments

626. **Write ADR-0001 for Supabase as the backend** — records why Supabase Mumbai (Postgres+PostGIS, Auth, Storage, Edge Functions) over self-hosting, with the exit path (plain pg_dump plus S3-compatible objects); done when ops/adr/0001-supabase.md exists with Context, Decision, Consequences, Exit sections and a CI check fails if any ADR lacks them.
627. **Write ADR-0002 for migrations as the only schema path** — forbids dashboard edits, requires numbered up and down files like 0001; done when a script diffing a fresh-migrated schema against a schema dump of the target fails on drift in a local test.
628. **Write ADR-0003 for dormant-by-default flags** — every backend-touching feature ships off, flag key under naarad.flag.*, with removal criteria; done when a test loads every page with all flags unset and asserts zero requests to the Supabase host.
629. **Write ADR-0004 for data residency and personal-data inventory** — lists voice recordings, phone numbers, emails, journey locations as personal data with table, bucket and retention for each; done when every personal-data column carries a SQL comment tag pii and a test fails on an untagged new column in the inventory.
630. **Define three environments with a config matrix** — local (initdb Postgres), staging, prod with distinct project URL, anon key, bucket names and flag defaults in ops/env/matrix.md; done when app/config.js selects values by hostname and a unit test proves prod keys never load on localhost.
631. **Create a local environment bootstrap script** — supabase/dev/up.mjs runs initdb into a temp dir, starts postgres on a free port, applies all migrations via apply.mjs and seeds; done when one command yields a migrated database and one command tears it down leaving no processes.
632. **Add an environment promotion rule** — a migration reaches prod only after passing local tests and staging apply with a logged check; done when the applier refuses a prod target unless a staging-applied marker for the same file hash exists in the ledger [needs-decision].

## Project layout and migrations tooling

633. **Fix the backend directory layout** — supabase/{migrations,migrations/down,functions,seed,test,dev,openapi} with a README of ownership; done when a layout test fails on files outside the allowed tree.
634. **Add a migration naming and header lint** — each NNNN_name.sql needs a header comment (purpose, reversible yes/no, locks taken) and a matching down file; done when the lint fails on a missing down file or gap in numbering.
635. **Add a migration checksum ledger** — apply.mjs records file sha256 in a schema_migrations table and refuses to run if an applied file was edited; done when a test edits 0001 after apply and the applier exits non-zero naming the file.
636. **Add a dry-run mode to the applier** — prints ordered statements and lock levels and runs inside a transaction that is rolled back; done when a test shows zero catalog changes after dry-run on the local database.
637. **Add a lock-timeout and statement-timeout guard** — every migration runs with lock_timeout 5s and statement_timeout 60s set by the applier; done when a test holding a conflicting lock makes the migration fail fast and leave the database unchanged.
638. **Add round-trip tests for every new migration** — up, down, up again must produce identical schema dumps; done when the test harness iterates all numbered files and 0001 passes it.
639. **Write the expand-then-contract migration playbook** — column renames and type changes happen as add, backfill, switch, drop across separate releases; done when the playbook has a worked example executed in a local test with a running reader that never errors.
640. **Add a destructive-migration gate** — any migration containing drop table, drop column or truncate needs a -- destructive-ok: reason line and a prior backup record; done when the lint rejects the statement without that line [needs-decision].

## Schema design: profiles, roles and RLS

641. **Design the roles model** — enum app_role (viewer, creator, editor, moderator, admin) in a user_roles table with granted_by and granted_at, never stored in client-editable profile fields; done when a test shows a user cannot insert or update their own role row.
642. **Add helper functions has_role and is_staff** — security definer with fixed search_path, used by all policies; done when a test confirms the functions ignore JWT user_metadata and read only user_roles.
643. **Extend profiles for 18+ attestation** — adds adult_confirmed_at, display_name, locale, consent versions as columns with check constraints; done when inserting a profile without adult_confirmed_at is rejected for creator role upgrades.
644. **Add a consent ledger table** — consents(user_id, purpose, version, granted_at, withdrawn_at) with purposes account, recording_publish, training_use as separate optional rows; done when a test shows withdrawing training_use leaves the other consents intact.
645. **Write RLS policies for every new table before data code** — default deny, one policy per command, no using (true); done when a catalog query lists any public table without RLS enabled and the test suite fails on it.
646. **Build a pgTAP-style assertion helper in plain SQL** — ok(), is(), throws_ok() functions in a test schema that print TAP lines; done when the runner parses the TAP output and fails on any not-ok without needing the pgTAP extension.
647. **Write an RLS matrix test** — for each table and each of five roles plus anon, assert select, insert, update, delete outcomes against an expected table in a JSON file; done when changing any policy without updating the matrix fails the test.
648. **Test privilege escalation paths** — attempts via update on profiles, calling security definer functions, and forged JWT claim settings through set_config; done when all attempts fail and the test is part of the default suite.
649. **Add soft-delete columns and partial indexes** — deleted_at on user-owned content with unique indexes where deleted_at is null; done when a test re-creates a slug after soft-delete without a unique violation.
650. **Define a stable identifier scheme** — uuid primary keys plus human slugs for routes, slug history table for redirects; done when renaming a slug keeps the old URL resolving through the history table in a test.

## Auth and sessions

651. **Specify the Google sign-in flow** — Supabase OAuth with PKCE, redirect allow-list for the Pages origin and localhost, scopes email and profile only; done when the redirect allow-list is documented and a mock-based test rejects a non-listed redirect [needs-owner-account].
652. **Write the Google OAuth setup checklist** — Google Cloud project, consent screen, client id and secret entered in Supabase, authorised redirect URI; done when the runbook lists each field with the owner as actor and what to paste where, without any secret in the repo [needs-owner-account].
653. **Design phone OTP through MSG91 behind a provider interface** — sendOtp and verifyOtp adapter with a fake provider for tests; done when switching the adapter in config changes no calling code and the fake passes the same contract suite.
654. **List the DLT prerequisites for MSG91** — entity registration, sender id, OTP template approval, MSG91 auth key; done when the runbook names each item, who applies, and the feature stays flagged off until all are checked [needs-owner-account].
655. **Decide OTP abuse limits** — per-number and per-IP send caps, cooldown between sends, 5 attempts per code, 10 minute expiry; done when the limits are an ADR and the fake-provider test shows the sixth attempt locked out [needs-decision].
656. **Define session lifetime and refresh policy** — short access token, rotating refresh token with reuse detection, sign-out-everywhere action; done when a mock test shows a reused refresh token revokes the family.
657. **Add a role-claim refresh mechanism** — role changes take effect within the access token lifetime via a hook or forced refresh; done when a test demoting a moderator makes their next policy check fail.
658. **Enforce 18+ gate at sign-up** — attestation checkbox recorded server-side before a profile is marked active, with under-18 path that creates no profile; done when a test submitting without attestation yields a typed error and no row.

## Journey sync (offline-first, last-write-wins)

659. **Design the journey_entries table** — id, user_id, route_id, stop_id, payload jsonb, client_updated_at, server_updated_at, deleted_at, device_id; done when migration 0002 with matching down passes round-trip and RLS matrix tests.
660. **Specify last-write-wins with server clock tiebreak** — compare client_updated_at, fall back to server_updated_at, clamp client clocks more than 24 h in the future; done when a property test of random orderings converges to the same final state on all replicas.
661. **Implement tombstones** — deletes set deleted_at and keep the row for 90 days before a purge job; done when a deleted entry never reappears after sync from a stale device in a test.
662. **Define the push and pull endpoints** — pull since a server cursor, push batch with per-item results (applied, ignored-stale, rejected); done when the contract test covers a batch with all three outcomes.
663. **Write conflict rules per field class** — scalar fields LWW, set-like fields (visited stops) merged by union with tombstones, notes LWW with a conflict copy kept; done when a test matrix of two-device edits matches the documented outcome table.
664. **Build the offline queue in app/journey-store.js** — persisted queue of mutations with ids, replay in order, exponential backoff with jitter; done when a test dropping connectivity mid-batch resumes without duplicating entries.
665. **Make sync idempotent by mutation id** — a mutations_applied table keyed by (user_id, mutation_id); done when replaying the same batch twice changes nothing and returns the same results.
666. **Add first-sign-in merge of on-device journey** — local journey is uploaded once with explicit user consent, never silently; done when declining leaves server empty and local intact in a test.
667. **Cap per-user journey size** — row-count and payload-byte limits enforced by a trigger with a typed error; done when exceeding the cap returns quota_exceeded and the client shows the toast.

## Studio drafts, publications and versioning

668. **Extend creator_submissions to full drafts** — adds body jsonb, schema_version, base_version and autosave timestamps while keeping 0001 guard semantics; done when migration 0003 up and down pass and the guard test for status transitions still passes.
669. **Define the draft state machine** — draft to submitted to approved or rejected, with rejected back to draft and approved read-only; done when a transition table test rejects every illegal edge via the guard trigger.
670. **Sync Studio drafts with optimistic concurrency** — updates carry base_version and fail with 409 version_conflict on mismatch; done when two simultaneous saves produce one success and one conflict payload containing the server copy.
671. **Keep draft revision history** — submission_revisions table written by trigger, last 20 kept per draft; done when editing a draft 25 times leaves exactly 20 revisions.
672. **Model publications separately from drafts** — publications(id, route_id, version, content jsonb, approved_by, approved_at) immutable once written; done when update and delete on a publication row fail for every role including admin.
673. **Version published content** — monotonic integer per route with a current pointer and a rollback action creating a new version copying an older one; done when rollback yields version N+1 with N-1 content in a test.
674. **Validate draft content against the same schema as the static site** — share a JSON Schema file between Studio and the build; done when a draft failing the schema cannot be submitted and the error lists JSON pointers.
675. **Block submission without consent and attestation** — submit requires adult_confirmed_at and a current creator terms consent; done when a test lacking either returns precondition_failed with the missing item named.

## Recordings and Storage

676. **Create buckets with explicit policies** — recordings-private, recordings-published, drafts-media, each with RLS on storage.objects scoped by path prefix user_id; done when a test shows user A cannot list or read user B's prefix.
677. **Design signed upload URL issuance** — an edge function validates quota, declared MIME, declared size, then returns a single-use signed URL valid 5 minutes; done when a mock test shows an expired or reused URL is refused.
678. **Enforce the 90 second duration limit** — client pre-check plus server-side probe of the uploaded file header in the pipeline, rejecting longer files; done when a 91 s fixture is rejected with recording_too_long and an 89 s fixture passes.
679. **Enforce size and MIME allow-list** — audio/webm, audio/mp4, audio/mpeg, audio/wav only, max bytes derived from 90 s at the highest allowed bitrate, magic-byte sniffing not trusting the header; done when a renamed executable with an audio extension is quarantined.
680. **Add a malware scan stage** — uploads land in a quarantine prefix and move to private only after a scan result is recorded; done when a test with the EICAR string stays in quarantine and the recording is marked rejected [needs-decision].
681. **Define recording retention** — unpublished recordings deleted 180 days after last activity, rejected ones after 30 days, with a reminder before deletion; done when a clock-injected test of the retention job deletes only eligible objects and their rows.
682. **Handle erasure of recordings on consent withdrawal** — withdrawing recording_publish unpublishes and deletes the object, withdrawing training_use removes it from any training manifest; done when a test confirms no manifest references the recording afterward.
683. **Keep a recording manifest table** — recordings(id, owner, object_path, duration_ms, bytes, sha256, mime, state, created_at); done when the sha256 uniqueness constraint detects a duplicate upload.
684. **Use signed read URLs with short expiry for playback of unpublished audio** — owner and staff only, 60 second expiry, published audio via public path; done when a leaked URL stops working after expiry in a clock-controlled test.

## Pipeline state machine, jobs and webhooks

685. **Design the jobs table** — id, kind, payload, state, attempts, max_attempts, run_at, locked_by, locked_until, last_error, idempotency_key; done when migration 0004 round-trips and a unique index on idempotency_key exists.
686. **Specify the job states** — queued, running, succeeded, failed, dead with allowed transitions enforced by function not by clients; done when a test shows clients cannot update jobs directly.
687. **Claim jobs safely with SKIP LOCKED** — a claim_jobs function leasing rows for 60 seconds; done when two concurrent workers in a local test never process the same job.
688. **Add retry with exponential backoff and jitter** — delays 10 s, 1 min, 10 min, capped, max 5 attempts; done when a failing handler is retried on the computed schedule using an injected clock.
689. **Add a dead-letter table and replay action** — dead jobs copy to dead_jobs with last error and an admin-only requeue function; done when requeue creates a fresh job with a link to the dead one and writes an audit row.
690. **Make handlers idempotent by contract** — each handler takes an idempotency key and has a test running it twice; done when the double-run test passes for transcode, scan and publish handlers.
691. **Define the recording pipeline stages** — uploaded, scanned, probed, transcoded, ready or rejected, each stage a job kind; done when a mock end-to-end test walks a fixture through all stages and a poisoned fixture ends in rejected.
692. **Sign outbound webhooks with HMAC-SHA256** — header carries timestamp and signature over timestamp.body, 5 minute tolerance, secret per endpoint with rotation overlap; done when verification tests reject tampered body, stale timestamp and old secret after overlap.
693. **Verify inbound provider webhooks and dedupe** — constant-time signature compare, event id stored for replay protection; done when a replayed event id is acknowledged without side effects [needs-owner-account].

## Edge functions and background jobs

694. **Write the edge function design rules** — 150 s wall and 2 s CPU budgets, no long loops, offload to jobs and return 202; done when a lint script flags handlers that await more than one external call without a timeout.
695. **Add a shared function kit** — request id, auth parse, error mapper, JSON logging, timeout wrapper in supabase/functions/_shared; done when every function imports it and a test shows the error mapper emits the standard error envelope.
696. **Add per-call timeouts and abort signals** — external calls capped at 20 s with AbortController; done when a mock hanging provider returns upstream_timeout in under 21 s.
697. **Run functions locally under Deno-compatible tests with mock Supabase** — a small fake client implementing the methods used; done when the contract suite runs offline and fails if a function calls an unmocked method.
698. **Schedule recurring work with pg_cron or an external trigger** — retention purge, tombstone purge, stale-lease release, daily cost check; done when each schedule is a row in a documented table and a test invokes each task function directly.
699. **Define a provider abstraction for email and SMS** — Notifier interface with email and sms channels, templates keyed by name and locale, fake and real adapters; done when a test swaps adapters and the template renderer rejects a missing variable.

## Moderation, audit, abuse and rate limits

700. **Build the moderation queue table and view** — queue ordered by submitted_at with claim, release and decision actions, one moderator per item at a time; done when two moderators claiming the same item yields one success.
701. **Record every moderation decision with a reason code** — approved, rejected_unsafe, rejected_inaccurate, rejected_copyright, needs_changes plus free text shown to the creator; done when a decision without a reason code is refused.
702. **Add an append-only audit log** — audit_log(actor, action, target, before, after, at, request_id) with insert-only policy and update/delete revoked; done when an admin trying to alter a row fails and the log is retained 1 year or more.
703. **Add a reports table for user reports** — reports(reporter, target_type, target_id, reason, state) with one open report per reporter and target; done when a duplicate open report returns already_reported.
704. **Write abuse handling procedures** — takedown within a documented window, repeat-infringer handling, appeal path; done when ops/abuse-procedure.md maps each report reason to an action and SLA and the owner has signed off [needs-decision].
705. **Implement database-level rate limiting** — token bucket table keyed by (subject, action) with a consume function called by functions; done when a test shows the 11th call in a minute is refused with retry_after.
706. **Set per-action limits** — sign-up, OTP send, upload URL, submission, report, search each with a documented limit; done when the limits live in one config file read by both tests and functions.
707. **Add a user suspension flow** — suspended flag blocks writes via RLS while allowing export and deletion; done when a suspended user can still request erasure but cannot insert drafts.
708. **Log breach-relevant events for the 72 hour report** — failed-auth spikes, role grants, bulk reads by staff go to a security_events table; done when a runbook query lists events for a time window in under a minute locally.

## API design, errors and pagination

709. **Choose PostgREST tables versus RPC functions per use case** — tables for simple owner CRUD, RPC for multi-step actions, written as an ADR table; done when every endpoint in the OpenAPI file is tagged rest or rpc.
710. **Write the OpenAPI 3.1 spec for custom endpoints** — journey sync, upload URL, submit, report, export request; done when the spec validates with a local linter script and every example passes JSON Schema validation.
711. **Define the error envelope** — {error:{code, message, details, request_id}} with a fixed code vocabulary and HTTP mapping; done when a test asserts every function error path emits a code from the list.
712. **Use keyset pagination** — cursor encodes (sort key, id), limit default 20 max 100, next_cursor null at end; done when paging through 1,000 seeded rows with concurrent inserts yields no duplicates or gaps.
713. **Version the API in the path** — /v1 for functions with a deprecation header policy and 6 month overlap; done when a test shows v1 responses carry the version header and a stub v2 routes separately.
714. **Define the idempotency header for create endpoints** — Idempotency-Key stored 24 hours with the response; done when a repeated create returns the original response and one row.

## Search, caching and static export

715. **Create the search index with Postgres FTS** — tsvector over title, place, tags with an Indian-English config and a unaccent step, GIN index; done when seeded routes are found by partial and misspelt queries in a ranked-result test.
716. **Add trigram fuzzy matching** — pg_trgm similarity fallback when FTS returns fewer than 3 results; done when the query "mehrangadh" returns Mehrangarh fixtures in the test.
717. **Add PostGIS bbox and nearby queries** — geography column, GiST index, functions routes_in_bbox and routes_near(lat, lon, radius_m) capped at 50 km; done when results match a hand-computed set for fixture coordinates.
718. **Cap search cost** — statement timeout 3 s, query length limit 100 characters, result limit 50; done when an oversize query returns a typed error without scanning.
719. **Define cache headers and a cache-or-not table** — public published content gets max-age plus stale-while-revalidate, user data is no-store; done when a test asserts headers per endpoint class.
720. **Export approved content into the static site** — a script reads current publications, writes JSON and pages into the repo content directory and opens a commit for owner review; done when running it twice produces an identical tree and the output validates against the site schema.
721. **Gate the export on moderator approval and a content hash** — only publications with approved_at and matching sha256 are exported; done when tampering with a row after approval excludes it and prints why.
722. **Add a stale-check between database and static site** — a report listing publications whose exported version lags the current one; done when bumping a version locally makes the report non-empty.

## Privacy, backups, recovery and cost

723. **Build the user data export** — an async job producing a zip of profile, consents, journey, drafts and recording metadata as JSON, link expiring in 48 hours; done when a seeded user's export contains every table tagged pii and nothing of other users.
724. **Extend delete_my_account to cover new tables and Storage** — one function plus a pipeline job removing objects, with a completion receipt row; done when the erasure test finds zero rows or objects for the user across all pii-tagged tables and buckets.
725. **Write a data-retention schedule** — a table of data class, retention, legal basis and purge job, logs kept at least 1 year; done when each purge job references a row in the schedule and a test fails on an orphan job.
726. **Write the grievance and breach procedure** — contact point response within 90 days, 72 hour breach report steps, who to notify; done when ops/privacy-procedure.md has a dated drill checklist and the owner confirms the contact address [needs-decision].
727. **Plan backups and PITR** — document the plan tier needed for PITR, a weekly logical pg_dump kept outside Supabase, and a restore test cadence; done when the runbook states what the free tier does and does not provide and the owner picks a tier [needs-decision].
728. **Script a restore drill** — restore a dump into a fresh local database and run the migration and RLS suites against it; done when the drill script exits 0 and prints row counts matching the source.
729. **Write the disaster recovery plan** — RTO and RPO targets stated as proposals, region loss steps, DNS and config switch, communication note; done when targets are marked unmeasured and a tabletop checklist exists.
730. **Build a cost guard against the Rs 1,000 cap** — a ledger of planned monthly costs per service, a daily usage-check job, hard stop flags that disable uploads at 80% of cap; done when a simulated usage input at 80% flips the upload flag off and writes an alert row.

## Seed data and test strategy

731. **Create deterministic seed data** — 5 users across roles, 12 routes with stops, journeys, drafts in every state, fixed UUIDs and timestamps, no real personal data; done when seeding twice yields identical dumps.
732. **Create fixture audio files** — tiny generated tones at 5 s, 89 s, 91 s and a bad-header file produced by a script, not downloaded; done when the fixtures are rebuilt byte-identically from the script.
733. **Run the whole suite from one command** — npm test in supabase/ runs lint, migrations round-trip, RLS matrix, function contract tests and OpenAPI validation; done when a clean checkout passes it offline.
734. **Write contract tests against a mock Supabase** — recorded request and response shapes for auth, rest and storage used by app/backend.js; done when changing a client call shape without updating the mock fails the test.
735. **Add a mutation check on RLS tests** — a script deliberately weakens each policy in a scratch copy and expects the matrix test to fail; done when every policy mutation is caught.
736. **Write a load test plan with a local harness** — scripted concurrent sync pushes and searches against local Postgres, measuring p50 and p95 and recording the machine used; done when results are reported as local-only and never extrapolated to production.
737. **Add a schema snapshot test** — a committed schema dump compared in CI to a fresh migrate; done when an unlisted column change fails the test.

## Client integration

738. **Add backend feature flags in app/config.js** — flags backend.auth, backend.sync, backend.studio, backend.recordings all default off with a kill switch fetched from a static JSON file; done when a test with all flags off shows no network call and the UI unchanged.
739. **Extend app/backend.js with a typed request wrapper** — attaches token, request id, timeout, maps the error envelope to error classes; done when the contract tests cover 401, 409, 422, 429 and 5xx mapping.
740. **Design the auth UI states** — signed-out, signing-in, code-sent, verifying, signed-in, session-expired, blocked-under-18, offline; done when each state renders in a gallery page and passes a keyboard and screen-reader check.
741. **Add optimistic updates with rollback** — journey and draft edits apply locally, queue to sync, revert and toast on rejection; done when a forced server rejection restores prior state in a test.
742. **Make journey and Studio stores offline-first** — local store remains the source for reads, sync is background with a visible status chip (saved on device, syncing, synced); done when airplane-mode edits survive reload and sync later.
743. **Add a central error toast component** — maps error codes to plain-language messages with retry actions, deduplicates repeats, announced via aria-live; done when a test triggers three identical errors and sees one toast.
744. **Add loading skeletons for account, sync and Studio lists** — shapes match final layout, respect reduced motion, appear only after 200 ms; done when no layout shift is measured in a headless check.
745. **Add a recording upload UI with progress and limits** — shows the 90 s cap while recording, resumable retry, clear rejection reasons; done when a 91 s clip is refused before upload with the right message.
746. **Add an account page for consent, export and deletion** — separate toggle for training use, buttons for export and delete with typed confirmation; done when each action calls the mocked endpoint and the page reflects pending states.

## Deploy runbook

747. **Write the owner-created accounts and secrets list** — Supabase project (Mumbai), Google Cloud OAuth client, MSG91 account with DLT registration, email provider, malware-scan or transcoding host if chosen, domain DNS; done when ops/deploy-runbook.md lists each with who creates it, which secret names result, and where each is stored, with no value committed [needs-owner-account].
748. **Write the first deploy sequence** — create project, set secrets, apply migrations with the safe applier to staging then prod, deploy functions, set flags still off, run the smoke script; done when each step has a command, an expected output and a rollback line.
749. **Write the smoke test script for live verification** — checks health, anon policies, sign-in redirect, upload URL denial for anon, and rate limit headers; done when the script runs fully against the mock and prints a skipped-live list for the owner to run [needs-owner-account].
750. **Define the flag-on sequence and kill rule hook** — turn flags on in order auth, studio, sync, recordings with evidence logged per step, and remove-by rules from F-001 respected; done when the runbook cross-references each flag to a features.json entry and a logged G1 or founder override [needs-decision].

# Part 7 — AI, voice and languages (items 751-875)

Tags: [needs-sarvam] Sarvam connector returns 403, owner must reconnect; [needs-budget] draws on the Rs 1,000 total cloud cap; [needs-decision] owner call; [needs-human-reviewer] native-speaker sign-off.

## Provider abstraction and Sarvam limits
751. **Define a provider interface** — `TranslateProvider`, `TtsProvider`, `SttProvider`, `ChatProvider` as four small contracts in `tools/ai/providers/`, each returning `{result, usage, providerId, modelId}`; done when a mock provider passes the same contract test suite as the Sarvam one.
752. **Encode Sarvam translate limits** — `sarvam-translate:v1`, 22 languages, 2,000-char input cap held in a capability table; done when a 2,001-char unit is rejected before any network call in a unit test. [needs-sarvam]
753. **Encode Bulbul v3 limits** — 2,500-char cap, voice list only for 10 Indian languages plus English, no SSML; done when requesting a voice for an unsupported language throws `NO_VOICE_FOR_LANG` offline.
754. **Strip SSML before TTS** — a sanitiser removes tags and uses punctuation/pauses in text instead; done when no `<` character reaches the Bulbul request body in a recorded-fixture test.
755. **Wire Saaras v4 STT with a duration router** — REST path for clips of 30 s or less, Batch path for clips up to 90 s; done when a 31 s fixture is routed to Batch and a 29 s fixture to REST. [needs-sarvam]
756. **Handle sarvam-105b reasoning-token budgeting** — set `max_tokens` as answer length plus a reasoning reserve and log `finish_reason`; done when a truncated-by-reasoning response is detected and retried once with a larger reserve in a test.
757. **Write a capability matrix doc generated from code** — `docs/ai-capabilities.md` built from the provider tables (languages, caps, voices); done when CI fails if the doc is stale against the tables.
758. **Replace outdated model names in the integration blueprint plan** — list Sarvam-M gone, Saarika v2.5 deprecated, Mayura 11 languages as superseded by sarvam-105b, Saaras v4, sarvam-translate:v1; done when a follow-up PR checklist cites each stale name with its replacement. [needs-decision]
759. **Add a provider health probe** — a one-token chat, 1-char translate and short STT sample run on demand, never on a schedule; done when the probe prints per-endpoint OK/403/timeout and exits non-zero on 403. [needs-sarvam]
760. **Create a 403 runbook** — steps to reconnect the Sarvam connector, rotate the key, re-run the probe, and what pipelines stay frozen meanwhile; done when a person unfamiliar with the repo can follow it to a green probe. [needs-sarvam]

## Fallback LLM and secrets hygiene
761. **Add an optional OpenAI-compatible fallback ChatProvider** — base URL and key read only from env vars (`FALLBACK_LLM_BASE_URL`, `FALLBACK_LLM_API_KEY`); done when the provider refuses to start without both and no default endpoint string exists in the repo.
762. **Add a secret-scan CI gate** — scan for key patterns and endpoint URLs in tracked files and prompts; done when a planted fake key in a test branch fails the job.
763. **Keep keys out of artifacts** — pipeline outputs and logs redact `Authorization` headers and env values; done when a log-redaction test finds zero key substrings in captured output.
764. **Define fallback policy** — fallback used only for chat tasks (cleanup, Q&A drafts), never for Indic translation or TTS, and every output tagged with its provider; done when a fallback-generated file carries `provider` metadata and fails the publish check without it. [needs-decision]
765. **Add a fallback quality bar** — the fallback must pass the golden Q&A set at a threshold chosen by the owner before use; done when the harness prints pass/fail against that threshold for the fallback. [needs-decision]
766. **Document free-tier terms check** — record whether the chosen free endpoint permits retaining prompts and using them for training; done when the registry entry for the fallback has a reviewed terms note and date. [needs-decision]

## Localisation pipeline core
767. **Assign stable unit ids** — each stop narration, title, summary and Q&A gets an id like `stop-<slug>/narration/p03` that survives text edits; done when editing a sentence keeps its id and moving a paragraph changes only its order field.
768. **Chunk by sentence under caps** — split at sentence boundaries to stay under 2,000 chars for translate and 2,500 for TTS, rejoin deterministically; done when a 5,000-char fixture round-trips with no mid-sentence splits.
769. **Cache by source hash** — key is `sha256(sourceText + glossaryVersion + promptVersion + modelId + targetLang)`; done when re-running an unchanged tree makes zero provider calls.
770. **Make runs idempotent** — a crashed run resumed from the same manifest completes without duplicate calls or duplicate files; done when killing the process mid-run and restarting yields byte-identical outputs.
771. **Add `--dry-run`** — prints units to process, chars per endpoint, and cost in rupees using only the published rates (Rs 20/10K chars translate, Rs 30/10K chars Bulbul v3); done when dry-run on the repo makes zero network calls and prints a total.
772. **Implement the budget guard** — a ledger file tracks spend against the Rs 1,000 total cap and blocks any run whose estimate exceeds remaining budget; done when a test with a Rs 5 remaining ledger refuses a larger job. [needs-budget]
773. **Add a first-call check** — the first real call of any run is one smallest unit, its actual usage compared with the estimate before the rest proceed; done when a >25% estimate mismatch aborts the batch in a test. [needs-budget]
774. **Add per-language spend caps** — each language gets a share of the cap so one language cannot consume it; done when the ledger shows per-language remaining and the guard honours it. [needs-decision]
775. **Store outputs as reviewable files** — `i18n/<lang>/<unitId>.json` with `text`, `sourceHash`, `status`, `provider`, `generatedAt`; done when a schema validator passes every file and fails a missing `sourceHash`.
776. **Mark stale translations** — when the English source hash changes, dependent units flip to `stale` and stop shipping until regenerated; done when editing one English sentence marks exactly its units stale in all languages.

## Quality gates and human review
777. **Script-block match gate** — assert the output is dominated by the target script's Unicode block (e.g. Devanagari for hi); done when an English-passthrough fixture fails the gate for hi, ta and kn.
778. **Length-ratio gate** — flag output outside a per-language band of source length, bands calibrated from the first reviewed sample not guessed; done when out-of-band units are tagged `needsReview` with the ratio shown.
779. **Digits-preserved gate** — numerals, years and distances in source must appear in output in either ASCII or the target-script digits; done when a dropped "1010 CE" fails the gate in a test.
780. **Place-name gate** — every place and person name in the Cultural Graph must appear in its approved transliteration; done when a wrongly spelled "Thanjavur" variant is caught.
781. **Glossary of heritage terms** — versioned `glossary.tsv` (gopuram, vimana, mandapa, stepwell, chhatri) with per-language approved renderings and keep-in-English flags; done when changing a glossary entry bumps `glossaryVersion` and invalidates cached units. [needs-human-reviewer]
782. **Back-translation spot check** — translate a sampled 10% of units back to English and score similarity against source with entity checks, as a triage signal only; done when low-scoring units are queued for review and the report states it is not proof of correctness. [needs-sarvam]
783. **Define the `needsReview` state machine** — `generated → needsReview → approved | rejected | stale`, only `approved` ships; done when the build fails if a shipped unit is not `approved`.
784. **Build a reviewer workflow** — a static review page lists source and translation side by side, accept/edit/reject, exports a signed-off patch file; done when a reviewer's edits land as a pull request with reviewer id and date. [needs-human-reviewer]
785. **Log reviewer corrections as glossary candidates** — repeated edits to the same term propose a glossary entry; done when the tool lists terms edited three or more times. [needs-human-reviewer]
786. **Publish per-language review coverage** — a table of units approved vs total per language, from data not hand-edited; done when the numbers regenerate from the status files in CI.

## Labelling and disclosure
787. **Add the AI voice badge** — a visible "AI voice (Sarvam Bulbul)" label on every Bulbul-generated audio player; done when a Playwright test finds the badge next to each AI audio element.
788. **Add the machine translation label** — "Machine translation, not yet reviewed" shown on any unit not `approved`, removed once reviewed; done when the label's presence flips with the status in a test.
789. **Label device speech too** — speechSynthesis narration shows "Device voice (on-device text-to-speech)"; done when the badge appears for the fallback path and never for recorded audio.
790. **Mark English as source of truth** — each translated page links to the English original and says which is authoritative; done when every translated stop page has a working link.
791. **Add provenance to exported data** — GeoJSON/JSON exports carry `aiGenerated`, `provider`, `reviewStatus` fields; done when the export schema rejects AI text without them.
792. **Write a plain-language AI disclosure page** — what is AI-made, what is human-reviewed, how to report an error; done when the page is linked from the footer and from every AI-labelled item.

## Audio mastering and manifests
793. **Normalise loudness** — target integrated loudness and true-peak limit chosen once and documented, measured with ffmpeg `loudnorm`; done when every shipped file measures within the stated tolerance in CI. [needs-decision]
794. **Encode Opus and MP3 variants** — Opus as primary, MP3 as compatibility fallback, bitrates picked from a listening test on a phone speaker; done when a size table per file is generated and both formats play in Safari and Chrome. [needs-decision]
795. **Trim leading and trailing silence** — cap silence at a small fixed head/tail value; done when no file starts with more than the cap of silence by a detector test.
796. **Emit chapter markers per paragraph** — timestamps aligned to unit ids in the manifest; done when seeking to a chapter plays the matching paragraph in a test.
797. **Write a duration manifest** — `audio-manifest.json` lists unit id, language, duration ms, bytes, codec; done when the player reads durations without fetching audio.
798. **Hash every audio file** — SHA-256 stored in the manifest and verified at build; done when altering one byte fails the build.
799. **Enforce the 90-second stop cap** — flag narrations over 90 s for splitting; done when the pipeline reports overlong stops with their durations.
800. **Run clipping and artefact checks** — detect clipping, long pops, and truncated endings in generated audio; done when seeded bad fixtures are caught. 
801. **Keep a regeneration rule** — audio is re-generated only when text hash, voice, or model changes, never on a timer; done when the manifest records the triple and unchanged triples skip synthesis. [needs-budget]

## Pronunciation lexicon and voice selection
802. **Build the place-name pronunciation lexicon** — `lexicon/<lang>.tsv` mapping name to a respelling that Bulbul reads correctly, since SSML is unavailable; done when each entry has a source of the spelling and an audio sample id. [needs-human-reviewer]
803. **Apply lexicon substitution before TTS only** — the displayed text stays canonical while the TTS input uses respellings; done when a test shows the display text unchanged and TTS input substituted.
804. **Prioritise lexicon by stop frequency** — start with names appearing in the most stops; done when the lexicon coverage report lists top uncovered names.
805. **Run pronunciation listening tests** — a short native-speaker checklist per language for 20 hard names; done when results are stored per name as pass/fix. [needs-human-reviewer] [needs-sarvam]
806. **Select voices per language** — choose one default and one alternate Bulbul voice per supported language after blind listening; done when the choice and reviewer notes are in the registry. [needs-human-reviewer] [needs-sarvam]
807. **Keep voice stable per route** — one voice per language per route so listeners do not hear voice changes between stops; done when a validator fails mixed voices inside a route.
808. **Mark unsupported-voice languages explicitly** — languages without a Bulbul voice show text only or device voice with a clear label; done when the language menu reflects voice availability from the capability table.
809. **Record a voice-change protocol** — changing a voice invalidates cached audio for that language and requires re-review of ten samples; done when the registry bump triggers the invalidation. [needs-budget]

## Studio pipeline and moderation
810. **Add transcript cleanup stage** — remove fillers and fix punctuation without altering facts, with a diff shown to the creator; done when the diff view lists every changed span and creator must accept.
811. **Fact-check against stop text** — extracted claims are compared with the stop's own verified text; done when unsupported claims are listed with the nearest source sentence or "none found".
812. **Fact-check against the Cultural Graph** — dates, dynasties, builders and place relations checked against graph entities; done when a deliberately wrong dynasty in a fixture is flagged.
813. **Moderate hate and discrimination** — classifier plus keyword rules for caste, religion, region and community slurs; done when the labelled test set meets a recall target set by the owner. [needs-decision]
814. **Moderate defamation risk** — flag statements making claims about living or named persons and institutions; done when such claims route to human review rather than auto-publish.
815. **Moderate religious sensitivity** — flag contested origin claims and disputed-site narratives for a neutral-wording review; done when flagged items require a named editor's approval. [needs-human-reviewer]
816. **Moderate safety content** — block instructions for unsafe climbs, restricted-area entry and dangerous activity at sites; done when the red-team set of unsafe route tips is all blocked.
817. **Detect doxxing and PII** — scrub phone numbers, emails, home addresses and personal names of private people from transcripts; done when a PII fixture is redacted and the redaction is logged.
818. **Run copyright and plagiarism checks** — compare against known sources and flag long verbatim overlaps; done when pasted text from a fixture book passage is flagged.
819. **Apply child-safety checks** — block content aimed at or involving minors' personal data and any sexualised content; done when child-safety fixtures are blocked and reported per policy. [needs-decision]

## Ask NAARAD
820. **Ship static pre-generated Q&A first** — 5 questions per stop drafted by a model, human fact-checked, stored as JSON; done when each answer is marked `humanChecked: true` before it appears. [needs-human-reviewer]
821. **Require source quotes in answers** — every answer carries a verbatim quote from the stop text with its unit id; done when a validator rejects any answer whose quote is not a substring of the source.
822. **Design live RAG with citations** — retrieve stop text and graph slices, answer with inline citations linking to units; done when each live answer displays at least one clickable citation. [needs-sarvam]
823. **Refuse when ungrounded** — if retrieval confidence is low or no quote supports the answer, respond "NAARAD doesn't have this" instead of guessing; done when the unanswerable set returns refusal at the target rate.
824. **Defend against prompt injection** — user text and retrieved text are delimited and treated as data, system rules never in user-editable fields; done when a set of injection strings fails to change behaviour.
825. **Add abuse controls** — per-device and per-day question limits, length cap, profanity and off-topic handling, no accounts; done when rate-limit and length tests pass. 
826. **Set latency targets** — static answers instant from cache; live answers get a measured first-token and total target recorded after the first real trial; done when the dashboard shows p50 and p95 against targets the owner approves. [needs-decision] [needs-sarvam]
827. **Compute cost per question** — token counts times the chat rates (Rs 15 in, Rs 5 cached, Rs 60 out per 1M tokens), plus TTS chars if voiced; done when each logged answer carries a rupee estimate.
828. **Cache answers** — normalised question plus unit hashes as key, so repeats cost nothing; done when a repeated question shows cache hit and zero spend.
829. **Build the golden evaluation set** — 150 questions with approved answers and source quotes, split by answerable, partial, unanswerable; done when the set is versioned and every item has a reviewer initials field. [needs-human-reviewer]
830. **Write red-team prompts** — jailbreak, injection, political, medical, legal, personal-data and fabricated-fact prompts; done when each has an expected behaviour and the suite runs in one command.
831. **Track hallucination metrics** — unsupported-claim rate, quote-mismatch rate, refusal precision and recall, reported with sample counts; done when the report states denominators and never rounds small samples into percentages without them.
832. **Reuse the static Q&A as the live fallback** — when offline or over limit, show the nearest pre-generated answer with its label; done when the offline test shows the closest static answer or a refusal.
833. **Give feedback controls** — thumbs and "report a wrong answer" storing only the question id and reason locally or in an issue template; done when a report produces a pre-filled GitHub issue with no personal data.

## Cultural Knowledge Graph
834. **Define the entity schema** — types for Place, Monument, Person, Dynasty, Event, Deity/Tradition, Term, Route with ids, labels per language, dates with uncertainty; done when a JSON Schema validates every node.
835. **Require sources on every claim** — each edge or fact has `source`, `sourceType`, `retrievedAt`, and `confidence`; done when the validator rejects unsourced facts.
836. **Choose open licences** — only CC0/CC BY/public-domain sources imported, with licence stored per fact; done when an export lists attribution for every fact. [needs-decision]
837. **Model uncertain dates honestly** — ranges and "c." supported, never single invented years; done when the schema rejects a precise date without a source.
838. **Link to Wikidata ids where they exist** — optional `wikidataId` for dedupe and labels; done when a script reports matched and unmatched entities with counts.
839. **Build editor tools** — a form-based editor with source required, duplicate warning and diff preview, outputting pull requests; done when an entity can be added end to end without hand-editing JSON. [needs-human-reviewer]
840. **Add graph integrity checks** — no orphan stops, no cyclic dynasty succession, every route stop has a node; done when CI runs the checks and a broken fixture fails.
841. **Version and slice the graph** — per-stop slices used by RAG and fact-check, with a graph version in every AI output; done when changing a node changes only the slices that include it.

## Trip-planning assistant, personalisation and recommendations
842. **Scope the trip assistant narrowly** — it composes itineraries only from stops and routes in the atlas, never invents opening hours, prices or transport times; done when outputs reference only atlas ids and the test set shows zero invented hours.
843. **State assistant limits in the UI** — "suggests from NAARAD routes; check timings locally" visible beside results; done when the notice is present in screenshots.
844. **Refuse out-of-scope requests** — bookings, medical, legal, safety-critical navigation; done when the red-team scope set is refused with a pointer to official sources.
845. **Personalise on-device only** — interests, language and pace stored in localStorage, never sent with questions; done when network logs of a session show no preference payload.
846. **Offer a visible reset** — one control clears all stored preferences; done when it wipes the keys and the UI returns to defaults.
847. **Recommend with transparent rules first** — similar-by-theme, nearby, and same-era suggestions computed from graph tags, no behavioural profiling; done when each recommendation shows its reason string.
848. **Evaluate recommendations by coverage, not clicks** — measure diversity across regions and communities in suggested sets; done when a report flags sets dominated by one region. [needs-decision]

## AI-assisted workflows, evaluation and registry
849. **Make human fact-check mandatory** — no AI-drafted text publishes without a named human checker and checklist; done when the publish script fails without `checkedBy` and date. [needs-human-reviewer]
850. **Create a fact-check checklist** — dates, names, spellings, claims, sensitivity, source quotes; done when the checklist is attached to each content pull request template.
851. **Build an evaluation harness** — one command runs translation gates, Q&A golden set, moderation set and prints a scorecard; done when two runs on the same inputs give identical scores.
852. **Add model-change regression tests** — swapping model id reruns the golden sets and blocks promotion if scores drop below the stored baseline; done when a deliberately worse mock model fails the check. [needs-sarvam]
853. **Create a prompt registry** — every prompt in `prompts/` with id, version, owner, model, and change log; done when code can only load prompts by registry id.
854. **Version prompts semantically** — prompt version is part of the cache key and output metadata; done when changing a prompt invalidates only its dependent caches.
855. **Review prompt changes like code** — prompt edits require a pull request with eval diff attached; done when CI posts the scorecard delta on prompt PRs.
856. **Build a cost dashboard** — static page generated from the spend ledger showing spend by endpoint, language and week against the Rs 1,000 cap; done when it reads only from the ledger and shows remaining budget. [needs-budget]
857. **Set alert thresholds** — warn at fixed fractions of the cap and stop at the cap; done when the guard prints warnings at the thresholds in a simulated ledger. [needs-budget]
858. **Log every AI call** — id, prompt version, model, tokens or chars, cost estimate, input hash, no raw user text; done when the log passes a PII-free check.

## Data governance and safety policy
859. **Separate training consent from service consent** — a distinct, unticked opt-in to let any data be used for model improvement; done when declining it leaves every feature working.
860. **Make consent revocable** — a revoke control and a documented deletion path with a stated timeline; done when revoke removes the record in a test. [needs-decision]
861. **Never use creator or traveller data for training by default** — Sarvam and fallback requests use no-retention settings where available and the policy states what is not controllable; done when the privacy page lists each provider's known retention. [needs-decision]
862. **Publish a generated-content safety policy** — what AI may not produce (hate, defamation, unsafe advice, impersonation of real people's voices); done when the policy is linked from Studio and enforced by the moderation tests.
863. **Define an incident process for bad AI output** — report, takedown within a stated window, root-cause note, regression case added to the eval set; done when a drill takes a fake bad answer from report to eval case.
864. **Record data inventory for AI features** — what is sent to which provider, retention, legal basis; done when the inventory table lists every endpoint and is reviewed before launch. [needs-decision]

## Accessibility, offline models and on-device speech
865. **Provide a transcript for every audio** — synchronised text visible beside the player, same unit ids; done when no audio element lacks an adjacent transcript in an automated check.
866. **Support captions and reading speed controls** — adjustable text size, speed 0.75x to 1.25x, and pause; done when keyboard-only use passes an axe and manual screen-reader pass.
867. **Test generated audio for intelligibility** — a small listening panel including older and hard-of-hearing listeners rates clarity; done when results are stored per language with sample sizes stated. [needs-human-reviewer]
868. **Run an offline small-model feasibility study** — measure size, memory, speed and quality of candidate small on-device models for Q&A and TTS on a mid-range Android phone; done when a report lists measured numbers per device and a go/no-go, with no extrapolated figures. [needs-decision]
869. **Improve WebSpeech fallback quality** — pick the best available local voice per language via `getVoices()`, set `lang`, chunk by sentence, and apply the pronunciation lexicon; done when a device test matrix records chosen voice and any missing-language messages.
870. **Detect missing device voices** — if no voice exists for the language, show text and a download-voice hint instead of reading English; done when the app never speaks Tamil text with an English voice in the test matrix.

## Language rollout and reviewer recruitment
871. **Fix the rollout order** — Hindi, Tamil, Kannada, Telugu, Malayalam, Bengali, Marathi, then others as reviewers allow, gated by Bulbul voice availability for audio; done when the order and gates are in a committed roadmap file. [needs-decision]
872. **Set a per-language launch gate** — a language ships only with reviewed glossary, lexicon of top names, 20 reviewed stops, and a named reviewer; done when a launch checklist script outputs pass/fail per language. [needs-human-reviewer]
873. **Recruit reviewers per language** — two native speakers each, with heritage familiarity, via college clubs and local heritage societies; done when a tracker lists names (with consent), language, and trial-task result. [needs-human-reviewer]
874. **Define reviewer tasks and credit** — a 30-unit trial, clear edit guidelines, public credit page with consent; done when a new reviewer can complete the trial using only the guide. [needs-human-reviewer]
875. **Pilot one language end to end** — run Hindi from translation through review to audio on a small route using the dry-run, first-call check and budget guard; done when the route ships with labels, reviewer sign-off and a recorded actual-vs-estimate spend. [needs-sarvam] [needs-budget] [needs-human-reviewer]

# Part 8: items 876-1000

## Payments and entitlements (all later, founder-gated)

876. **Record a pay-or-stay-free decision** [needs-decision] — add a decision-log entry stating whether any paid tier exists, since the site says no paid plans today; done when the entry has an approver, date and review trigger and nothing below starts before it.
877. **Write the District Pass concept note** [later] [needs-decision] — one page on what a district-level pass would unlock, who pays, and which free features stay free; done when each claim cites a ledger entry or is marked unvalidated.
878. **Draft an entitlement model** [later] — table of feature, free or entitled, and offline-bundle access, with the rule that free walking routes never get paywalled; done when a test lists every route as free.
879. **Compare Razorpay subscriptions against UPI autopay and one-off UPI** [later] [needs-evidence] — note fees, mandate limits and failure modes from Razorpay's current docs; done when each figure carries a source URL and retrieval date.
880. **Design payment-failure and grace-period behaviour** [later] — states for failed, pending, retried and lapsed payments with what the user sees offline; done when a state diagram covers every transition.
881. **Specify the refund and cancellation policy** [later] [needs-lawyer] — refund windows, partial refunds and chargebacks, written plainly in English and Hindi; done when counsel has reviewed it and the policy page is drafted but unpublished.
882. **Map GST registration and invoicing duties** [later] [needs-lawyer] — thresholds, SAC code, invoice fields for digital services; done when a CA confirms which duties begin at which revenue point.
883. **Map TDS and TCS touchpoints on payments received and creator payouts** [later] [needs-lawyer] — list which flows may attract TDS or TCS and who deducts; done when a CA-reviewed table exists with no unreviewed row.
884. **Set a payments kill switch and spend-cap check** [later] [needs-budget] — a flag that disables checkout and a pre-launch check against the Rs 1,000 cloud cap in D-0003; done when the flag disables checkout in a test and the cap check is documented.

## Creator programme: onboarding, guidelines, reputation

885. **Define who a creator is** [needs-decision] — separate story contributors, route authors, narrators and local guides with one-line definitions; done when each role maps to exactly one agreement type.
886. **Draft the creator onboarding flow** [later] — steps from invite to first submission using the F-001 creator-accounts spec; done when a clickable outline passes a five-person stranger walkthrough.
887. **Write creator content guidelines** — accuracy, sourcing, sensitive sites, respect for worship spaces, no copied text; done when a checklist of at most 15 items is linked from the creators page.
888. **Publish a source-and-citation standard for stories** — how to cite archives, ASI notices, oral accounts and the permission needed for each; done when every sample story in /stories passes the checklist.
889. **Design a creator verification ladder** [later] — levels from unverified to field-verified with the evidence each level needs; done when each level has a written entry test and no automatic promotion.
890. **Define reputation signals without gaming** [later] — accepted edits, field verifications and corrections made, never raw listen counts; done when the signal list is reviewed against the review-integrity rules.
891. **Draft the creator agreement outline** [needs-lawyer] — licence scope, moral rights, exclusivity, termination and credit; done when counsel returns a marked draft and it is stored under ops/ without personal data.
892. **Run five creator discovery conversations** [needs-evidence] — use the past-behaviour interview style and log each as a ledger entry; done when five ledger lines exist with verbatim quotes and tiers.
893. **Create a creator feedback and correction loop** — how a creator sees edits to their story and disputes them; done when the process has a response time and a named owner.
894. **Set a story retirement rule** — conditions under which a published story is withdrawn at creator request; done when the rule states how long removal takes and what remains in archives.
895. **Pilot with a few invited creators before any open programme** [needs-decision] [needs-evidence] — choose a small cohort size only after a T2 signal exists; done when the pilot design names a stop condition.

## Revenue share and creator payouts (later)

896. **Reconcile the 'monthly UPI' and 'per-listen' wording** [needs-decision] — audit every page and doc that mentions creator earnings and pick one honest description until a model is chosen; done when a grep for both phrases shows consistent text.
897. **Model three payout options on paper** [later] [needs-evidence] — monthly flat, per-listen and pooled share with failure cases such as zero listens; done when each option shows a worked example using clearly labelled hypothetical numbers.
898. **Define what a countable listen is** [later] — minimum duration, offline playback sync, duplicate suppression; done when the definition matches the event schema in docs/event-schema.md.
899. **Assess RazorpayX payouts for creators** [later] [needs-budget] — onboarding needs, per-payout cost, KYC burden, minimum balance; done when a feasibility note cites current vendor docs.
900. **Specify payout dispute and clawback rules** [later] [needs-lawyer] — fraud, takedown after payment, overpayment; done when each case has a stated outcome.
901. **Collect creator tax details only at payout time** [later] [needs-lawyer] — PAN and bank data held by the processor, not Naarad storage where possible; done when the data flow shows no PAN in our database.

## Partner and tourism-board portal, API and embeds

902. **Draft the circuit digitisation workflow** [later] — board supplies sites, field team verifies, editors review, publish with attribution; done when each step has an owner, input and output.
903. **Design a partner dashboard wireframe** [later] [needs-evidence] — show visits, route completions, offline downloads, with no user-level data; done when each metric maps to a defined event.
904. **Choose partner metrics that boards say they need** [needs-evidence] — take them from tourism-board interview logs, not guesses; done when each metric cites a ledger entry.
905. **Define partner roles and permissions** [later] — viewer, editor, admin with least privilege; done when a permission matrix is reviewed by the security role.
906. **Write an invoicing and agreement template for partner pilots** [later] [needs-lawyer] — scope, fees if any, deliverables, GST line; done when counsel has seen it and no figure is invented.
907. **Draft an OpenAPI 3 spec for read-only route data** [later] — routes, sites, stories, licence fields; done when the spec validates in a linter and matches the shipped JSON.
908. **Specify API keys and rate limits** [later] [needs-budget] — key issuance, per-key quota, revocation, abuse response; done when limits are documented with a stated reason and cost check.
909. **Specify signed webhooks for partners** [later] — events such as route updated, HMAC signature, retry policy; done when a replay-safe example and test exist.
910. **Design an embeddable route widget** [later] — an iframe or web component with attribution, offline notice and no third-party tracking; done when a demo page loads with no cookies set.
911. **Document widget sandboxing and CSP needs** [later] — what an embedding site must allow; done when the guide lists headers and has been tested on a plain static host.
912. **Publish a partner data-sharing and licence statement** [needs-lawyer] — what partners may reuse and with what credit; done when it matches the content-licensing policy.

## CSR, temple-trust and heritage-body engagement

913. **Log every outreach in the evidence ledger** — each conversation becomes an entry with tier, quote and date, no names; done when `node scripts/ops.mjs validate` passes after each entry.
914. **Hold the first three temple-trust interviews with the existing guide** [needs-evidence] — ask about past decisions, not the product; done when the lint-guide check passes and notes are logged.
915. **Hold the first three CSR-team interviews** [needs-evidence] — focus on how projects were chosen and approved last year; done when each yields a T2 or lower entry honestly tiered.
916. **Hold the first three tourism-board interviews** [needs-evidence] — learn procurement path and who signs; done when interviews are logged and the buyer role is recorded.
917. **Define what counts as a T3 ask** [needs-decision] — a site, board or sponsor commitment of time or reputation, such as a named contact reviewing a route; done when each ask in the pilot list is labelled T3-eligible or not.
918. **Design a no-cost pilot with one heritage site** [needs-evidence] — scope a single route, a verification visit, a published credit; done when success and stop criteria are written before the pilot starts.
919. **Write pilot success metrics up front** — one outcome metric, one guardrail, a review date; done when the metrics are in the decision log before launch.
920. **Prepare a CSR one-pager that states only what exists** — no impact numbers, no logos without permission; done when a stranger can state what Naarad is and is not after reading it.

## Marketplace (later, not before evidence)

921. **Gate any marketplace on the stop rule** [later] [needs-decision] — log that no booking features begin until T3 evidence exists; done when the gate cites D-numbers.
922. **Define guide verification criteria** [later] [needs-lawyer] — licence checks, references, local authority rules; done when a checklist exists and no badge is auto-granted.
923. **Study ASI e-ticketing integration feasibility** [later] [needs-evidence] — find whether any official API or partnership route exists; done when a note records the source or states none was found.
924. **Sketch ticket and stay listing models** [later] — resale is out of scope unless a lawyer approves; done when the doc names allowed and banned listing types.
925. **Design an availability and calendar model** [later] — slots, capacity, time zones, offline caching; done when edge cases such as double booking are listed with outcomes.
926. **Draft cancellation and no-show rules** [later] [needs-lawyer] — refund interplay with the payments policy; done when each scenario maps to a refund outcome.
927. **Assess marketplace liability and consumer-law exposure** [later] [needs-lawyer] — intermediary status, grievance duties; done when counsel gives a written view that is stored.

## Trust and safety

928. **Write a fraud threat list** [later] — fake listens, fake guides, payout abuse, spam stories; done when each threat has a detection idea and an owner.
929. **Set a review-integrity policy** [later] — one review per verified visit, no incentives without disclosure; done when it forbids paid ratings in plain text.
930. **Design a report button and intake form** [later] — report story, photo, guide or route with minimal fields; done when a report reaches a queue in a test.
931. **Set moderation SLAs** [later] [needs-budget] — acknowledge and act times by severity, sized to actual staffing; done when each SLA lists who is on call.
932. **Define an escalation ladder** — support, then moderator, then founder, then legal; done when contact roles exist without personal numbers in the repo.
933. **Stand up a support inbox and macros** — a shared address with templates; done when a test message gets the right template in under the stated time.
934. **Plan multilingual support** [needs-budget] — start with languages in the content; done when each language has a named reviewer or is marked unsupported.
935. **Write a safety notice for walking routes** — heat, monsoon, remote sites, women travelling alone; done when each route page links it and it makes no guarantee of safety.

## Legal and compliance (counsel review required; nothing here claims compliance)

936. **Draft the privacy notice for today's no-account state** [needs-lawyer] — say what is and is not collected now; done when it matches actual network requests in a test.
937. **Prepare a DPDP data inventory** [needs-lawyer] — each field, purpose, lawful basis, location; done when it matches the schema and flags gaps.
938. **Design the consent flow for later accounts** [later] [needs-lawyer] — itemised, withdrawable, in plain language; done when copy exists in English and Hindi for review.
939. **Draft terms of use** [needs-lawyer] — user conduct, content licence, liability limits; done when counsel returns edits.
940. **Plan a DPDP rights portal** [later] [needs-lawyer] — access, correction, erasure, nominee, grievance; done when each right has a request path and a response time.
941. **Write the retention schedule** [needs-lawyer] — each data class, retention period, deletion mechanism; done when the table has no blank period.
942. **List processor agreements needed** [needs-lawyer] — Sarvam, Supabase, MSG91, Razorpay; done when each shows the data shared, location and signed status as yes or no.
943. **Appoint and publish a grievance officer** [needs-decision] [needs-lawyer] — name a role-holder and a contact route; done when the notice names the contact and the response time.
944. **Write a breach response runbook** [needs-lawyer] — detect, contain, assess, notify the Board and affected persons as required; done when a tabletop drill is logged.
945. **Draft a children's data policy** [needs-lawyer] — age assumptions, verifiable parental consent approach, no profiling; done when product rules say minors never receive tracking.
946. **Publish an accessibility statement** — WCAG target, known gaps, contact route; done when each stated gap is traced to a test result.
947. **Write a content licensing and attribution policy** [needs-lawyer] — what is CC, what is permissioned, how to credit; done when each content folder has a licence line.
948. **Create a photo permission and takedown policy** [needs-lawyer] — consent for people, site rules, response time; done when a takedown test removes an image from the live site in the stated time.
949. **Check trademark and domain posture** [needs-lawyer] [needs-budget] — search class 9/41/42 marks and domain variants; done when counsel gives a written clearance note.

## Security

950. **Write a threat model for the static site and service worker** — assets, trust boundaries, abuse cases; done when each threat has a mitigation or accepted risk.
951. **Document CSP limits on GitHub Pages** — meta tag only, no frame-ancestors, no report-only headers; done when a meta CSP is tested on a staging copy.
952. **Add SRI for third-party scripts and styles** — hash every external asset or remove it; done when a test fails on an unhashed external tag.
953. **Review dependencies and lockfiles** — audit the Node and CDN dependencies; done when the audit result is logged and each critical finding is closed.
954. **Review skills and MCP servers as supply chain** — list each in skills-lock.json, source, permissions; done when unknown sources are removed or approved in the decision log.
955. **Write a secret rotation schedule** — each key, owner, interval; done when `node scripts/ops.mjs scan` runs in CI and the schedule has dates.
956. **Apply least privilege to agents and tokens** — scope GitHub tokens and keep agent roles at Tier 1 as guardrails.json states; done when a role-permission test passes.
957. **Design audit logging for later accounts** [later] — who changed what, retained per schedule, without content bodies; done when a sample log has no personal data.
958. **Plan a penetration test** [later] [needs-budget] — scope, tester, timing after accounts exist; done when a quote or a written deferral exists.
959. **Define a bug bounty or disclosure path** [later] [needs-budget] — start with a security.txt and a coordinated disclosure page; done when /.well-known/security.txt resolves.
960. **Write an incident response plan** — severity levels, roles, comms, post-mortem; done when a drill produces a dated post-mortem.

## Data and analytics governance

961. **Review the event schema against consent** — docs/event-schema.md fields vs purpose; done when each field names its purpose or is removed.
962. **Define a consent gate for analytics** [needs-lawyer] — nothing loads before opt-in; done when a network test shows zero analytics requests by default.
963. **Choose a north-star metric** [needs-decision] — pick one tied to completed routes, with the rationale; done when the decision is logged.
964. **Choose guardrail metrics** — page weight, offline success rate, complaint rate; done when each has a threshold and an owner.
965. **Write an A/B test policy** — minimum sample, no tests on safety content, preregistered metric; done when a template exists and is used in one dry run.

## Organisation and evidence discipline

966. **Enforce decision-log discipline** — every irreversible choice gets a D-number; done when CI flags a merged policy change with no decision reference.
967. **Run a quarterly roadmap review** — keep, cut or defer items, with reasons; done when the review is logged and cut items are tagged.
968. **Keep roadmap hygiene rules** — every item has an owner tag, a tier tag and a testable done check; done when a lint script rejects an item without them.
969. **Write onboarding docs for a new contributor** — repo map, how to run tests, how ops/ works; done when a newcomer ships a small doc fix unaided.
970. **Publish a contributor guide** — branch rules, review expectations, agent tier limits; done when it links the guardrails.
971. **Adopt a code of conduct** [needs-decision] — pick a standard text with an enforcement contact; done when it lives in the repo root.
972. **Run the stranger test** — follow ops/stranger-test.md with five strangers and log observations; done when the log has five dated entries.
973. **Run twenty customer-discovery interviews** [needs-evidence] — across boards, trusts and CSR; done when twenty ledger entries exist or the stop is invoked.
974. **Apply the T2/T3 stop rule honestly** — if twenty interviews yield no T3, record a re-segment or stop decision; done when the decision is logged either way.

## Funding and grants alignment

975. **Check Seed Fund and TANSEED eligibility items** [needs-lawyer] — use the india-compliance skill checklist and mark each item yes, no, or unknown; done when no item is claimed met without a document.
976. **Prepare an incorporation and DPIIT status note** [needs-decision] — what exists today versus what a grant requires; done when gaps are listed.
977. **Draft a grant narrative using only ledger facts** — no invented users or revenue; done when each sentence cites a source or is removed.

## Brand, press and community

978. **Create a brand asset sheet** — logo usage, colours, minimum sizes; done when partners can attribute correctly from one page.
979. **Write a partnership attribution kit** — credit lines for boards, trusts and creators; done when the kit is used in one published route.
980. **Build a press kit** — what Naarad is, current limits (no accounts, no payments, no app), screenshots; done when every claim is checkable on the site.
981. **Design a heritage walker community plan** [later] — small, moderated, tied to routes; done when rules and a moderator are named.
982. **Write a volunteer role list** — photo checker, translator, field verifier with time limits; done when each role has a brief.
983. **Design a field-verification network** [later] [needs-budget] — how volunteers confirm a route is walkable and safe; done when a checklist and a reporting form exist.
984. **Record community contributions with consent** — credit and licence captured at submission; done when each contribution has a consent field.

## Accessibility partnerships and open data

985. **Identify accessibility partner organisations** [needs-evidence] — blind, deaf and mobility groups for route testing; done when contact is logged as an interview entry.
986. **Plan audio-description and screen-reader testing with users** [needs-budget] — paid sessions with people who use these tools; done when a schedule and consent forms exist.
987. **Publish accessible-route information standards** — step-free, gradient, rest points, with verified status; done when each field is defined with a source rule.
988. **Decide the open-data release scope** [needs-decision] — which datasets are published and under which licence; done when the decision names each dataset.
989. **Choose a licence for route data** [needs-lawyer] — compare ODbL and CC BY-SA considerations; done when counsel and founder approve.
990. **Decide open-source scope for the site code** [needs-decision] — repo is public today, so state the licence explicitly; done when a LICENSE file exists and the decision is logged.
991. **Create a third-party data provenance register** — source, licence, date for each imported dataset such as GPX and GeoJSON; done when no dataset lacks a row.

## Retire, merge or archive pass

992. **Inventory all roadmap items 1 to 1000 by status** — shipped, open, blocked, dead; done when counts sum to 1,000.
993. **Merge duplicate items** — find items that restate each other across parts; done when merged items point to a survivor.
994. **Retire items contradicted by evidence** — mark them with the ledger entry; done when each retired item cites its reason.
995. **Archive stale docs** — move old plans to an archive folder with a note; done when no live link points to an archived file.
996. **Remove unused skills and scripts** — check against skills-lock.json and CI; done when each removal passes the test suite.
997. **Reconcile the site's claims with reality** — every statement about payments, accounts and narration checked; done when the audit shows no false claim.
998. **Close stale decision-log proposals** — D-0001 and others waiting on the founder get a resolution; done when each has an approver or a withdrawn status.
999. **Re-run the stop-rule status check** — evidence count by tier and what is blocked; done when the output is pasted in the log.
1000. **Publish an honest roadmap status page** — what is done, deferred and cancelled; done when it lists cancelled items with reasons.
