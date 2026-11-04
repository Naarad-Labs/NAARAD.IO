/** Mobile presentation only; filters, route data and the single atlas retain their owners. */
export function mountCatalogueLayout(root, { available = false, onChange = () => {} } = {}) {
  const workspace = root.querySelector('.catalogue-workspace');
  const buttons = [...root.querySelectorAll('button[data-catalogue-mode]')];
  if (!workspace) return { destroy() {} };
  let mode = 'list';
  let frame = 0;
  const choose = (next, anchor = null) => {
    if (next === 'map' && !available) return;
    mode = next === 'map' ? 'map' : 'list';
    workspace.dataset.catalogueMode = mode;
    for (const button of buttons) {
      button.disabled = button.dataset.catalogueMode === 'map' && !available;
      button.setAttribute('aria-pressed', String(button.dataset.catalogueMode === mode));
    }
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      onChange();
      const target = anchor && root.querySelector(anchor);
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.scrollIntoView({ block: 'start', behavior: 'instant' });
        target.focus({ preventScroll: true });
      }
    });
  };
  const click = (event) => {
    const button = event.target.closest('button[data-catalogue-mode]');
    if (button && root.contains(button)) choose(button.dataset.catalogueMode);
    // Reveal the list before the browser follows the map's native skip link.
    if (event.target.closest('a[href="#catalogue-grid"]')) choose('list');
  };
  const followHash = () => {
    if (location.hash === '#atlas' && available) choose('map', '#atlas');
    else if (location.hash === '#catalogue-grid') choose('list', '#catalogue-grid');
  };
  root.addEventListener('click', click);
  window.addEventListener('hashchange', followHash);
  const error = root.querySelector('[data-catalogue-map-error]');
  if (error) {
    error.hidden = available;
    if (!available) error.setAttribute('role', 'status');
  }
  choose('list');
  followHash();
  return {
    destroy() {
      cancelAnimationFrame(frame);
      root.removeEventListener('click', click);
      window.removeEventListener('hashchange', followHash);
      delete workspace.dataset.catalogueMode;
    },
  };
}
