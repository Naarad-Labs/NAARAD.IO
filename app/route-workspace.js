import { elevationPoint, elevationSamples } from './elevation-model.js';

const distanceLabel = (metres) => `${(metres / 1000).toFixed(1)} km`;

/** Connects fullscreen map movement and the route's elevation cursor. */
export function mountRouteWorkspace(root, route, map) {
  const frame = root.querySelector('.map-frame');
  const stopRail = root.querySelector('.stop-rail');
  const dialog = root.querySelector('[data-route-map-dialog]');
  const content = root.querySelector('[data-map-dialog-content]');
  const open = root.querySelector('[data-map="fullscreen"]');
  const close = root.querySelector('[data-map-dialog-close]');
  const hasDialog = Boolean(frame && dialog && content && open && close);
  let frameAnchor = null;
  let stopAnchor = null;
  let scrollTop = 0;
  let destroyed = false;

  const invalidate = () => requestAnimationFrame(() => map?.invalidateSize?.());
  const restore = () => {
    if (!hasDialog) return;
    frameAnchor?.parentNode?.insertBefore(frame, frameAnchor.nextSibling);
    if (stopRail) stopAnchor?.parentNode?.insertBefore(stopRail, stopAnchor.nextSibling);
    invalidate();
    window.scrollTo({ top: scrollTop, left: 0, behavior: 'instant' });
    if (!destroyed && open.isConnected) open.focus({ preventScroll: true });
  };
  const show = () => {
    if (destroyed || dialog.open) return;
    scrollTop = window.scrollY;
    content.prepend(frame);
    if (stopRail) content.append(stopRail);
    try {
      dialog.showModal();
      invalidate();
      close.focus({ preventScroll: true });
    } catch {
      restore();
    }
  };
  const closed = () => restore();
  const closeDialog = () => dialog.close();

  if (hasDialog) {
    frameAnchor = document.createComment('route map position');
    frame.before(frameAnchor);
    if (stopRail) {
      stopAnchor = document.createComment('route stop list position');
      stopRail.before(stopAnchor);
    }
    const empty = content.querySelector('[data-map-dialog-empty]');
    if (empty) empty.hidden = Boolean(stopRail);
    open.addEventListener('click', show);
    open.disabled = false;
    open.removeAttribute('title');
    close.addEventListener('click', closeDialog);
    dialog.addEventListener('close', closed);
  }

  const samples = elevationSamples(route);
  const range = root.querySelector('[data-elevation-range]');
  const output = root.querySelector('[data-elevation-output]');
  const profile = root.querySelector('.glance-elevation .elevation-svg');
  const min = samples[0]?.d;
  const max = samples.at(-1)?.d;
  const showDistance = (distance) => {
    const point = elevationPoint(route, distance);
    if (!point) return;
    range.value = String(point.distanceM);
    output.value = `${distanceLabel(point.distanceM)} · ${Math.round(point.elevationM)} m`;
    output.textContent = output.value;
    const wrap = root.querySelector('.elevation-wrap');
    if (wrap) {
      const fraction = point.distanceM / max;
      wrap.dataset.cursor = String(fraction);
      const line = wrap.querySelector('.elevation-cursor');
      if (line) { line.hidden = false; line.style.left = `${fraction * 100}%`; }
      const readout = wrap.querySelector('.elevation-readout');
      if (readout) readout.textContent = `${distanceLabel(point.distanceM)} along the walk · ${Math.round(point.elevationM)} m above sea level`;
    }
    map?.setElevationCursor?.(point.coordinate);
  };
  const onRange = () => { output.setAttribute('aria-live', 'polite'); showDistance(Number(range.value)); };
  const onProfileChange = (event) => { output.setAttribute('aria-live', 'off'); showDistance(event.detail.distanceM); };

  if (samples.length && range && output && profile) {
    range.addEventListener('input', onRange);
    root.addEventListener('elevation:change', onProfileChange);
    showDistance(min);
  }

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      map?.setElevationCursor?.(null);
      if (samples.length && range && output && profile) {
        range.removeEventListener('input', onRange);
        root.removeEventListener('elevation:change', onProfileChange);
      }
      if (hasDialog) {
        open.removeEventListener('click', show);
        close.removeEventListener('click', closeDialog);
        dialog.removeEventListener('close', closed);
        if (dialog.open) dialog.close();
        restore();
        frameAnchor.remove(); stopAnchor?.remove();
      }
    },
  };
}
