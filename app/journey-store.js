/* My Journey, kept on the device.
 *
 * Saved routes, walks, journal entries and downloads are this visitor's own
 * record. There is no account system yet, so everything lives in
 * localStorage: nothing is invented, and the page shows what the person has
 * actually done. When accounts arrive this module is the one place to swap
 * for a server.
 */

const KEY = 'naarad.journey.v1';

/* A pre-rendered page is the same for everyone, so the build never reads or
   writes anyone's journey (main.js explains the mode). */
const PRERENDER = Boolean(globalThis.__NAARAD_PRERENDER__);

/* A new record every time: the arrays are mutated in place, so a shared one
   would carry one visitor's entries into the "empty" journey that follows. */
const empty = () => ({
  saved: [],       // [{ slug, name, location, photo, savedAt }]
  walks: [],       // [{ slug, name, location, photo, distanceM, stops, completedAt }]
  journal: [],     // [{ id, routeSlug, title, place, body, createdAt }]
  downloads: [],   // [{ slug, name, stops, sizeLabel, savedAt }]
  listened: {},    // stopSlug -> seconds listened
});

let state = null;
const listeners = new Set();

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * What was stored, kept only where it has the shape this module writes. The
 * browser's storage is the visitor's to edit and other versions have written
 * to it, so valid JSON is not enough: a field of the wrong kind falls back to
 * empty on its own, and the rest of the record is kept.
 */
function normalise(stored) {
  const record = empty();
  if (!isObject(stored)) return record;
  const entries = (list, key) => (Array.isArray(list) ? list.filter((entry) => isObject(entry) && typeof entry[key] === 'string') : []);
  record.saved = entries(stored.saved, 'slug');
  record.walks = entries(stored.walks, 'slug');
  record.journal = entries(stored.journal, 'id');
  record.downloads = entries(stored.downloads, 'slug');
  if (isObject(stored.listened)) {
    for (const [slug, seconds] of Object.entries(stored.listened)) {
      if (Number.isFinite(seconds)) record.listened[slug] = seconds;
    }
  }
  return record;
}

function read() {
  if (state) return state;
  try {
    const raw = PRERENDER ? null : localStorage.getItem(KEY);
    state = normalise(raw ? JSON.parse(raw) : null);
  } catch {
    state = empty();
  }
  return state;
}

function write() {
  try { if (!PRERENDER) localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
  listeners.forEach((listener) => { try { listener(state); } catch { /* view gone */ } });
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function all() { return { ...read() }; }

export function isSaved(slug) { return read().saved.some((entry) => entry.slug === slug); }

/** Save or unsave a route. Returns the new state for that route. */
export function toggleSaved(route) {
  const current = read();
  const existing = current.saved.findIndex((entry) => entry.slug === route.slug);
  if (existing >= 0) {
    current.saved.splice(existing, 1);
    write();
    return false;
  }
  current.saved.unshift({
    slug: route.slug,
    name: route.name,
    location: route.location || route.region || '',
    photo: route.media?.card || route.media?.photo || null,
    distanceM: route.distanceM ?? null,
    durationMin: route.durationMin ?? null,
    stops: route.stopCount || 0,
    savedAt: new Date().toISOString(),
  });
  write();
  return true;
}

export function isWalked(slug) { return read().walks.some((entry) => entry.slug === slug); }

export function completeWalk(route) {
  const current = read();
  if (current.walks.some((entry) => entry.slug === route.slug)) return false;
  current.walks.unshift({
    slug: route.slug,
    name: route.name,
    location: route.location || route.region || '',
    photo: route.media?.card || route.media?.photo || null,
    distanceM: route.distanceM ?? null,
    stops: route.stopCount || 0,
    completedAt: new Date().toISOString(),
  });
  write();
  return true;
}

export function addJournalEntry(entry) {
  const current = read();
  current.journal.unshift({
    id: `j${Date.now().toString(36)}`,
    routeSlug: entry.routeSlug || null,
    title: entry.title || 'Untitled note',
    place: entry.place || '',
    body: entry.body || '',
    photo: entry.photo || null,
    createdAt: new Date().toISOString(),
  });
  write();
}

export function removeJournalEntry(id) {
  const current = read();
  current.journal = current.journal.filter((entry) => entry.id !== id);
  write();
}

export function recordListening(stopSlug, seconds) {
  const current = read();
  current.listened[stopSlug] = Math.max(current.listened[stopSlug] || 0, Math.round(seconds));
  write();
}

/** Totals for the journey dashboard, all derived from what is stored. */
export function stats() {
  const current = read();
  const metres = current.walks.reduce((sum, walk) => sum + (Number.isFinite(walk.distanceM) ? walk.distanceM : 0), 0);
  const places = new Set(current.walks.map((walk) => walk.location).filter(Boolean)).size;
  const listenedSeconds = Object.values(current.listened).reduce((sum, value) => sum + value, 0);
  return {
    walksCompleted: current.walks.length,
    savedCount: current.saved.length,
    kilometres: metres / 1000,
    placesExplored: places,
    listenedHours: listenedSeconds / 3600,
    journalCount: current.journal.length,
    downloadCount: current.downloads.length,
    stopsHeard: Object.keys(current.listened).length,
  };
}

/** Badges a visitor has actually earned, with the next target shown. */
export function badges() {
  const totals = stats();
  const definitions = [
    { id: 'first-steps', icon: 'footprints', name: 'First Steps', need: 1, have: totals.walksCompleted, unit: 'route walked' },
    { id: 'temple-explorer', icon: 'temple', name: 'Temple Explorer', need: 5, have: totals.walksCompleted, unit: 'routes walked' },
    { id: 'heritage-listener', icon: 'headphones', name: 'Heritage Listener', need: 10, have: totals.stopsHeard, unit: 'stops heard' },
    { id: 'story-keeper', icon: 'book', name: 'Story Keeper', need: 10, have: totals.journalCount, unit: 'journal notes' },
  ];
  return definitions.map((badge) => ({ ...badge, earned: badge.have >= badge.need }));
}

export function clearAll() {
  state = empty();
  write();
}
