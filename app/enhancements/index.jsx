import { gsap } from 'gsap';
import Lenis from 'lenis';
import lenisCss from 'lenis/dist/lenis.css';

const SURFACES = '.home-featured .section-head, .voices-copy, .experience-copy, .story-section, .story-related, .info-body section, .collection-intro';
const NATIVE = 'input, textarea, select, button, a, form, [contenteditable], dialog, [role="dialog"], [role="listbox"], .maplibregl-map, .route-map, [data-lenis-prevent]';

export function mount(page, { desktop = false } = {}) {
  let disposeAccent = null;
  let accentObserver = null;
  let disposeHero = null;
  const contexts = [];
  let alive = true;
  let lenis = null;
  let tick = null;
  let style = null;
  // The native carousel owns slide and pause state. GSAP owns only the
  // photograph's gradual close-up, never its frame, credit or controls.
  const heroCarousel = page.matches('.home') ? page.querySelector('[data-hero-carousel]') : null;
  const heroPhoto = heroCarousel?.querySelector('.home-hero-photo img');
  if (heroPhoto) {
    let zoom;
    const ctx = gsap.context(() => {
      zoom = gsap.fromTo(heroPhoto, { scale: 1 }, {
        scale: 1.075, duration: 16, repeat: -1, yoyo: true,
        ease: 'sine.inOut', paused: true,
      });
    }, heroCarousel);
    contexts.push(ctx);
    const syncHeroMotion = () => {
      const running = heroCarousel.dataset.heroMode === 'photo'
        && heroCarousel.dataset.heroMotion === 'running'
        && !heroPhoto.closest('[hidden]')
        && !matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (running) zoom.resume();
      else zoom.pause();
    };
    heroCarousel.addEventListener('hero:motion', syncHeroMotion);
    syncHeroMotion();
    disposeHero = () => heroCarousel.removeEventListener('hero:motion', syncHeroMotion);
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      const ctx = gsap.context(() => {
        gsap.fromTo(entry.target, { y: 10, opacity: 0.75 }, {
          y: 0, opacity: 1, duration: 0.22, ease: 'power2.out', clearProps: 'transform,opacity',
        });
      }, page);
      contexts.push(ctx);
    }
  }, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });

  page.querySelectorAll(SURFACES).forEach((element) => {
    if (element.getBoundingClientRect().top < innerHeight) return;
    observer.observe(element);
  });

  // React and React Bits are a second, local-only optional import. Start it
  // only when a suitable below-fold heading approaches the viewport.
  const heading = [...page.querySelectorAll('.home-featured h2, .voices-copy h2, .story-section h2, .info-body h2, .collection-intro h2')]
    .find((element) => element.getBoundingClientRect().top >= innerHeight);
  if (heading) {
    accentObserver = new IntersectionObserver(async (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      accentObserver.disconnect();
      try {
        const { mountAccent } = await import('./react-accent.jsx');
        if (!alive || !page.isConnected || !heading.isConnected
            || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        disposeAccent = mountAccent(heading);
      } catch {
        // The existing editorial heading is complete without the accent.
      }
    }, { rootMargin: '0px 0px 320px 0px', threshold: 0 });
    accentObserver.observe(heading);
  }

  const resetScroll = () => {
    if (alive && lenis) lenis.scrollTo(window.scrollY, { immediate: true, force: true });
  };
  const nativeClick = (event) => {
    if (event.target.closest?.('a[href*="#"]')) resetScroll();
  };
  const nativeFocus = (event) => {
    if (event.target.closest?.(NATIVE)) resetScroll();
  };

  // Lenis affects wheel input only, on desktop prose pages with no interactive
  // map. No anchors option, touch emulation, history writes or scrollTo wrappers.
  if (desktop && page.matches('.home, .story-page, .info-page')
      && document.body.dataset.view !== 'not-found'
      && !page.querySelector('.maplibregl-map, .route-map')) {
    style = document.createElement('style');
    style.dataset.enhancement = 'lenis';
    style.textContent = lenisCss;
    document.head.append(style);
    lenis = new Lenis({
      autoRaf: false, smoothWheel: true, syncTouch: false, anchors: false,
      duration: 0.35,
      prevent: (node) => Boolean(node.closest?.(NATIVE)),
      virtualScroll: ({ event }) => {
        const native = event.type.startsWith('touch') || event.ctrlKey || event.metaKey || event.shiftKey
          || document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')
          || event.target.closest?.(NATIVE);
        if (native) resetScroll();
        return !native;
      },
    });
    // GSAP's existing ticker drives Lenis. No autoRaf or second RAF loop.
    tick = (seconds) => lenis?.raf(seconds * 1000);
    gsap.ticker.add(tick);
    window.addEventListener('popstate', resetScroll);
    window.addEventListener('hashchange', resetScroll);
    window.addEventListener('keydown', resetScroll);
    document.addEventListener('click', nativeClick);
    document.addEventListener('focusin', nativeFocus);
    document.addEventListener('toggle', resetScroll, true);
  }

  return () => {
    alive = false;
    observer.disconnect();
    accentObserver?.disconnect();
    disposeHero?.();
    disposeAccent?.();
    contexts.forEach((ctx) => ctx.revert());
    if (tick) gsap.ticker.remove(tick);
    lenis?.destroy();
    lenis = null;
    style?.remove();
    window.removeEventListener('popstate', resetScroll);
    window.removeEventListener('hashchange', resetScroll);
    window.removeEventListener('keydown', resetScroll);
    document.removeEventListener('click', nativeClick);
    document.removeEventListener('focusin', nativeFocus);
    document.removeEventListener('toggle', resetScroll, true);
  };
}
