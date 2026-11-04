/** Photo/map presentation only; no timer advances slides or owns the route map. */
export function mountHeroCarousel(root) {
  const carousel = root.querySelector('[data-hero-carousel]');
  if (!carousel) return { destroy() {} };
  const slides = [...carousel.querySelectorAll('[data-hero-slide]')];
  const choices = [...carousel.querySelectorAll('[data-hero-select]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let mode = 'photo';
  let gesture = null;
  let suppressClickUntil = 0;
  const update = () => {
    carousel.dataset.heroMode = mode;
    carousel.dataset.heroMotion = reduced.matches ? 'paused' : 'running';
    for (const slide of slides) {
      const selected = slide.dataset.heroSlide === mode;
      slide.hidden = !selected;
      slide.setAttribute('aria-hidden', String(!selected));
      slide.id = `hero-slide-${slide.dataset.heroSlide}`;
    }
    for (const button of choices) {
      button.disabled = false;
      button.setAttribute('aria-pressed', String(button.dataset.heroSelect === mode));
      button.setAttribute('aria-controls', `hero-slide-${button.dataset.heroSelect}`);
    }
    carousel.dispatchEvent(new CustomEvent('hero:motion', { bubbles: true }));
  };
  const click = (event) => {
    if (Date.now() < suppressClickUntil) {
      event.preventDefault(); event.stopPropagation(); return;
    }
    const button = event.target.closest('[data-hero-select]');
    if (button) { mode = button.dataset.heroSelect === 'map' ? 'map' : 'photo'; update(); }
  };
  const key = (event) => {
    if (!event.target.closest('[data-hero-select]') || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    mode = event.key === 'Home' ? 'photo' : event.key === 'End' ? 'map' : mode === 'photo' ? 'map' : 'photo';
    update(); choices.find((button) => button.dataset.heroSelect === mode)?.focus({ preventScroll: true });
  };
  const down = (event) => {
    if (event.pointerType === 'touch' && event.target.closest('.hero-carousel-stage')) gesture = { x: event.clientX, y: event.clientY };
  };
  const up = (event) => {
    if (!gesture) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    gesture = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    mode = mode === 'photo' ? 'map' : 'photo'; suppressClickUntil = Date.now() + 400; update();
  };
  const cancel = () => { gesture = null; };
  carousel.addEventListener('click', click, true);
  carousel.addEventListener('keydown', key);
  carousel.addEventListener('pointerdown', down, { passive: true });
  carousel.addEventListener('pointerup', up, { passive: true });
  carousel.addEventListener('pointercancel', cancel);
  reduced.addEventListener('change', update);
  update();
  return { destroy() {
    carousel.removeEventListener('click', click, true);
    carousel.removeEventListener('keydown', key);
    carousel.removeEventListener('pointerdown', down);
    carousel.removeEventListener('pointerup', up);
    carousel.removeEventListener('pointercancel', cancel);
    reduced.removeEventListener('change', update);
  } };
}
