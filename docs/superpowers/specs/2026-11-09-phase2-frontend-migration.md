# Phase 2: Frontend Migration (React islands)

**Date**: 2026-11-09 · **Status**: draft for review · **Roadmap**: docs/superpowers/plans/2026-11-09-naarad-platform-roadmap.md

## Goal

Migrate the Explore page (and eventually other pages) to use React islands with shadcn/ui components, while keeping the site statically prerendered and preserving the 150 KB JS budget per page.

## Constraints

- **No bundler**: React UMD production builds are vendored in `app/vendor/react/` (MIT licensed).
- **Prerendered pages must load without JS**: React islands mount *after* first paint.
- **Budget**: React UMD (45 KB gzipped) + React DOM (45 KB gzipped) = 90 KB. Remaining 60 KB for the island code.
- **Graceful degradation**: If React fails to load or mount, keep the existing vanilla-JS behavior (no blank state).
- **No Tailwind CSS**: shadcn/ui components are hand-ported using the existing design tokens (`app/tokens.css`).

## Target Architecture

```
                    ┌─────────────────────────────────────┐
                    │         Statically built              │
                    │         index.html (prerendered)    │
                    └─────────────────┬───────────────────┘
                                      │
                                    /app
                                      │
        ┌───────────────────────────┴───────────────────────────┐
        │  Vanilla JS shell (app/main.js) loads React on-demand  │
        │                                                       │
        │   ┌─────────────────┐         ┌────────────────────┐  │
        │   │ app/island.js   │───────▶ │ React UMD (vendored)│  │
        │   │                 │         │                    │  │
        │   │ mountIsland()   │         │ react.production   │  │
        │   │                 │         │ react-dom.prod     │  │
        │   └─────────────────┘         └────────────────────┘  │
        │           │                                           │
        │           ▼                                           │
        │   ┌─────────────────┐                                 │
        │   │ React Root      │                                 │
        │   │ (hydrates into  │                                 │
        │   │  pre-rendered   │                                 │
        │   │  markup)        │                                 │
        │   └─────────────────┘                                 │
        └───────────────────────────────────────────────────────┘
```

## Implementation Plan

### 1. Vendor React

- Download `react.production.min.js` (10.7 KB minified)
- Download `react-dom.production.min.js` (45.1 KB minified)
- Place in `app/vendor/react/` with MIT licence file
- Update `check-budget.mjs` to count React under an "island" line (similar to GSAP)

### 2. Island Loader (`app/island.js`)

```javascript
// Minimal interface for React island mounting
export function mountIsland(containerId, Component, props = {}) {
  // Returns a cleanup function, or null if React unavailable
}
```

Features:
- Deferred loading after first paint (requestIdleCallback with 200ms fallback)
- Skips when `window.__NAARAD_PRERENDER__` is set
- Skips when `prefers-reduced-motion` or `Save-Data` is set (conservative)
- Graceful error handling: if mount fails, leaves container's existing content

### 3. Explore Island

**File**: `app/views/explore.js`

Modify the filter UI to be a React island:
- Replace manual DOM manipulation with React state
- Use existing design tokens from `app/tokens.css`
- Hand-port shadcn/ui-style components (Button, Input, FilterChip)

**Entry point modification** in `app/main.js`:
```javascript
// Lazy-load React island for explore page
if (address === '/explore/') {
  await import('./islands/explore.js').then(({ mountExploreIsland }) => {
    mountExploreIsland();
  });
}
```

### 4. Budget Accounting

Update `scripts/check-budget.mjs`:
- Add React UMD files to the size check
- Report island size separately (target: ≤ 60 KB gzipped)
- Pages that don't use islands (home, story) don't count React

### 5. Tests

- `tests/island.test.mjs`: unit test for `mountIsland()` error handling
- `e2e/site.spec.js`: add e2e test for explore filter working with/without React

## Rollout Strategy (Strangler Fig)

1. Build the Explore island behind a flag (`naarad.flag.explore-react`)
2. Deploy the flag OFF by default
3. Test internally with the flag ON
4. Gradually enable for visitors
5. Migrate other pages one at a time (Stories → Collections → Journey → Studio)

## Out of Scope

- Full Astro/Vite tooling setup
- shadcn/ui CLI (hand-code components)
- TypeScript (keep ES modules)
- Tailwind CSS

## Done When

1. React UMD vendored and checksummed
2. `app/island.js` mounts a test component, handles errors gracefully
3. Explore page filter works as a React island when flag is on
4. `check-budget.mjs` reports React size separately
5. All tests pass, verify.sh green

## References

- Phase 1: docs/superpowers/specs/2026-11-09-phase1-foundations-design.md
- React islands article: https://react.dev/reference/react-dom/client/hydrateRoot
- shadcn/ui patterns: copied component patterns, not the library itself