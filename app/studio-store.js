/* Creator Studio drafts, kept in this browser.
 *
 * There is no creator backend yet, so a draft lives in localStorage and says
 * so in the interface. The shape here is the one a submission endpoint would
 * take, so moving to a server is a change of transport, not of model.
 */

const KEY = 'naarad.studio.v1';

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

function read() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? JSON.parse(raw) : { drafts: [], currentId: null };
  } catch {
    state = { drafts: [], currentId: null };
  }
  if (!Array.isArray(state.drafts)) state.drafts = [];
  return state;
}

function write() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
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
