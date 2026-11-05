/* The route catalogue API.
 *
 * The catalogue has two faces. When the Naarad backend is live, every call
 * here goes to it: the catalogue is served, filtered and paginated by the
 * server, and a visitor's own imports come back only to them. When it is not,
 * the same calls fall through to the static route model in data.js, which
 * loads everything from files into this tab. The two are interchangeable at
 * the call site, so a view never has to know which one answered.
 *
 * The contract is the same either way: a page is a list of route summaries,
 * a route is the full model, and a bbox query is the routes whose start lies
 * inside a rectangle. What differs is who filters, who pages and who owns the
 * result.
 *
 * Cursor pagination. The server answers "give me the next page after this
 * id", so a page carries a `nextCursor` and the caller asks again with it.
 * Nothing here invents a page number: the catalogue is a feed, not a book.
 */

import * as Data from './data.js';
import { backend } from './backend.js';
import { API_ENABLED } from './config.js';

const API_BASE = '/v1';
const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;

/** A bounded, well-known page size. The caller may ask for more; we cap it. */
const pageSize = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(n), MAX_PAGE_SIZE);
};

/** Query string from a filter object, skipping null, undefined and empty strings. */
const query = (params = {}) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  return search.toString();
};

/** A route summary, the shape every list endpoint returns. */
const summary = (route) => ({
  slug: route.slug,
  name: route.name,
  location: route.location,
  region: route.region,
  sport: route.sport,
  themes: route.themes,
  difficulty: route.difficulty,
  distanceM: route.distanceM,
  durationMin: route.durationMin,
  stopCount: route.stopCount,
  hasStops: route.hasStops,
  hasGeometry: route.hasGeometry,
  hasAudio: route.hasAudio,
  startLat: route.startLat,
  startLng: route.startLng,
  media: route.media,
  source: route.source,
});

/** The same shape, but only the fields a map needs. */
const mapPoint = (route) => ({
  slug: route.slug,
  name: route.name,
  startLat: route.startLat,
  startLng: route.startLng,
  hasStops: route.hasStops,
  hasGeometry: route.hasGeometry,
  location: route.location,
});

/**
 * Every route in the catalogue, paged.
 *
 * @param {object} params  Filters plus paging. `cursor` starts a new page;
 *                         without it, the first page. `limit` is capped.
 * @returns {Promise<{ items, nextCursor, total, hasMore }>}
 */
export async function loadRoutesPage(params = {}) {
  if (!API_ENABLED) return Data.loadRoutesPage(params);

  const limit = pageSize(params.limit);
  const search = query({
    q: params.query,
    sport: params.sport,
    region: params.region,
    stories: params.withStories ? '1' : undefined,
    d: params.distance,
    t: params.time,
    lv: params.level,
    lang: params.lang,
    sort: params.sort,
    limit,
    cursor: params.cursor,
  });
  const suffix = search ? `?${search}` : '';
  const result = await backend.apiGet(`${API_BASE}/routes${suffix}`);
  return {
    items: (result.items || []).map(summary),
    nextCursor: result.nextCursor || null,
    total: Number(result.total) || 0,
    hasMore: Boolean(result.nextCursor),
  };
}

/**
 * One route, by slug. Null when there is no such route; throws when the
 * backend itself is down, so a failure is never mistaken for an empty page.
 */
export async function loadRoute(slug) {
  if (!backend.configured()) return Data.getRoute(slug);
  const route = await backend.apiGet(`${API_BASE}/routes/${encodeURIComponent(slug)}`);
  return route ? Data.normalizeRoute(route) : null;
}

/**
 * The routes whose start lies inside a bounding box, for the all-routes map.
 * The box is [minLng, minLat, maxLng, maxLat]. Bounded to the visible area so
 * a wide-open request cannot come back with the whole catalogue.
 */
export async function loadRoutesInBbox(bbox) {
  if (!backend.configured()) {
    const all = await Data.loadRoutes();
    const [minLng, minLat, maxLng, maxLat] = bbox;
    return all
      .filter((route) => route.startLat != null && route.startLng != null
        && route.startLng >= minLng && route.startLng <= maxLng
        && route.startLat >= minLat && route.startLat <= maxLat)
      .map(mapPoint);
  }
  const search = query({
    minLng: bbox[0], minLat: bbox[1], maxLng: bbox[2], maxLat: bbox[3],
    limit: MAX_PAGE_SIZE,
  });
  const result = await backend.apiGet(`${API_BASE}/routes/map?${search}`);
  return (result.items || result.routes || []).map(mapPoint);
}

/** A route's offline bundle, or null when none has been built yet. */
export async function loadBundles(slug) {
  if (!backend.configured()) return null;
  return backend.apiGet(`${API_BASE}/routes/${encodeURIComponent(slug)}/bundles`);
}

/** Submit a route import. Returns the import row, with its review state. */
export async function importRoute(body) {
  if (!backend.configured()) throw new Error('Imports need the Naarad backend, which is not part of this build.');
  return backend.apiPost(`${API_BASE}/imports`, { body });
}

/** One import, by id, for a progress poll. */
export async function getImport(id) {
  if (!backend.configured()) throw new Error('Imports need the Naarad backend, which is not part of this build.');
  return backend.apiGet(`${API_BASE}/imports/${encodeURIComponent(id)}`);
}