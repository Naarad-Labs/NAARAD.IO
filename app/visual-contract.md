# Visual contract

What the markup and the stylesheets promise each other. Keep these stable, or
change them in both places at once.

## Stable hooks the runtime needs

`#app`, `#app-content`, `#map`, `#route-title`, `#home-title`, `#catalogue-grid`,
`#catalogue-count`, `#catalogue-query`, `#route-search`, and the `data-` hooks
`data-view`, `data-route`, `data-story`, `data-stop`, `data-select-stop`,
`data-action`, `data-tab`, `data-stop-tab`, `data-journey-tab`,
`data-journey-panel`, `data-studio*`, `data-map`, `data-filter-*`.

`main.js` owns routing and every event; a view module returns markup and nothing
else. A view exports `render()`, a `stylesheet` path, and `meta` (an object, or a
function of the thing being shown).

## Layout vocabulary

- `.site-shell` / `.site-header` / `.site-footer` — the chrome, on every page.
- `.home-hero`, `.route-hero`, `.story-hero`, `.journey-hero`, `.studio-hero` —
  a copy column beside a full-bleed photograph, which carries `.torn-left`.
- `.route-facts` — the eight-cell fact grid raised over the hero.
- `.route-bar` — sticky tabs and walk actions; on a phone its two halves separate
  (`display: contents`) into a sticky tab strip and a fixed action bar.
- `.route-workspace` — map, stop story, stop rail. Flattened on a phone so the
  map can lead.
- `.stop-panel`, `.stop-rail`, `.stop-item`, `.stop-index` — the stop being read
  and the list of the rest.
- `.story-body` — on-this-page rail, article column, route and related rails.
- `.route-card`, `.route-card-grid` — a photograph, a generated map preview and
  the route's real facts. Used on home, explore, related and journey.
- `.listen-bar` — the player, outside the view container so it survives
  navigation.

## Primitives

`.eyebrow` (`.eyebrow-mark` adds the orange square), `.display`, `.section-title`,
`.lede`, `.data-note`, `.button` (`-primary`, `-ghost`, `-sm`), `.icon-button`,
`.text-link`, `.chip`, `.chip-list`, `.pin-chip`, `.metric`, `.metric-row`,
`.empty-state`, `.note-card`, `.note-plain` (`.note-over-photo` when it sits on a
photograph), `.photo`, `.photo-credit`, `.caption`, `.breadcrumb`, `.byline-mark`,
`.sr-only`, `.ico`.

Generated graphics: `.route-preview` with `.rp-line`, `.rp-pin`, `.rp-num`;
`.elevation-svg` with `.ep-area`, `.ep-line`, `.ep-pin`, `.ep-num`, `.ep-axis`,
and `.is-spark` for the card sparkline.

## Art direction

Paper `#f8f3e9`, ink navy `#12294a`, terracotta `#c6511b`, sage `#6f8156`, gold
`#c9a227`. Playfair Display for display type, DM Sans for everything working,
Caveat for the handwritten notes. Fine rules, small radii, restrained shadows,
generous type. A photograph meets paper on a torn edge, never a hard rectangle.

## Rules

- Keep data gaps explicit. An empty state says what is missing and why; it never
  implies stops, audio, elevation or geometry that nobody published.
- Every photograph shows its author and licence, or says the rights are not
  recorded.
- Interactive things are real `button`s and `a`s, focus-visible, with labels.
- Never encode meaning in colour alone.
- One map instance, ever. Cards use the generated SVG preview.
- Touch targets on phone action bars are at least 44px.
