# Vendored GSAP

- Version: 3.13.0 (`gsap.min.js`, `ScrollTrigger.min.js`, unmodified from `dist/`)
- Source: https://www.npmjs.com/package/gsap/v/3.13.0 (`npm pack gsap@3.13.0`)
- Vendored: 2026-11-09
- Licence: see LICENSE.md (file headers verbatim) and https://gsap.com/standard-license.
- Loaded on demand by `app/motion.js`, only when motion is allowed (not reduced
  motion, not Save-Data, not prerender). Counted as its own row by
  `scripts/check-budget.mjs`, not in page totals.
