/* A cursor for the elevation profile: move the pointer along it, or focus it and use the arrow keys, and a
   readout says how far along the walk you are and how high. Reads the samples from data-elevation on
   .elevation-wrap, so the profile itself stays a plain SVG. */

function samplesOf(wrap) {
  try { return JSON.parse(wrap.dataset.elevation || '[]'); } catch { return []; }
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
}

document.addEventListener('pointermove', (event) => {
  const wrap = event.target.closest?.('.elevation-wrap');
  if (!wrap) return;
  const box = wrap.getBoundingClientRect();
  show(wrap, (event.clientX - box.left) / box.width);
});

document.addEventListener('keydown', (event) => {
  const wrap = event.target.closest?.('.elevation-wrap');
  if (!wrap || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const now = Number(wrap.dataset.cursor ?? 0);
  const step = event.key === 'ArrowRight' ? 0.05 : event.key === 'ArrowLeft' ? -0.05 : event.key === 'Home' ? -1 : 1;
  show(wrap, event.key === 'Home' ? 0 : event.key === 'End' ? 1 : now + step);
});
