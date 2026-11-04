# Optional map-first enhancements

React Bits AnimatedContent is vendored source, not an npm package or a homegrown replacement. Source and license were fetched from the official repository with Firecrawl on 2026-11-04 before adaptation.

- Upstream: https://github.com/DavidHDev/react-bits
- Immutable revision: `cbfda76dcc097f643af20cf18940fc0279dbee25` (2026-10-13)
- JavaScript/CSS component source: https://github.com/DavidHDev/react-bits/blob/cbfda76dcc097f643af20cf18940fc0279dbee25/src/content/Animations/AnimatedContent/AnimatedContent.jsx
- Unmodified source snapshot: `app/enhancements/react-bits/AnimatedContent.upstream.jsx` (SHA256 `f18acb24614948733f8351479f03a06d3052ddacfb291e4cbaccead58499bab2`)
- License at the same revision: https://github.com/DavidHDev/react-bits/blob/cbfda76dcc097f643af20cf18940fc0279dbee25/LICENSE.md
- Full notice: `react-bits-LICENSE.md`; also embedded in the generated JavaScript bundle. MIT + Commons Clause, copyright David Haz 2026. This site uses the component as part of its application; it does not sell the components themselves.

`app/enhancements/react-bits/AnimatedContent.jsx` adapts the upstream ref/effect/context/timeline/fromTo path. Unused wipe, blur, perspective, staggering, disappearance, scrubbing and ScrollTrigger options were removed. A native once-only IntersectionObserver starts the timeline, distance is 8px and duration is 200ms in the shipped island. The hidden initial wrapper was removed, and the wrapper uses a span so the decorative heading insertion keeps valid phrasing content. Only below-fold decoration can receive a starting state. Reduced-motion changes revert the GSAP context and disconnect the observer; unmount also removes its media listener. The upstream snapshot is not imported or shipped as executable code.

React, ReactDOM and the React Bits adapter are code-split into a separate local chunk. A second IntersectionObserver requests that chunk only when a suitable below-fold heading enters a 320px margin below the viewport. No suitable heading means the enhancement loader does not request the React chunk. The service worker nevertheless precaches every generated chunk during background installation, so this is an execution/lifecycle optimization rather than a promise that those bytes will never be downloaded. The promise checks its mount's lifetime, page/heading connectivity and reduced motion again before touching the DOM, so navigation or preference changes during a fetch cannot mount a stale island.

The React island adds a 28px decorative accent beside one existing below-fold editorial heading. It is `aria-hidden`, has no pointer interaction and occupies zero layout width/height. React owns only that new accent; it never owns, moves or rewrites heading text, functional links, maps, audio, filters, Journey state or drafts. Pages without a suitable offscreen heading receive no React root.

## Lifecycle contract

`Motion.start({ settle })` enables enhancement scanning. `Motion.scan(root, { settle })` defers reading the current page DOM until the next animation frame, cancels a prior pending scan, and loads only `app/vendor/enhancements.js`. Both settled and fresh navigation leave already-visible content unchanged. `Motion.destroy()` must run before replacing page markup; it cancels pending frames and invalidates pending imports, unmounts React roots, reverts scoped GSAP contexts, disconnects observers, removes preference/navigation/input listeners, removes the Lenis ticker callback, destroys Lenis and removes its owned stylesheet. A later scan reattaches the preference listeners.

The bundle's `mount(page, { desktop })` returns its teardown function. Reduced motion prevents loading and destroys active enhancements when toggled. Media-query changes rebuild only remaining below-fold content. Import rejection is contained and allows a later retry. No CDN, runtime package lookup, runtime external import or prerender dependency is introduced. The later accent observer and its resulting React root are also disconnected/unmounted on teardown.

Lenis runs only on fine-pointer/hover desktop viewports at least 1024px wide and only on home, story and about prose DOM. Route/catalogue/Journey/studio pages, maps, touch input, dialog/form/control events and reduced motion use native scrolling. Wheel smoothing uses GSAP's existing ticker, with `autoRaf: false`; there is no second RAF loop, global ticker lag-smoothing mutation, history write, anchor interception or scroll restoration override. Keyboard, anchor, focus, hash and history events cancel outstanding interpolation using an immediate sync to the browser's current scroll position.

## Official API references checked

- GSAP context and revert: https://gsap.com/docs/v3/GSAP/gsap.context()/
- Lenis options, ticker integration and destroy: https://github.com/darkroomengineering/lenis
- React Bits pinned component and license above.
- esbuild ESM splitting and output naming: https://esbuild.github.io/api/#splitting

Dependency versions come from the lockfile. Their notices are retained in this directory and the bundle's preserved legal comments. Run `npm run build:enhancements` for deterministic local ESM output and fresh byte/gzip measurements. `app/vendor/enhancements-manifest.json` lists every emitted JavaScript asset in its sorted `assets` array, with per-asset raw/gzip sizes in `sizes`; offline precaching must include all listed paths. The entry statically imports the shared GSAP chunk, while its React accent chunk remains a dynamic import. Only stale files in the dedicated generated `app/vendor/enhancement-chunks/` directory are pruned after a successful build. No minified upstream artifact is downloaded at runtime.
