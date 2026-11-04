---
name: Naarad
description: A practical, map-first guide to walking routes and places across India.
colors:
  orange-action: "#c6511b"
  orange-text: "#b04512"
  navy-ink: "#12294a"
  deep-navy: "#0c1c33"
  paper: "#f5f6f2"
  white-surface: "#ffffff"
  sage: "#6f8156"
  divider: "#dce1d8"
  map-ground: "#e8eddf"
typography:
  display:
    fontFamily: "DM Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(30px, 3.2vw, 46px)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "DM Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(25px, 2.3vw, 32px)"
    fontWeight: 700
    lineHeight: 1.18
  body:
    fontFamily: "DM Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "DM Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.orange-action}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0 17px"
    height: "44px"
  search-field:
    backgroundColor: "{colors.white-surface}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.md}"
    padding: "10px 12px 10px 41px"
    height: "48px"
---

# Design System: Naarad

## Overview

**Creative North Star: "The Walker's Atlas"**

Naarad's public surfaces pair a clear route-finding workspace with the warmth of an India travel guide. Light paper-like neutral grounds and navy text keep route facts legible; orange marks actions and sage quietly supports map-related detail. Real licensed place imagery gives routes a sense of place without taking over the task of comparing walks.

The interface is compact and practical, with visible control boundaries, straightforward dividers and a restrained radius vocabulary. The homepage brings a real Hampi photograph and an explicitly selected route-map preview together in one frame; the map catalogue gives results and map equal working importance. The homepage photograph uses a slow close-up that stops on Map or reduced motion; reduced-motion behavior is respected. Long-form story surfaces retain their distinct reading typography.

**Key Characteristics:**
- Map and route facts lead the discovery experience.
- Warm, low-chroma surfaces support navy text and orange actions.
- Compact sans-serif controls use clear boundaries and touch-friendly heights.
- Photography is factual and credited; map previews use a quiet sage ground.

## Colors

A soft neutral base carries the retained orange and navy identity, with restrained sage for map-adjacent emphasis.

### Primary
- **Trail Orange** (`#c6511b`): Solid action fills, including primary buttons.
- **Readable Orange** (`#b04512`): Orange text and links where contrast against light grounds matters.

### Neutral
- **Navy Ink** (`#12294a`): Main text and selected navigation or preview states.
- **Deep Navy** (`#0c1c33`): Dark overlays and map shadow context.
- **Trail Paper** (`#f5f6f2`): Main page ground.
- **White Surface** (`#ffffff`): Inputs, cards and control surfaces.
- **Quiet Sage** (`#6f8156`): Secondary map accent and route-card hover border.
- **Soft Divider** (`#dce1d8`): Section and card separators.
- **Map Mist** (`#e8eddf`): Map and route-preview canvas.

### Named Rules
**The Route-Facts Contrast Rule.** Keep route facts on light neutral surfaces with the dark ink palette; reserve orange text for its contrast-safe text role.

## Typography

**Display Font:** DM Sans (with Segoe UI, system-ui, sans-serif fallbacks)
**Body Font:** DM Sans (with Segoe UI, system-ui, sans-serif fallbacks)
**Label/Mono Font:** DM Sans; tabular numerals are used for route metrics.

**Character:** A single compact sans family gives the discovery interface a direct, field-ready voice. Map-first home, catalogue and route headings use the family, with size, weight and spacing providing hierarchy; long-form story surfaces retain their reading typography.

### Hierarchy
- **Display** (700, clamp 30px–46px, line-height 1.12): Homepage and route headings.
- **Headline** (700, clamp 25px–32px, line-height 1.18): Section headings.
- **Title** (700, 18px, line-height 1.25): Route-card titles.
- **Body** (400, 16px, line-height 1.6): Search introduction and running text.
- **Label** (600–700, 13–14px): Controls, compact facts and metadata.

### Named Rules
**The Map-First Sans Rule.** Use DM Sans for homepage, catalogue and route headings and interface text; long-form story surfaces retain their serif reading typography.

## Layout

The public shell uses a centered content width capped at 1440px. Discovery pages keep the introduction and search concise; on desktop, route results sit beside a dominant map in a compact two-column workspace. The homepage pairs route-finding copy with one framed media area. At widths below 768px, that hero stacks, catalogue controls adapt to mobile Map/List selection, and touch targets remain at least 44px high. The spacing rhythm most often steps through 8, 16, 24 and 32px, with tighter gaps for dense route data.

## Elevation & Depth

The map-first interface is flat by default: route and collection cards have no resting or hover shadow and do not lift. Borders, tonal surface changes and a sage hover border distinguish controls and cards. Native map markers and floating map controls retain their own localized shadows so they remain legible over map tiles.

### Shadow Vocabulary
- **Map control separation** (`0 4px 18px rgb(var(--ink-deep-rgb) / 14%)`): Native map controls above map tiles.
- **Map marker separation** (`0 2px 8px rgb(var(--ink-deep-rgb) / 35%)`): Circular route markers above variable map content.

### Named Rules
**The Flat Card Rule.** Keep route and collection cards shadow-free and stationary; use a border-color shift to mark hover.

## Shapes

The interface favors gently rounded practical controls: 8px fields and buttons, 12px larger map and media frames, and compact 5–6px badges or carousel selections. Strong dividers define boundaries instead of ornamental outlines. Map markers keep circular geometry for point locations.

## Components

### Buttons
- **Shape:** Gently rounded corners (8px).
- **Primary:** Orange action fill with white text; 44px minimum height and 17px horizontal padding.
- **Hover / Focus:** Primary interaction stays color-led without a lift; the shared visible focus outline remains clear.
- **Secondary:** Light surface with a defined border and dark text.

### Cards / Containers
- **Corner Style:** Route cards use the shared radius (12px); media is clipped to the frame.
- **Background:** White surface over the page ground.
- **Shadow Strategy:** Flat; hover changes the border to sage without movement.
- **Border:** Soft divider at rest.
- **Internal Padding:** Route-card body uses 15px with compact 8px content gaps.

### Inputs / Fields
- **Style:** White surface, 1px field edge, 8px radius; the homepage route search is 48px high with room for its leading search glyph.
- **Focus:** Shared 3px orange focus outline with 3px offset.

### Navigation
The white-surface header is compact and uses dark, medium-weight sans links. Search is a bordered 44px control on desktop; navigation retains its responsive menu behavior on narrower layouts.

### Homepage Photo and Map Preview
The hero media is one clipped frame with a 20:11 stage. The real place photograph is initially shown; visitors can explicitly select Photo or Map, use touch or keyboard controls, and select Map to stop photo motion. The controls are light, bordered surfaces over the media. Keep the map preview and original photo within this same component.

## Do's and Don'ts

**Source evidence:** `app/base.css` defines the shared palette, font stacks, controls and focus treatment; `app/map-first.css` supplies the active map-first overrides; `app/home.css`, `app/views/home.js` and `app/enhancements/index.jsx` establish the route card, photo/map carousel and its motion.

### Do:
- **Do** keep search and route facts close to the map they help visitors interpret.
- **Do** use the compact control scale and maintain 44px minimum control heights.
- **Do** keep map interaction native and preserve the explicit photo/map selection.
- **Do** honor reduced-motion preferences.
- **Do** use credited, existing place imagery and honest route facts.

### Don't:
- **Don't** add resting shadows or lift to route and collection cards.
- **Don't** make the route map compete with decorative scroll effects.
- **Don't** use orange text as though it were the solid action-fill token.
