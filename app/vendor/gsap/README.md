# Vendored GSAP

- Version: 3.13.0 (`gsap.min.js`, `ScrollTrigger.min.js`, unmodified from `dist/`)
- Source: https://www.npmjs.com/package/gsap/v/3.13.0 (`npm pack gsap@3.13.0`)
- Vendored: 2026-11-09
- Licence: GreenSock Standard "No Charge" licence, https://gsap.com/standard-license
  (see LICENSE.md). Free for commercial use, including when visitors pay nothing
  to use Naarad; not allowed inside a no-code visual animation builder that
  competes with Webflow; copyright notices in the files must stay. Naarad is neither
  of those problems. Re-read the terms before changing what Naarad charges for or
  building an animation tool.
- Loaded on demand by `app/motion.js`, only when motion is allowed (not reduced
  motion, not Save-Data, not prerender). Counted as its own row by
  `scripts/check-budget.mjs`, not in page totals.
