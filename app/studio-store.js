/* Creator Studio drafts, kept in this browser.
 *
 * There is no creator backend yet, so a draft lives in localStorage and says
 * so in the interface. The shape here is the one a submission endpoint would
 * take, so moving to a server is a change of transport, not of model.
 */

const KEY = 'naarad.studio.v1';

/* Pre-rendering (main.js) draws the studio as a first visit sees it. */
const PRERENDER = Boolean(globalThis.__NAARAD_PRERENDER__);

const blank = (route) => ({
  id: `d${Date.now().toString(36)}`,
  routeSlug: route?.slug || null,
  routeName: route?.name || null,
  stopOrder: route?.stops?.[0]?.order || null,
  step: 'upload',
  audioName: null,
  language: 'en',
  transcript: '',
  targetLanguages: ['en'],
  title: '',
  summary: '',
  status: 'draft',
  updatedAt: new Date().toISOString(),
});

let state = null;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/* The kind of value each field of a draft holds. */
const SHAPE = {
  id: 'text', routeSlug: 'text?', routeName: 'text?', stopOrder: 'number?', step: 'text', audioName: 'text?',
  language: 'text', transcript: 'text', targetLanguages: 'texts', title: 'text', summary: 'text',
  status: 'text', updatedAt: 'text',
};

const fits = (kind, value) => ({
  text: typeof value === 'string',
  'text?': value === null || typeof value === 'string',
  'number?': value === null || Number.isFinite(value),
  texts: Array.isArray(value) && value.every((item) => typeof item === 'string'),
}[kind]);

/** A stored draft, with each field that is not the kind blank() writes replaced by blank()'s own. */
function repair(draft) {
  const fixed = blank();
  for (const [key, kind] of Object.entries(SHAPE)) if (fits(kind, draft[key])) fixed[key] = draft[key];
  return fixed;
}

/** What was stored, kept only where it has the shape this module writes. */
function normalise(stored) {
  const drafts = isObject(stored) && Array.isArray(stored.drafts)
    ? stored.drafts.filter((draft) => isObject(draft) && typeof draft.id === 'string' && draft.id).map(repair)
    : [];
  const currentId = isObject(stored) && typeof stored.currentId === 'string' ? stored.currentId : null;
  return { drafts, currentId };
}

function read() {
  if (state) return state;
  try {
    const raw = PRERENDER ? null : localStorage.getItem(KEY);
    state = normalise(raw ? JSON.parse(raw) : null);
  } catch {
    state = normalise(null);
  }
  return state;
}

function write() {
  try { if (!PRERENDER) localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

export function list() { return read().drafts.slice(); }

/** The draft being edited, created against the given route if there is none. */
export function current(route) {
  const store = read();
  let draft = store.drafts.find((entry) => entry.id === store.currentId);
  if (!draft) {
    draft = blank(route);
    store.drafts.unshift(draft);
    store.currentId = draft.id;
    write();
  }
  return draft;
}

export function update(changes) {
  const store = read();
  const draft = store.drafts.find((entry) => entry.id === store.currentId);
  if (!draft) return null;
  Object.assign(draft, changes, { updatedAt: new Date().toISOString() });
  write();
  return draft;
}

export function open(id) {
  const store = read();
  if (store.drafts.some((entry) => entry.id === id)) { store.currentId = id; write(); }
}

export function remove(id) {
  const store = read();
  store.drafts = store.drafts.filter((entry) => entry.id !== id);
  if (store.currentId === id) store.currentId = store.drafts[0]?.id || null;
  write();
}

export function startNew(route) {
  const store = read();
  const draft = blank(route);
  store.drafts.unshift(draft);
  store.currentId = draft.id;
  write();
  return draft;
}
