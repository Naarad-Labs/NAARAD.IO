# Design System (Visual-First Revamp)

## Design Philosophy

**Komoot-style restraint is the base.** Every page leads with photography and maps. Text supports the visual; it never leads. The interface is quiet, the place is loud.

**Borrow one idea from each reference:**
- **Komoot**: Photo-tile grids, sticky map, editorial restraint
- **AllTrails**: Scrubbable stop photographs (a range under one photograph; route page, built)
- **Strava Flyover**: the route drawn in over the hero photograph (an SVG line, no video, still under reduced motion; route page, built)
- **VoiceMap**: Now-playing screen against the map (walking mode)
- **Airbnb**: Five-photo mosaic before any text (hero photograph plus up to four more; route page, built; place and collection pages not yet)
- **Atlas Obscura**: Every place in India on one map (Explore)

## Design Tokens

### Colors

| Token | Value | Usage | Contrast Notes |
|-------|-------|-------|----------------|
| `--paper` | #f8f3e9 | Primary background | Base paper color |
| `--paper-bright` | #fdfaf4 | Card backgrounds, buttons | |
| `--paper-deep` | #efe6d4 | Photo overlays, secondary surfaces | |
| `--paper-edge` | #e4d9c3 | Decorative edges, dividers | |
| `--ink` | #12294a | Primary text | 13.17:1 on paper |
| `--ink-deep` | #0c1c33 | Strong text, shadows, dark bands | |
| `--ink-soft` | #46556d | Secondary text | |
| `--ink-muted` | #66645b | Muted text, metadata | 5.37:1 on paper (AA) |
| `--orange` | #c6511b | Accent, CTA fills | White: 4.57:1 (AA) |
| `--orange-text` | #b04512 | Accent as text | 5.12:1 on paper (AA) |
| `--orange-on-dark` | #e8894f | Orange on dark backgrounds | |
| `--orange-bright` | #d9622a | Hover/focus states | |
| `--orange-deep` | #a23f10 | Strong accent | |
| `--orange-wash` | #f6e7da | Accent wash backgrounds | |
| `--sage` | #6f8156 | Secondary accent, elevation | |
| `--gold` | #c9a227 | Decorative accents | |
| `--line` | #e0d6c2 | Borders, dividers | |
| `--line-strong` | #cdbfa4 | Stronger borders | |
| `--field-edge` | #857656 | Form field borders | 4.0:1 on paper |
| `--map-ground` | #e7e1d5 | Map background | |
| `--route-line` | #173d68 | Route lines on map | |
| `--white` | #fff | Text on saturated backgrounds | |
| `--preview-ground` | #eef2e6 | Route preview drawings | |
| `--white-rgb` | 255 255 255 | rgb() helper | |
| `--ink-rgb` | 18 41 74 | rgb() helper | |
| `--paper-rgb` | 248 243 233 | rgb() helper | |
| `--ink-deep-rgb` | 12 28 51 | Shadow rgba() helper | |

### Typography

| Token | Value | Usage |
|-------|-------|-------|
| `--serif` | 'Playfair Display', 'Iowan Old Style', Georgia, serif | Headings |
| `--sans` | 'DM Sans', 'Segoe UI', system-ui, sans-serif | Body text, forms |
| `--script` | 'Caveat', 'Segoe Script', cursive | Handwritten notes |
| `--text-xs` | 13px | Smallest UI text (floor) |
| `--text-sm` | 14.5px | Secondary UI text |
| `--text-base` | 16px | Body text, form fields |
| `--text-md` | 18px | Lead text |

### Layout

| Token | Value | Usage |
|-------|-------|-------|
| `--header-h` | 72px | Header height (reduced from 78) |
| `--player-h` | 0px | Listening bar offset (dynamically set) |
| `--shadow-sm` | 0 1px 2px rgba(18, 41, 74, .06), 0 4px 12px rgba(18, 41, 74, .05) | |
| `--shadow-md` | 0 2px 6px rgba(18, 41, 74, .07), 0 14px 34px rgba(18, 41, 74, .09) | |
| `--shadow-lg` | 0 10px 50px rgba(18, 41, 74, .16) | |
| `--radius` | 12px | Border radius (increased from 10) |
| `--radius-lg` | 20px | Large border radius (increased from 16) |
| `--wrap` | 1480px | Content max width |
| `--ease-out` | cubic-bezier(.22, .61, .36, 1) | Standard easing |
| `--move` | 460ms | Default animation duration |

### Motion

Motion is controlled via `html[data-motion='on']`:

- **Transitions**: 180-520ms using `var(--ease-out)`
- **Reveal animations**: Elements with `[data-reveal]` animate in/out
- **Hero drift**: Subtle parallax on hero photos (30s cycle)
- **Stop-photo scrubber**: a range under one photograph moves the stop, its photograph and the map pin together (AllTrails style; route page, built)
- **Walking mode**: a Walk button on a route's map; the walker's position (kept on the device) selects and reads each stop as they reach it (VoiceMap style; built)
- **Route line**: the route drawn in over the hero photograph, CSS only and still under reduced motion (Strava Flyover style; route page, built)

