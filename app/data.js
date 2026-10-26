/* The route model.
 *
 * Two sources feed the catalogue:
 *   content/routes.json      editorial routes with stops, geometry and a real
 *                            elevation profile (scripts/build-routes.py)
 *   discover/seed-tours.json the inherited catalogue rows, which carry route
 *                            facts but no stops, geometry or elevation
 *   routes/*.geojson         recorded tracks for some Chennai routes
 *
 * A field that no source published stays null. Nothing here fills a gap with
 * a plausible-looking number.
 */

const ROUTES_URL = '/content/routes.json';
const SEED_URL = '/discover/seed-tours.json';
const TRACKS_URL = '/routes/geo-tracks.json';

const THEME_LABELS = {
  temples: 'Temples', history: 'History', nature: 'Nature', architecture: 'Architecture',
  culture: 'Living Culture', food: 'Food', art: 'Art & Music', community: 'Community',
};

let loading = null;

const titleCase = (value) => String(value || '').replace(/(^|[\s-])(\w)/g, (_, lead, char) => lead + char.toUpperCase());

export function formatDistance(metres) {
  if (metres == null) return null;
  return metres >= 1000 ? `${(metres / 1000).toFixed(metres >= 10000 ? 0 : 1)} km` : `${Math.round(metres)} m`;
}

export function formatDuration(minutes) {
  if (minutes == null) return null;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  const low = Math.floor(hours);
  const high = Math.ceil(hours);
  return low === high ? `${low} hrs` : `${low}–${high} hrs`;
}

export function formatElevation(metres) {
  return metres == null ? null : `${Math.round(metres)} m`;
}

export function formatDifficulty(value) {
  return value ? titleCase(value) : null;
}

/** A short description of the terrain, derived from the real profile. */
export function terrainLabel(route) {
  const samples = route.elevation?.samples;
  if (!samples?.length || route.distanceM == null) return null;
  const heights = samples.map((sample) => sample.e);
  const range = Math.max(...heights) - Math.min(...heights);
  const perKm = (route.ascentM || 0) / Math.max(route.distanceM / 1000, 0.1);
  if (range < 12 && perKm < 15) return 'Mostly flat';
  if (perKm < 35) return 'Mostly flat with gentle slopes';
  if (perKm < 70) return 'Rolling, with some climbs';
  return 'Steep in places';
}

function fromEditorial(route) {
  return {
    ...route,
    source: 'editorial',
    themeLabel: route.themes?.[0] || null,
    media: { photo: route.photo, card: route.cardPhoto || route.photo },
    hasStops: route.stops.length > 0,
    hasGeometry: Boolean(route.geometry?.coordinates?.length),
    hasElevation: Boolean(route.elevation?.samples?.length),
    hasAudio: route.stops.some((stop) => stop.audio),
    startLat: route.stops[0]?.lat ?? null,
    startLng: route.stops[0]?.lng ?? null,
  };
}

function fromSeed(tour) {
  const slug = tour.slug || String(tour.id);
  return {
    slug,
    name: tour.name,
    subtitle: null,
    location: tour.location_label || null,
    region: tour.location_label?.split(',').pop()?.trim() || null,
    sport: tour.sport || 'walk',
    themes: tour.theme ? [THEME_LABELS[tour.theme] || titleCase(tour.theme)] : [],
    themeLabel: tour.theme ? THEME_LABELS[tour.theme] || titleCase(tour.theme) : null,
    difficulty: tour.difficulty || null,
    routeType: tour.route_type || null,
    surface: tour.surface || null,
    distanceM: tour.distance_m ?? null,
    durationMin: tour.duration_min ?? null,
    ascentM: tour.ascent_m ?? null,
    descentM: null,
    stopCount: 0,
    stops: [],
    geometry: null,
    elevation: null,
    lede: null,
    overview: null,
    languages: [],
    media: { photo: null, card: null },
    source: 'catalogue',
    hasStops: false,
    hasGeometry: false,
    hasElevation: false,
    hasAudio: false,
    startLat: tour.start_lat ?? null,
    startLng: tour.start_lng ?? null,
  };
}

/* Revalidated on every read: a deploy that changes a file must reach a visitor
   whose browser already holds the old copy (a 304 costs almost nothing). */
async function getJson(url) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  try { return await response.json(); } catch (error) { throw new Error(`${url}: ${error.message}`); }
}

