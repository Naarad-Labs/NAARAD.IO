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
 */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');

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

function reveal(element) {
  element.dataset.reveal = 'in';
  const parts = element.querySelectorAll(PARTS);
  parts.forEach((part, index) => {
    // 70ms apart: the heading, then its text, then the picture.
    part.style.transitionDelay = `${Math.min(index * 70, 420)}ms`;
  });
}

/** Watch everything in `root` that is allowed to move. */
export function scan(root = document) {
  if (!observer) return;
  root.querySelectorAll(SECTIONS).forEach((element) => {
    if (seen.has(element)) return;
    seen.add(element);
    element.dataset.reveal = 'out';
    observer.observe(element);
  });
}

export function start() {
  if (REDUCED.matches || !('IntersectionObserver' in window)) return;
  document.documentElement.dataset.motion = 'on';
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      reveal(entry.target);
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  scan(document);

  // If someone turns reduced motion on mid-visit, show everything and stop.
  REDUCED.addEventListener?.('change', (event) => {
    if (!event.matches) return;
    observer?.disconnect();
    observer = null;
    delete document.documentElement.dataset.motion;
  });
}