**Tokens** (`app/tokens.css`):

| Token | Value | Usage |
|-------|-------|-------|
| `--ease-out` | cubic-bezier(.22, .61, .36, 1) | Standard transition easing |
| `--move` | 460ms | Default animation duration |
| `--scrub-speed` | 0.3s | Photo transition during scrub |

> Note: Single easing function used throughout; duration varies (180-520ms). Raw values used in CSS for specific timings.

### Breakpoints

Hardcoded in CSS media queries:

| Max Width | Usage |
|-----------|-------|
| 1240px | Collapse search/input in header |
| 1023px | Phone layout (header, nav, map-first) |
| 639px | Touch target sizes, footer layout |
| 429px | Listen bar layout |

### Z-Index Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--z-skip-link` | 2000 | Skip link overlay |
| `--z-header` | 900 | Site header |
| `--z-lightbox` | 1000 | Lightbox dialog |
| `--z-sticky` | 500 | Sticky elements (route stops, map toolbar) |
| `--z-foreground` | 1 | Default foreground layer |

### Breakpoint Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--breakpoint-tablet` | 1023px | Max-width for tablet layout |
| `--breakpoint-phone` | 639px | Max-width for phone layout |

## Components

### Buttons

- `.button` - Primary button style (46px height, pill shape)
- `.button-primary` - Filled with orange
- `.button-sm` - Small button (38px height)
- `.button-ghost` - Transparent with border

### Photo Mosaic (Airbnb-style)

Five-photo grid: one large, four small. Used on route hero, place pages, collections.

### Stop-photo scrubber (AllTrails-style)

`.route-scrubber`: one photograph per stop that has one, with a native range input under it. Arrow keys or dragging move the stop, the photograph, the status line and the map pin together (`app/main.js` `syncScrubber`). Needs two stops with photographs.

### Walking mode (VoiceMap-style)

A `Walk` toggle in the route map's toolbar (`data-map="walk"`, `aria-pressed`). Pressing it asks the browser for location, shows the walker on the map and, within 40 m of a stop (`app/walking.js` `arrivedStop`), selects that stop and reads it aloud once. A status line (`data-walk-status`) says what is happening. The position is used on the device only. The existing listening bar is the now-playing control.

### Route line (Strava Flyover-style)

`.route-draw`: an SVG path from the route's geometry (`app/route-draw.js`) over the hero photograph, drawn in by a CSS animation and still under `prefers-reduced-motion`. No video: it would be too heavy for an offline-first page.

### Cards

- `.route-card`, `.story-card`, `.collection-card`, `.journey-card`
- Feature a media area, title, metrics, and actions
- Photo-led: image first, text below

### Navigation

- `.primary-nav` - Horizontal header nav (mobile collapses to menu)
- `.studio-nav` - Vertical sidebar tabs for Creator Studio

## Accessibility

All colors meet WCAG 2.2 AA contrast requirements (4.5:1 for normal text, 3:1 for large text):

- Primary text (`--ink`) on paper: **13.17:1** ✓
- Muted text (`--ink-muted`) on paper: **5.37:1** ✓
- Orange text on paper: **5.12:1** ✓
- White on orange: **4.57:1** ✓

Focus indicators use `var(--orange-bright)` with 3px outline.

## Dark Mode

> **Status: Not supported.** The design is explicitly light-mode only.

The CSS declares `color-scheme: light` and uses light backgrounds exclusively. No dark mode toggle or media query support exists.

## Typography

- **Headings**: Playfair Display (serif), 700 weight, letter-spacing -.015em
- **Body**: DM Sans (sans), 16px base, system-ui fallback
- **Handwritten**: Caveat (script), 600 weight

Fonts are self-hosted as WOFF2 in `/app/fonts/`.

## Images

- Photographs are served in multiple formats: AVIF, WebP, fallback
- `img` tags include `loading="eager"` for hero images
- Photos can have torn paper edges via `.torn-left` / `.torn-bottom` classes
- **New**: Dithered hero backgrounds for motion/atmosphere (Framer dither style)

## Spacing

- Inline: 8px, 9px, 10px, 11px, 12px, 13px, 14px, 16px, 18px, 22px, 24px, 26px, 34px, 44px, 46px, 52px
- Grid gaps: 7px, 8px, 9px, 13px, 14px, 22px, 26px
- Padding: 5px-26px variants

> Status: Not yet standardized to a spacing scale.

## Components in Progress

The following components need specification files:
- Button component
- Card component
- Focus ring pattern
- Input fields
- Chips/filters
- **Photo mosaic component** (built on the route, home and collection pages; not yet specified as a component)
