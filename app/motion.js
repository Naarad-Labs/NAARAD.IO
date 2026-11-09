/* The motion layer.
 *
 * The plan's motion rules: transforms and opacity only, CSS transitions rather
 * than a library, and almost no decorative movement where someone is actually
 * walking a route. So editorial surfaces (home, stories, the catalogue, the
 * journal) get entrances and a gentle reveal on photographs, and the route
 * workspace — map, stop rail, the story being read on the walk — is left still.
 *
 * Nothing is hidden until this module is running: the hidden state lives under
 * html[data-motion='on'], which is only set when the observer is ready and the
 * reader has not asked for reduced motion. With no script, or with reduced
 * motion, every element is simply visible.
 *
 * A pre-rendered page is already on screen when this runs, so start() is told
 * to settle: what the reader can already see stays exactly as it is, and only
 * what is still below the fold waits to come in. Pre-rendering itself never
 * starts motion (main.js), so no hidden state is ever written into a page.
 */

// Guarded so the pure helpers below can be imported (and tested) outside a browser.
const REDUCED = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

/** GSAP is only fetched when none of these ask us not to move or not to spend bytes. */
export const motionAllowed = ({ reducedMotion, saveData, prerender }) => !(reducedMotion || saveData || prerender);

/** "5.2 km" at 0 -> "0.0 km"; every number scales with `progress`, keeping its decimals and unit.
 *  Returns the final text if progress is invalid (NaN, negative, or >= 1). */
export function countUpText(finalText, progress) {
  if (progress >= 1) return finalText;
  if (!Number.isFinite(progress) || progress < 0) return finalText;
  return finalText.replace(/\d+(?:\.\d+)?/g, (n) => {
    const value = Number(n) * progress;
    if (!Number.isFinite(value) || isNaN(value)) return n;
    return value.toFixed(n.split('.')[1]?.length || 0);
  });
}

let gsap = null;   // set once the vendored build has loaded; until then the CSS reveal runs

/* Surfaces that may animate. The route workspace is deliberately absent. */
const SECTIONS = [
  '.home-hero-copy', '.home-featured .section-head', '.route-card',
  '.voices-copy', '.voices-panel', '.voices-languages',
  '.experience-copy', '.magazine-page', '.experience-points li',
  '.catalogue-hero', '.story-section', '.story-hero-copy', '.story-route-card', '.story-related',
  '.info-hero-copy', '.info-body section', '.journey-hero-copy', '.journey-overview',
  '.journey-section', '.journal-note', '.badge', '.studio-hero-copy',
].join(',');

/* Parts inside a revealed surface that come in one after another. */
const PARTS = ':scope > .eyebrow, :scope > h1, :scope > h2, :scope > h3, :scope > p, '
  + ':scope > .lede, :scope > .button, :scope > .text-link, :scope > picture, '
  + ':scope > .chip-list, :scope > ul, :scope > ol, :scope > .metric-row';

let observer = null;
const seen = new WeakSet();

/* Only called for cards that enter after load: settled ones never reach reveal(). */
function countUp(card) {
  const nodes = [...card.querySelectorAll('.route-card-metrics > span')]
    .flatMap((span) => [...span.childNodes].filter((n) => n.nodeType === 3 && /\d/.test(n.data)));
  nodes.forEach((node) => {
    const final = node.data;
    const tick = { p: 0 };
    node.data = countUpText(final, 0);
    gsap.to(tick, { p: 1, duration: 0.9, ease: 'power2.out', onUpdate: () => { node.data = countUpText(final, tick.p); }, onComplete: () => { node.data = final; } });
  });
}

function reveal(element) {
  element.dataset.reveal = 'in';
  const parts = element.querySelectorAll(PARTS);
  if (gsap) {
    gsap.fromTo(parts.length ? parts : element, { autoAlpha: 0, y: 16 },
      { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.07, clearProps: 'opacity,visibility,transform' });
    if (element.matches('.route-card')) countUp(element);
    return;
  }
  parts.forEach((part, index) => {
    // 70ms apart: the heading, then its text, then the picture.
    part.style.transitionDelay = `${Math.min(index * 70, 420)}ms`;
  });
}

const onScreen = (element) => {
  const box = element.getBoundingClientRect();
  return box.bottom > 0 && box.top < innerHeight && box.width > 0;
};

/**
 * Watch everything in `root` that is allowed to move. With `settle`, anything
 * the reader can already see is left alone instead of hidden and replayed.
 */
export function scan(root = document, { settle = false } = {}) {
  if (!observer) return;
  root.querySelectorAll(SECTIONS).forEach((element) => {
    if (seen.has(element)) return;
    seen.add(element);
    if (settle && onScreen(element)) return;
    element.dataset.reveal = 'out';
    observer.observe(element);
  });
}

function loadGsap() {
  const script = document.createElement('script');
  script.src = '/app/vendor/gsap/gsap.min.js';
  script.onload = () => { gsap = window.gsap; document.documentElement.dataset.gsap = 'on'; };
  // On failure nothing changes: the CSS reveal keeps running.
  script.onerror = () => script.remove();
  document.head.append(script);
}

export function start({ settle = false } = {}) {
  if (REDUCED.matches || !('IntersectionObserver' in window)) return;
  document.documentElement.dataset.motion = 'on';
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      reveal(entry.target);
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  scan(document, { settle });
  const allowed = motionAllowed({ reducedMotion: REDUCED.matches, saveData: Boolean(navigator.connection?.saveData), prerender: Boolean(window.__NAARAD_PRERENDER__) });
  if (allowed) (window.requestIdleCallback || ((fn) => setTimeout(fn, 1500)))(loadGsap, { timeout: 1500 });

  // If someone turns reduced motion on mid-visit, show everything and stop.
  REDUCED.addEventListener?.('change', (event) => {
    if (!event.matches) return;
    observer?.disconnect();
    observer = null;
    delete document.documentElement.dataset.motion;
    delete document.documentElement.dataset.gsap;
    gsap = null;
  });
}