/** Tracks actually recorded on the ground, from routes/geo-tracks.json. */
async function loadTracks() {
  const data = await getJson(TRACKS_URL);
  return (data?.tracks || []).map((track) => {
    const coordinates = (track.coords || [])
      .filter((pair) => Array.isArray(pair) && pair.length >= 2)
      .map(([lat, lng]) => [lng, lat]);           // stored lat,lng; the model uses lng,lat
    return {
      slug: String(track.name || track.file || track.id).toLowerCase()
        .replace(/\.[a-z]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      name: track.name,
      type: track.type,
      distanceM: track.dist_km != null ? Math.round(track.dist_km * 1000) : null,
      center: track.center,
      coordinates,
    };
  }).filter((track) => track.coordinates.length > 1);
}

const TRACK_SPORT = { 'nature-hike': 'hike', hike: 'hike', cycle: 'cycle', ride: 'cycle' };

/* A photograph of the place a recorded track runs through, where one exists. */
const TRACK_PHOTOS = {
  'iit-madras-wildlife-walk': 'chennai-iitm',
  'marina-beach-trail': 'chennai-marina',
  'marina-lighthouse-trail': 'chennai-marina',
  'east-coast-beach-route': 'chennai-marina',
};

/** A recorded track as a route: real line, real length, no stops claimed. */
function fromTrack(track) {
  const sport = TRACK_SPORT[track.type] || 'walk';
  const pace = sport === 'cycle' ? 14000 : 4500;   // metres per hour, walking or riding
  return {
    slug: track.slug,
    name: track.name,
    subtitle: null,
    location: 'Chennai, Tamil Nadu',
    region: 'Tamil Nadu',
    sport,
    themes: ['Recorded track'],
    themeLabel: 'Recorded track',
    difficulty: null,
    routeType: null,
    surface: null,
    distanceM: track.distanceM,
    durationMin: track.distanceM ? Math.round((track.distanceM / pace) * 60) : null,
    ascentM: null,
    descentM: null,
    stopCount: 0,
    stops: [],
    geometry: {
      kind: 'recorded-track',
      note: 'A track recorded on the ground and exported from the original GPS file.',
      coordinates: track.coordinates,
    },
    elevation: null,
    lede: null,
    overview: null,
    languages: [],
    media: { photo: TRACK_PHOTOS[track.slug] || null, card: TRACK_PHOTOS[track.slug] || null },
    source: 'track',
    hasStops: false,
    hasGeometry: true,
    hasElevation: false,
    hasAudio: false,
    startLat: track.center?.[0] ?? track.coordinates[0]?.[1] ?? null,
    startLng: track.center?.[1] ?? track.coordinates[0]?.[0] ?? null,
  };
}

/**
 * Every route. A source that cannot be read rejects the load: "the data is not
 * there right now" must never look like "there is no such route", so a failed
 * load is not remembered and the next call reads the sources again.
 */
export function loadRoutes() {
  loading ||= readRoutes().catch((error) => { loading = null; throw error; });
  return loading;
}

async function readRoutes() {
  const [editorial, seed, tracks] = await Promise.all([getJson(ROUTES_URL), getJson(SEED_URL), loadTracks()]);

  const routes = (editorial.routes || []).map(fromEditorial);
  routes.push(...tracks.map(fromTrack));
  const known = new Set(routes.map((route) => route.slug));
  // An editorial route supersedes a catalogue row for the same place: the old
  // row carries no stops, line or elevation, so showing both offers the reader
  // a worse version of a route they already have.
  const covered = new Set(routes.map((route) => (route.location || '').toLocaleLowerCase()).filter(Boolean));
  const tours = Array.isArray(seed) ? seed : seed.tours || [];
  for (const tour of tours) {
    const route = fromSeed(tour);
    if (known.has(route.slug)) continue;
    if (!route.hasGeometry && covered.has((route.location || '').toLocaleLowerCase())) continue;
    routes.push(route);
    known.add(route.slug);
  }

  return routes;
}

export async function getRoute(slug) {
  const routes = await loadRoutes();
  return routes.find((route) => route.slug === slug) || null;
}

export async function featuredRoutes(count = 4) {
  const routes = await loadRoutes();
  const editorial = routes.filter((route) => route.source === 'editorial');
  // Among recorded tracks, show the shortest first: they are the ones a
  // visitor can actually walk in an afternoon.
  const mapped = routes
    .filter((route) => route.source !== 'editorial' && route.hasGeometry && route.media?.photo)
    .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
  return [...editorial, ...mapped].slice(0, count);
}

export function getStop(route, order) {
  return route?.stops?.find((stop) => stop.order === Number(order)) || null;
}

/** Routes sharing a region or theme, for "compare" and "related" rails. */
export async function relatedRoutes(route, count = 3) {
  const routes = await loadRoutes();
  const score = (candidate) => {
    if (candidate.slug === route.slug) return -1;
    let value = 0;
    if (candidate.region && candidate.region === route.region) value += 3;
    if (candidate.themes?.some((theme) => route.themes?.includes(theme))) value += 2;
    if (candidate.source === 'editorial') value += 2;
    if (candidate.hasGeometry) value += 1;
    return value;
  };
  return routes.filter((candidate) => score(candidate) > 0)
    .sort((a, b) => score(b) - score(a))
    .slice(0, count);
}
