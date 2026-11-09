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

const OPEN_TIMEOUT_MS = 1500;
const READY_TIMEOUT_MS = 3000;

const request = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

/* A write has landed only when its transaction commits, not when the request is accepted. */
const committed = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
});

async function indexedDbAdapter(factory) {
  const open = factory.open('naarad', 1);
  open.onupgradeneeded = () => open.result.createObjectStore('kv');
  const db = await new Promise((resolve, reject) => {
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
    open.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
  const write = (run) => {
    const tx = db.transaction('kv', 'readwrite');
    const done = committed(tx);
    run(tx.objectStore('kv'));
    return done;
  };
  return {
    async load() {
      const os = db.transaction('kv', 'readonly').objectStore('kv');
      const [keys, values] = await Promise.all([request(os.getAllKeys()), request(os.getAll())]);
      return new Map(keys.map((key, i) => [key, values[i]]));
    },
    write: (key, value) => write((os) => os.put(value, key)),
    remove: (key) => write((os) => os.delete(key)),
    close: () => db.close(),
  };
}

/* Reading the property itself throws when the browser blocks storage. */
function safeLocalStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

function localStorageAdapter(storage) {
  return {
    load: async () => new Map(Array.from({ length: storage.length }, (_, i) => storage.key(i)).map((k) => [k, storage.getItem(k)])),
    write: async (key, value) => storage.setItem(key, value),
    remove: async (key) => storage.removeItem(key),
  };
}

/* Non-durable: a legacy key is never deleted on the strength of this one. */
function memoryAdapter() {
  const map = new Map();
  return {
    load: async () => new Map(map),
    write: async (key, value) => { map.set(key, value); },
    remove: async (key) => { map.delete(key); },
  };
}

function withTimeout(promise, ms = OPEN_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('backend timed out'), { timedOut: true })), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/* IndexedDB, then localStorage, then memory: the first that opens and loads. */
async function chooseBackend({ backend, indexedDB, adapter }) {
  const candidates = adapter ? [['indexeddb', async () => adapter]] : [];
  if (!adapter && backend === 'auto') {
    candidates.push(['indexeddb', async () => {
      const factory = indexedDB === undefined ? globalThis.indexedDB : indexedDB;
      if (!factory) throw new Error('no IndexedDB');
      return indexedDbAdapter(factory);
    }]);
    candidates.push(['localstorage', async () => {
      const storage = safeLocalStorage();
      if (!storage) throw new Error('no localStorage');
      return localStorageAdapter(storage);
    }]);
  }
  for (const [kind, make] of candidates) {
    let made = null;
    const attempt = (async () => { made = await make(); return { adapter: made, kind, loaded: await made.load() }; })();
    try {
      return await withTimeout(attempt);
    } catch (error) {
      // A slow IndexedDB is not a broken one: a localStorage session now would strand its saves. Stay in memory, and close a late connection.
      if (error?.timedOut && kind === 'indexeddb') {
        attempt.catch(() => {}).finally(() => made?.close?.());
        break;
      }
    }
  }
  const made = memoryAdapter();
  return { adapter: made, kind: 'memory', loaded: new Map() };
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
  let flushing = null;
  let readyPromise = null;

  function fail(error) {
    if (failed) return;
    failed = true;
    pending.clear();
    for (const listener of listeners) listener(error instanceof Error ? error : new Error(String(error)));
  }

  /* One write at a time; a key written twice before its turn is written once, with the latest value. */
  function flush() {
    if (!backing || failed) return Promise.resolve();
    flushing ||= (async () => {
      await null; // so `flushing` is assigned before the loop can finish
      try {
        while (pending.size && !failed) {
          const [key, value] = pending.entries().next().value;
          pending.delete(key);
          await (value === null ? backing.remove(key) : backing.write(key, value));
        }
      } catch (error) {
        fail(error);
      }
      flushing = null; // same tick as the loop's last check: a later setItem starts a new flush
    })();
    return flushing;
  }

  /* Recorded even before ready(): flush() starts once a backend is chosen. */
  const queue = (key, value) => {
    if (failed) return;
    pending.set(key, value);
    flush();
  };

  async function migrate() {
    if (!legacy) return;
    for (const key of migrateKeys) {
      try {
        if (memory.has(key) || pending.has(key)) continue;
        const value = legacy.getItem(key);
        if (value === null) continue;
        memory.set(key, value);
        queue(key, value);
        await flush();
        if (failed || kind === 'memory') continue;
        if ((await backing.load()).get(key) === value) legacy.removeItem(key);
      } catch { /* leave the legacy copy in place */ }
    }
  }

  async function init() {
    const chosen = await chooseBackend({ backend, indexedDB, adapter });
    backing = chosen.adapter;
    kind = chosen.kind;
    // Keys set or removed before the load finished are newer than what it read.
    for (const [key, value] of chosen.loaded) if (!memory.has(key) && !pending.has(key)) memory.set(key, value);
    await flush();
    await migrate();
  }

  return {
    /* Bounded: a transaction that never commits must not hold the page's boot. The write-through carries on in the background. */
    ready: () => (readyPromise ||= withTimeout(init(), READY_TIMEOUT_MS).catch(() => {})),
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
  : openStore({ migrateKeys: ['naarad.journey.v1', 'naarad.studio.v1'], legacy: safeLocalStorage() });
