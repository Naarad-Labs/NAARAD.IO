/* The device's key-value store.
 *
 * localStorage is small, synchronous and easy for the browser to wipe, and
 * the journey, studio and event queue all want more room. This keeps one
 * in-memory copy that ready() loads once, so reads stay synchronous like
 * localStorage, and writes through to IndexedDB in the background. If
 * IndexedDB is unavailable it falls back to localStorage, then to memory
 * alone, and says so through persistence() and onFailure() instead of
 * silently losing data.
 */

const PRERENDER = Boolean(globalThis.__NAARAD_PRERENDER__);

const request = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

async function indexedDbAdapter(factory) {
  const open = factory.open('naarad', 1);
  open.onupgradeneeded = () => open.result.createObjectStore('kv');
  const db = await request(open);
  const store = (mode) => db.transaction('kv', mode).objectStore('kv');
  return {
    async load() {
      const os = store('readonly');
      const [keys, values] = await Promise.all([request(os.getAllKeys()), request(os.getAll())]);
      return new Map(keys.map((key, i) => [key, values[i]]));
    },
    write: async (key, value) => { await request(store('readwrite').put(value, key)); },
    remove: async (key) => { await request(store('readwrite').delete(key)); },
  };
}

function localStorageAdapter(storage) {
  return {
    load: async () => new Map(Array.from({ length: storage.length }, (_, i) => storage.key(i)).map((k) => [k, storage.getItem(k)])),
    write: async (key, value) => storage.setItem(key, value),
    remove: async (key) => storage.removeItem(key),
  };
}

function memoryAdapter() {
  const map = new Map();
  return {
    load: async () => new Map(map),
    write: async (key, value) => { map.set(key, value); },
    remove: async (key) => { map.delete(key); },
  };
}

async function chooseAdapter({ backend, indexedDB, adapter }) {
  if (adapter) return { adapter, kind: 'indexeddb' };
  if (backend === 'auto') {
    try {
      const factory = indexedDB === undefined ? globalThis.indexedDB : indexedDB;
      if (factory) return { adapter: await indexedDbAdapter(factory), kind: 'indexeddb' };
    } catch { /* fall through to localStorage */ }
    try {
      if (globalThis.localStorage) return { adapter: localStorageAdapter(globalThis.localStorage), kind: 'localstorage' };
    } catch { /* storage blocked */ }
  }
  return { adapter: memoryAdapter(), kind: 'memory' };
}

/**
 * `adapter` ({ load, write, remove }) replaces backend selection; tests use it
 * to stand in for a backend that fails.
 */
export function openStore({ backend = 'auto', legacy = null, migrateKeys = [], indexedDB, adapter } = {}) {
  const memory = new Map();
  const pending = new Map(); // key -> latest value, or null for a removal
  const listeners = new Set();
  let backing = null;
  let kind = 'memory';
  let failed = false; // a write-through failed: memory only from here on
  let flushing = false;
  let readyPromise = null;

  function fail(error) {
    if (failed) return;
    failed = true;
    pending.clear();
    for (const listener of listeners) listener(error instanceof Error ? error : new Error(String(error)));
  }

  /* One write at a time; a key written twice before its turn is written once, with the latest value. */
  async function flush() {
    if (flushing) return;
    flushing = true;
    try {
      while (pending.size && !failed) {
        const [key, value] = pending.entries().next().value;
        pending.delete(key);
        await (value === null ? backing.remove(key) : backing.write(key, value));
      }
    } catch (error) {
      fail(error);
    } finally {
      flushing = false;
    }
  }

  const queue = (key, value) => {
    if (!backing || failed) return;
    pending.set(key, value);
    flush();
  };

  async function migrate() {
    if (!legacy) return;
    for (const key of migrateKeys) {
      try {
        if (memory.has(key) || !backing) continue;
        const value = legacy.getItem(key);
        if (value === null) continue;
        memory.set(key, value);
        queue(key, value);
        while (flushing) await new Promise((r) => setTimeout(r, 0));
        if (failed) continue;
        if ((await backing.load()).get(key) === value) legacy.removeItem(key);
      } catch { /* leave the legacy copy in place */ }
    }
  }

  async function init() {
    try {
      const chosen = await chooseAdapter({ backend, indexedDB, adapter });
      backing = chosen.adapter;
      for (const [key, value] of await backing.load()) if (!memory.has(key)) memory.set(key, value);
      kind = chosen.kind;
    } catch (error) {
      backing = null;
      kind = 'memory';
    }
    await migrate();
  }

  return {
    ready: () => (readyPromise ||= init().catch(() => {})),
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem(key, value) {
      const text = String(value);
      memory.set(key, text);
      queue(key, text);
    },
    removeItem(key) {
      memory.delete(key);
      queue(key, null);
    },
    persistence: () => (failed ? 'memory' : kind),
    onFailure(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/* A pre-rendered page is the same for everyone, so the build neither reads
   nor writes anyone's data: the store stays in memory and ready() is instant. */
export const store = PRERENDER
  ? openStore({ backend: 'memory', legacy: null })
  : openStore({ migrateKeys: ['naarad.journey.v1', 'naarad.studio.v1'], legacy: globalThis.localStorage ?? null });
