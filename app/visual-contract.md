# Visual structure contract

`index.html` supplies the page shell and `app/styles.css` styles it. `app/main.js` owns data and interaction behavior. Preserve these stable IDs for the runtime: `#app`, `#app-content`, `#map`, `#route-title`, `#route-stops`, `#route-comparisons`, `#elevation-profile`, `#route-search`, `#map-layers`, `#map-satellite`, `#fit-route`, and `#route-tabs`.

## Root structure and classes

- `.site-shell`: parchment page background and full viewport shell.
- `.site-header`: masthead. Contains `.brand`, `.primary-nav`, `.header-search`, `.header-actions`; `.menu-toggle` is the small-screen nav control.
- `.route-layout`: desktop two-column route page.
- `.route-sidebar`: left column with `.back-link`, `.route-heading`, `.route-location`, `.route-description`, `.route-stats`, `.route-overview`, `.tag-list`, `.stops-heading`, and `#route-stops`.
- `.route-workspace`: right column with `.map-toolbar`, `#map`, `.map-controls`, `.map-legend`, `.lower-grid`.
- `.story-panel`, `.elevation-card`, `.compare-card`: bottom editorial/map companion cards. `#route-comparisons` is hydrated from available route data.
- `.mobile-route-bar`, `.mobile-map-sheet`, `#route-tabs`, `.mobile-actions`: compact map-first mobile composition and expandable route sheet.
- `.site-footer`: dark navy closing strip.

## Reusable visual classes

Use `.eyebrow`, `.section-title`, `.icon-button`, `.pill`, `.button`, `.button-primary`, `.metric`, `.stop-card`, `.route-card`, `.map-control`, `.empty-state`, `.elevation-empty`, and `.sr-only` as needed. Keep data gaps explicit in editorial empty states; do not imply audio, geometry, elevation samples, or route facts without published records. Interactive elements should be native buttons/links, focus-visible, and carry accessible labels. Do not encode visual meaning only in color.

## Art direction

Warm ivory/paper (#f7f2e8), deep ink navy (#102444), burnt orange (#c95013), muted sage and stone. Use an elegant high contrast serif for display headings and a restrained sans-serif for controls and supporting text. Desktop should read like a heritage atlas: a narrow information rail, expansive satellite map, map overlays, and structured route details beneath. Under 760px, switch to a map-first composition with a compact masthead, map occupying most of the first viewport, overlaid controls, and a raised route sheet. Avoid generic rounded dashboard styling; prefer fine rules, small radii, tactile paper surfaces, generous typography, and restrained shadows.
