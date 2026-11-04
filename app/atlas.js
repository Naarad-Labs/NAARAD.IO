/* The atlas: every route on one map, and "routes near me".
 *
 * It sits above the catalogue and follows its filters. The visitor's position is read in the browser, used here to
 * sort the routes and draw one dot, and goes nowhere: nothing is sent or stored.
 */

/* map.js (Leaflet's loader) is imported when the map is drawn, not with this module: the catalogue imports this file for its
   empty frame, and must still open offline, where the map engine is not available. */
let mapTools = null;
const tools = () => { mapTools ||= import('./map.js'); return mapTools; };
import { escapeHtml } from './media.js';
import { routePath } from './urls.js';

const EARTH_RADIUS_KM = 6371;
const radians = (degrees) => (degrees * Math.PI) / 180;

/** Great-circle distance in kilometres between two { lat, lng } points. */
export function distanceKm(a, b) {
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

const validPoint = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** The routes that have a start point on the map, each with it as { lat, lng }. */
export function located(routes) {
  return routes.flatMap((route) => {
    const lat = Number(route.startLat);
    const lng = Number(route.startLng);
    return route.startLat != null && route.startLng != null && validPoint(lat, lng) ? [{ route, point: { lat, lng } }] : [];
  });
}

/** The `count` routes whose start is closest to `from`, nearest first, with their distance in km. */
export function nearest(routes, from, count = 3) {
  return located(routes)
    .map(({ route, point }) => ({ route, km: distanceKm(from, point) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, count);
}

/** "450 m", "3.4 km", "1,240 km": a distance a walker can read. */
export function formatKm(km) {
  if (km < 1) return `${Math.max(10, Math.round(km * 100) * 10)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString('en-IN')} km`;
}

const SECTION = `<section class="atlas" id="atlas" aria-labelledby="atlas-title">
  <div class="atlas-head">
    <h2 id="atlas-title" class="atlas-title">Every route on the map</h2>
    <a class="text-link" href="#catalogue-grid">Skip the map</a>
    <button type="button" class="button button-sm" data-atlas-near>Routes near me</button>
  </div>
  <div class="atlas-map nr-map-host" data-atlas-map role="region" aria-label="Map of all routes. The same routes are available in the route list."></div>
  <p class="atlas-status" data-atlas-status></p>
  <ol class="atlas-near" data-atlas-list hidden></ol>
  <p class="data-note">Your position is used on this device to sort the routes. It is not sent or kept.</p>
</section>`;

/** The empty frame, for render() to place above the catalogue so the page does not shift when the map arrives. */
export function atlasMarkup(routes) {
  return located(routes).length ? SECTION : '';
}

/**
 * Draw the atlas above the catalogue. Returns { update(slugs), destroy() }; the map needs the catalogue's
 * container to exist already, and quietly draws nothing if it does not.
 */
export async function mountAtlas(routes, { before = '.catalogue-body', isCurrent = () => true } = {}) {
  const noop = { update() {}, destroy() {} };
  if (!located(routes).length) return noop;
  if (!document.querySelector('.atlas')) {
    const anchor = document.querySelector(before);
    if (!anchor) return noop;
    anchor.insertAdjacentHTML('beforebegin', SECTION);
  }
  const section = document.querySelector('.atlas');
  const container = section.querySelector('[data-atlas-map]');
  const status = section.querySelector('[data-atlas-status]');
  status.setAttribute('role', 'status');   // live only once the map is running, so the pre-rendered page has one live region
  const list = section.querySelector('[data-atlas-list]');
  const near = section.querySelector('[data-atlas-near]');
  const state = { destroyed: false, map: null, markers: new Map(), visible: null, you: null };

  const controller = {
    get ready() { return Boolean(state.map && !state.destroyed); },
    invalidateSize() { state.map?.invalidateSize({ pan: false }); },
    update(slugs) {
      state.visible = new Set(slugs);
      if (!state.map) return;
      const L = window.L;
      const shown = [];
      for (const [slug, entry] of state.markers) {
        const on = state.visible.has(slug);
        if (on && !state.map.hasLayer(entry.marker)) entry.marker.addTo(state.map);
        if (!on && state.map.hasLayer(entry.marker)) state.map.removeLayer(entry.marker);
        if (on) shown.push(entry.latlng);
      }
      if (shown.length) state.map.fitBounds(L.latLngBounds(shown), { padding: [36, 36], maxZoom: 9 });
    },
    destroy() {
      if (state.destroyed) return;
      state.destroyed = true;
      state.resizeObserver?.disconnect();
      state.map?.remove();
      container.innerHTML = '';   // leave the empty frame the page was drawn with
    },
  };

  near.addEventListener('click', () => {
    if (!navigator.geolocation) { status.textContent = 'Location is not available in this browser.'; return; }
    status.textContent = 'Finding your location…';
    near.disabled = true;
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      near.disabled = false;
      if (state.destroyed) return;
      const from = { lat: coords.latitude, lng: coords.longitude };
      document.dispatchEvent(new CustomEvent('catalogue:near', { detail: { lng: from.lng, lat: from.lat } }));   // the catalogue sorts nearest first
      const pool = routes.filter((route) => !state.visible || state.visible.has(route.slug));
      const closest = nearest(pool, from, 3);
      status.textContent = closest.length
        ? `Nearest to you: ${closest[0].route.name}, ${formatKm(closest[0].km)} away. ${closest.length} routes are listed below, and the catalogue is sorted nearest first.`
        : 'No routes with a start point match the filters.';
      list.hidden = !closest.length;
      list.innerHTML = closest.map(({ route, km }) => `<li><a href="${routePath(route.slug)}">
        <strong>${escapeHtml(route.name)}</strong><span>${escapeHtml(route.location || route.region || 'India')} · ${formatKm(km)} away</span></a></li>`).join('');
      if (state.map) {
        const { token } = await tools();
        const L = window.L;
        state.you?.remove();
        state.you = L.circleMarker([from.lat, from.lng], {
          radius: 8, color: token('--white', '#fff'), weight: 3, fillColor: token('--ink', '#12294a'), fillOpacity: 1,
        }).addTo(state.map).bindPopup('You are here');
        const bounds = L.latLngBounds([[from.lat, from.lng], ...closest.map(({ route }) => [Number(route.startLat), Number(route.startLng)])]);
        state.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
      }
    }, () => {
      near.disabled = false;
      if (!state.destroyed) status.textContent = 'Your location could not be found. Check location access and try again.';
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
  });

  try {
    const { loadMapCss, loadLeaflet } = await tools();
    await loadMapCss();
    const L = await loadLeaflet();
    if (state.destroyed || !isCurrent()) { controller.destroy(); return noop; }
    state.map = L.map(container, { zoomControl: true, scrollWheelZoom: false, preferCanvas: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, subdomains: 'abc',
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
    }).addTo(state.map);
    for (const { route, point } of located(routes)) {
      const latlng = [point.lat, point.lng];
      const marker = L.marker(latlng, {
        icon: L.divIcon({
          className: 'nr-map-marker-shell',
          html: `<span class="atlas-dot${route.hasStops ? ' has-stories' : ''}" aria-hidden="true"></span>`,
          iconSize: [44, 44], iconAnchor: [22, 22],
        }),
        title: route.name, alt: route.name,
      });
      marker.bindPopup(`<strong>${escapeHtml(route.name)}</strong><br>${escapeHtml(route.location || route.region || 'India')}`
        + `<br><a href="${routePath(route.slug)}">View route</a>`);
      marker.on('add', () => marker.getElement()?.setAttribute('aria-label', route.name));
      state.markers.set(route.slug, { marker, latlng });
    }
    controller.update(state.visible || routes.map((route) => route.slug));
    state.resizeObserver = new ResizeObserver(() => { if (!state.destroyed) state.map?.invalidateSize({ pan: false }); });
    state.resizeObserver.observe(container);
  } catch {
    if (!state.destroyed) container.innerHTML = '<p class="map-unavailable" role="status">The map could not load. The routes are listed below.</p>';
  }
  return controller;
}
