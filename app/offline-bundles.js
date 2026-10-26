/* Offline route bundles, behind a flag.
 *
 * A bundle is one route kept on this device: its page, the code and data that
 * page loaded, and its photographs, in a cache of their own that the service
 * worker reads when the network fails. It is off unless the visitor's browser
 * has the flag set, so nothing changes for anyone else:
 *
 *   ?offline-bundles=on   turn it on in this browser (=off turns it off again)
 *
 * What is NOT in a bundle, and the interface says so:
 *   - Map tiles. OpenStreetMap's policy forbids bulk or offline prefetch from
 *     its servers, and Esri's terms are not ours to override. Offline, the route
 *     page shows its static line and stops drawn from the route's own data.
 *   - Audio. No creator has recorded any yet; the listening bar reads the stop
 *     text with the device's own voice, which works without a network.
 *
 * A download is all or nothing: every file is fetched first and written to the
 * cache only if all of them arrived, so a dropped connection keeps nothing.
 */

export const FLAG_KEY = 'naarad.flag.offline-bundles';
export const BUNDLE_CACHE = 'naarad-bundles';
export const BUNDLE_VERSION = 1;

/* The widths a phone asks for. Larger ones are left out to keep a bundle small. */
export const MAX_PHOTO_WIDTH = 960;

const PRERENDER = Boolean(globalThis.__NAARAD_PRERENDER__);
const SAME_SITE = ['/app/', '/content/', '/discover/', '/routes/', '/Images/'];

export function enabled() {
  if (PRERENDER) return false;       // a pre-rendered page is the same for everyone
  try {
    const param = new URLSearchParams(globalThis.location.search).get('offline-bundles');
    if (param === 'on' || param === 'off') globalThis.localStorage.setItem(FLAG_KEY, param);
    return globalThis.localStorage.getItem(FLAG_KEY) === 'on';
  } catch { return false; }
}

export function supported() {
  return Boolean(globalThis.caches && globalThis.navigator && 'serviceWorker' in globalThis.navigator);
}

/** "url 640w, url 960w" -> [{ url, width }] */
export function parseSrcset(srcset) {
  return String(srcset || '').split(',').map((part) => part.trim()).filter(Boolean).map((part) => {
    const [url, descriptor] = part.split(/\s+/);
    const width = descriptor && /w$/.test(descriptor) ? Number(descriptor.slice(0, -1)) : Infinity;
    return { url, width };
  });
}

/* Which files make up the bundle for a route. Same-origin only (so no map
   tiles, ever), only the site's own folders, no service worker, and photographs
   no wider than MAX_PHOTO_WIDTH. Sorted, so the same page gives the same list. */
export function selectUrls({ origin, slug, resources = [], srcsets = [], images = [] }) {
  const out = new Set([`/routes/${slug}/`]);
  const add = (raw) => {
    let url;
    try { url = new URL(raw, origin); } catch { return; }
    if (url.origin !== origin) return;
    if (!SAME_SITE.some((prefix) => url.pathname.startsWith(prefix))) return;
    out.add(url.pathname);
  };
  resources.forEach(add);
  images.forEach(add);
  srcsets.forEach((srcset) => parseSrcset(srcset).forEach(({ url, width }) => { if (width <= MAX_PHOTO_WIDTH) add(url); }));
  return [...out].sort();
}

export function sizeLabel(bytes) {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Keep this route on the device. Throws, and keeps nothing, if any file fails. */
export async function download(route, env = {}) {
  const {
    fetchImpl = globalThis.fetch.bind(globalThis),
    cacheStorage = globalThis.caches,
    origin = globalThis.location.origin,
    doc = globalThis.document,
    perf = globalThis.performance,
  } = env;

  const urls = selectUrls({
    origin,
    slug: route.slug,
    resources: perf.getEntriesByType('resource').map((entry) => entry.name),
    srcsets: [...doc.querySelectorAll('.route-page picture source')].map((source) => source.getAttribute('srcset') || ''),
    images: [...doc.querySelectorAll('.route-page picture img')].map((img) => img.getAttribute('src') || ''),
  });

  const fetched = [];
  let bytes = 0;
  for (const path of urls) {
    const response = await fetchImpl(path, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`${path} answered ${response.status}`);
    bytes += (await response.clone().arrayBuffer()).byteLength;
    fetched.push([path, response]);
  }
  const cache = await cacheStorage.open(BUNDLE_CACHE);
  for (const [path, response] of fetched) await cache.put(path, response);
  return { urls, bytes, label: sizeLabel(bytes), version: BUNDLE_VERSION };
}

/** Remove one route's copy. Files another downloaded route also needs are kept. */
export async function remove(slug, downloads, env = {}) {
  const { cacheStorage = globalThis.caches } = env;
  const mine = downloads.find((entry) => entry.slug === slug);
  if (!mine) return 0;
  const shared = new Set(downloads.filter((entry) => entry.slug !== slug).flatMap((entry) => entry.urls || []));
  const cache = await cacheStorage.open(BUNDLE_CACHE);
  let deleted = 0;
  for (const path of mine.urls || []) {
    if (!shared.has(path) && await cache.delete(path)) deleted += 1;
  }
  return deleted;
}
