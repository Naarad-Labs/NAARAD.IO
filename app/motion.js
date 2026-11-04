/* Optional, local-only editorial enhancements. The functional app never awaits
 * this module's bundle, and no first-viewport content is hidden or replaced. */
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
const DESKTOP = matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)');
const EDITORIAL = '.home, .story-page, .info-page, .collection-page, .collection-index';
let started = false;
let frame = 0;
let generation = 0;
let dispose = null;
let listening = false;
let bundle = null;

function stop() {
  generation += 1;
  cancelAnimationFrame(frame);
  frame = 0;
  dispose?.();
  dispose = null;
}

function onPreferenceChange() {
  // Destroy first, including in-flight imports. Turning motion back on enhances
  // only content still below the fold; it never replays the visible viewport.
  stop();
  if (!REDUCED.matches) scan(document, { settle: true });
}

function listen() {
  if (listening) return;
  REDUCED.addEventListener('change', onPreferenceChange);
  DESKTOP.addEventListener('change', onPreferenceChange);
  listening = true;
}

export function destroy() {
  stop();
  if (listening) {
    REDUCED.removeEventListener('change', onPreferenceChange);
    DESKTOP.removeEventListener('change', onPreferenceChange);
    listening = false;
  }
}

export function scan(root = document, { settle = false } = {}) {
  if (!started) return;
  listen();
  stop();
  if (REDUCED.matches) return;
  const current = generation;
  // commit() may update body.dataset.view after calling scan(). Read the new
  // page DOM on the next frame, never the old body metadata.
  frame = requestAnimationFrame(async () => {
    frame = 0;
    if (current !== generation || REDUCED.matches) return;
    const page = root.matches?.(EDITORIAL) ? root : root.querySelector(EDITORIAL);
    if (!page?.isConnected) return;
    try {
      bundle ||= import('./vendor/enhancements.js').catch((error) => { bundle = null; throw error; });
      const { mount } = await bundle;
      if (current !== generation || REDUCED.matches || !page.isConnected) return;
      dispose = mount(page, { settle, desktop: DESKTOP.matches });
    } catch {
      // A missing or uncached optional bundle leaves all static content usable.
    }
  });
}

export function start({ settle = false } = {}) {
  started = true;
  scan(document, { settle });
}
