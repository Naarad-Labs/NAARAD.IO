/* Offline state: what the visitor can and cannot open when the network is
 * down, and the plain-language bar that tells them so.
 *
 * A route page is only reachable offline if it was saved on this device.
 * Everything else (the catalogue, My Journey, stories, other sites) is
 * either already local or not part of the offline promise, so we never
 * block it. The bar is a status region: hidden when online, and when
 * offline it says what is being shown and whether anything is saved.
 */

export const UNSAVED_LABEL = 'Not saved for offline';

export function routeSlug(pathname) {
  if (typeof pathname !== 'string') return null;
  const match = pathname.match(/^\/routes\/([a-z0-9-]+)\/?$/);
  return match ? match[1] : null;
}

export function isOnline(nav) {
  return !(nav && nav.onLine === false);
}

export function blocksNavigation({ url, origin, online, savedSlugs, enabled }) {
  if (!enabled || online) {
    return { blocked: false, slug: null, reason: '' };
  }
  let parsed;
  try {
    parsed = url instanceof URL ? url : new URL(url, origin);
  } catch {
    return { blocked: false, slug: null, reason: '' };
  }
  if (parsed.origin !== origin) {
    return { blocked: false, slug: null, reason: '' };
  }
  const slug = routeSlug(parsed.pathname);
  if (!slug) {
    return { blocked: false, slug: null, reason: '' };
  }
  const saved = savedSlugs instanceof Set ? savedSlugs.has(slug) : savedSlugs.includes(slug);
  if (saved) {
    return { blocked: false, slug, reason: '' };
  }
  return {
    blocked: true,
    slug,
    reason: 'This route is not saved on this device, so it cannot be opened offline.',
  };
}

export function barModel({ online, savedCount }) {
  if (online) {
    return { visible: false, text: '' };
  }
  const text = savedCount > 0
    ? 'You are offline. Showing routes saved on this device.'
    : 'You are offline. No routes are saved on this device yet.';
  return { visible: true, text };
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderBar(model) {
  if (!model.visible) return '';
  return `<div id="offline-bar" class="offline-bar" role="status">${escapeHtml(model.text)}</div>`;
}

export function markLinks(hrefs, { origin, online, savedSlugs, enabled }) {
  return hrefs.map((href) => blocksNavigation({ url: href, origin, online, savedSlugs, enabled }).blocked);
}
