/* Naarad service worker.
 *
 * Static files are served cache-first and versioned by CACHE: bump VERSION
 * whenever the shell, a view module or a stylesheet changes, or visitors keep
 * the old one. Content JSON is served network-first so new routes and stories
 * appear without a new worker. Photographs and map tiles are cached as they
 * are used, with the tile cache kept small.
 */

const VERSION = 'v9';
const SHELL = `naarad-shell-${VERSION}`;
const CONTENT = `naarad-content-${VERSION}`;
const MEDIA = `naarad-media-${VERSION}`;
const TILES = `naarad-tiles-${VERSION}`;
const TILE_LIMIT = 220;

/* The shell: everything the homepage needs to render offline. */
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/app/base.css',
  '/app/home.css',
  '/app/main.js',
  '/app/data.js',
  '/app/media.js',
  '/app/icons.js',
  '/app/previews.js',
  '/app/audio.js',
  '/app/journey-store.js',
  '/app/studio-store.js',
  '/app/views/home.js',
  '/app/fonts/DMSans.woff2',
  '/app/fonts/PlayfairDisplay.woff2',
  '/app/fonts/Caveat-latin.woff2',
  '/Images/cropped_logo.png',
];

const isContent = (url) => url.pathname.startsWith('/content/') || url.pathname.startsWith('/discover/') || url.pathname.startsWith('/routes/');
const isMedia = (url) => url.pathname.startsWith('/Images/');
const isTile = (url) => /tile\.openstreetmap\.org|server\.arcgisonline\.com/.test(url.host);
const isAppCode = (url) => url.pathname.startsWith('/app/');

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // One missing file must not fail the whole install.
    await Promise.all(SHELL_ASSETS.map((asset) => cache.add(asset).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL, CONTENT, MEDIA, TILES]);
    const names = await caches.keys();
    await Promise.all(names.filter((name) => !keep.has(name)).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function trim(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  await Promise.all(keys.slice(0, keys.length - limit).map((key) => cache.delete(key)));
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (isTile(url)) {
    event.respondWith(cacheFirst(request, TILES).then(async (response) => {
      await trim(TILES, TILE_LIMIT);
      return response;
    }).catch(() => Response.error()));
    return;
  }

  if (url.origin !== location.origin) return;

  if (isContent(url)) { event.respondWith(networkFirst(request, CONTENT)); return; }
  if (isMedia(url)) { event.respondWith(cacheFirst(request, MEDIA)); return; }
  if (isAppCode(url)) { event.respondWith(cacheFirst(request, SHELL)); return; }

  // Navigations: every route resolves to the one shell document.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch (error) {
        const cache = await caches.open(SHELL);
        return (await cache.match('/index.html')) || (await cache.match('/')) || Response.error();
      }
    })());
  }
});
