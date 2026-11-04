/* A cursor for the elevation profile: move the pointer along it, or focus it and use the arrow keys, and a
   readout says how far along the walk you are and how high. Reads the samples from data-elevation on
   .elevation-wrap, so the profile itself stays a plain SVG. The cursor line is positioned inside
   .elevation-plot, which holds only the SVG, so it lines up with the curve at any width. */

const parsed = new WeakMap();

function samplesOf(wrap) {
  if (!parsed.has(wrap)) {
    let samples = [];
    try { samples = JSON.parse(wrap.dataset.elevation || '[]'); } catch { /* no cursor without data */ }
    parsed.set(wrap, samples);
  }
  return parsed.get(wrap);
}

function show(wrap, fraction) {
  const samples = samplesOf(wrap);
  if (samples.length < 2) return;
  const total = samples[samples.length - 1][0] || 1;
  const target = Math.min(1, Math.max(0, fraction)) * total;
  const sample = samples.reduce((best, item) => (Math.abs(item[0] - target) < Math.abs(best[0] - target) ? item : best), samples[0]);
  const line = wrap.querySelector('.elevation-cursor');
  const readout = wrap.querySelector('.elevation-readout');
  if (line) { line.hidden = false; line.style.left = `${(sample[0] / total) * 100}%`; }
  if (readout) readout.textContent = `${(sample[0] / 1000).toFixed(1)} km along the walk · ${Math.round(sample[1])} m above sea level`;
  wrap.dataset.cursor = String(sample[0] / total);
  wrap.dispatchEvent(new CustomEvent("elevation:change", { bubbles: true, detail: { distanceM: sample[0] } }));
}

function pointer(event) {
  const wrap = event.target.closest?.('.elevation-wrap');
  const plot = wrap?.querySelector('.elevation-plot');
  if (!plot) return;
  // Pointer updates are not announced: a screen reader would be flooded. Keys are (below).
  wrap.querySelector('.elevation-readout')?.removeAttribute('aria-live');
  const box = plot.getBoundingClientRect();
  show(wrap, (event.clientX - box.left) / box.width);
}
document.addEventListener('pointermove', pointer);
document.addEventListener('pointerdown', pointer);

// Keep the inspected distance when the pointer leaves, so refocusing resumes the same selection.
document.addEventListener('focusin', (event) => {
  const wrap = event.target.closest?.('.elevation-wrap');
  if (wrap && event.target === wrap && wrap.dataset.cursor == null) show(wrap, 0);
});

document.addEventListener('keydown', (event) => {
  const wrap = event.target.closest?.('.elevation-wrap');
  if (!wrap || !['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) return;
  event.preventDefault();
  wrap.querySelector('.elevation-readout')?.setAttribute('aria-live', 'polite');
  const now = Number(wrap.dataset.cursor ?? 0);
  const move = { ArrowRight: 0.05, ArrowLeft: -0.05, PageDown: 0.25, PageUp: -0.25 }[event.key];
  show(wrap, event.key === 'Home' ? 0 : event.key === 'End' ? 1 : now + move);
});
