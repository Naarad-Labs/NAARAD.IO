import test from 'node:test';
import assert from 'node:assert/strict';
import { openStore } from '../app/idb.js';

const fakeLegacy = (seed = {}) => {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
};
/* A durable backend that records what reaches it. */
const durable = (opts = {}) => {
  const disk = new Map(opts.disk || []);
  const log = [];
  return {
    disk, log,
    load: async () => { if (opts.loadFails) throw new Error('load'); return new Map(disk); },
    write: async (k, v) => { log.push(['write', k, v]); if (opts.writeFails) throw new Error('quota'); if (!opts.dropWrites) disk.set(k, v); },
    remove: async (k) => { log.push(['remove', k]); disk.delete(k); },
  };
};
const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));
/* globalThis.localStorage swapped for the length of fn; a function value becomes a throwing getter. */
async function withLocalStorage(value, fn) {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, ...(typeof value === 'function' ? { get: value } : { value }) });
  try { return await fn(); } finally {
    if (had) Object.defineProperty(globalThis, 'localStorage', had); else delete globalThis.localStorage;
  }
}
const JOURNEY = 'naarad.journey.v1';
const KEYS = [JOURNEY, 'naarad.studio.v1'];

test('getItem returns what setItem stored, removeItem clears, unknown is null', async () => {
  const s = openStore({ backend: 'memory', legacy: null });
  await s.ready();
  assert.equal(s.getItem('a'), null);
  s.setItem('a', '1');
  assert.equal(s.getItem('a'), '1');
  s.removeItem('a');
  assert.equal(s.getItem('a'), null);
});

test('migration copies the legacy value and deletes the legacy key once the backend holds it', async () => {
  const adapter = durable();
  const legacy = fakeLegacy({ [JOURNEY]: '{"saved":[]}' });
  const s = openStore({ adapter, legacy, migrateKeys: KEYS });
  await s.ready();
  assert.equal(s.getItem(JOURNEY), '{"saved":[]}');
  assert.equal(adapter.disk.get(JOURNEY), '{"saved":[]}');
  assert.equal(legacy.getItem(JOURNEY), null);
});

test('a memory-only backend never deletes the legacy key', async () => {
  const legacy = fakeLegacy({ [JOURNEY]: 'x' });
  const s = openStore({ backend: 'memory', legacy, migrateKeys: KEYS });
  await s.ready();
  assert.equal(s.getItem(JOURNEY), 'x');
  assert.equal(legacy.getItem(JOURNEY), 'x');
});

test('a rejecting write keeps the legacy key', async () => {
  const legacy = fakeLegacy({ [JOURNEY]: 'x' });
  const s = openStore({ adapter: durable({ writeFails: true }), legacy, migrateKeys: KEYS });
  await s.ready();
  assert.equal(legacy.getItem(JOURNEY), 'x');
  assert.equal(s.persistence(), 'memory');
});

test('a read-back that differs keeps the legacy key', async () => {
  const legacy = fakeLegacy({ [JOURNEY]: 'x' });
  const s = openStore({ adapter: durable({ dropWrites: true }), legacy, migrateKeys: KEYS });
  await s.ready();
  assert.equal(legacy.getItem(JOURNEY), 'x');
});

test('a setItem made while the migration write is in flight wins, and the legacy key is kept', async () => {
  const disk = new Map();
  const gates = [];
  const adapter = {
    load: async () => new Map(disk),
    write: (k, v) => new Promise((resolve) => gates.push(() => { disk.set(k, v); resolve(); })),
    remove: async (k) => { disk.delete(k); },
  };
  const legacy = fakeLegacy({ [JOURNEY]: 'old' });
  const s = openStore({ adapter, legacy, migrateKeys: KEYS });
  const ready = s.ready();
  await tick(); // the migration write is now pending
  assert.equal(gates.length, 1);
  s.setItem(JOURNEY, 'new');
  gates.shift()();
  await tick();
  gates.shift()();
  await ready;
  assert.equal(s.getItem(JOURNEY), 'new');
  assert.equal(disk.get(JOURNEY), 'new');
  assert.equal(legacy.getItem(JOURNEY), 'old');
});

test('ready() resolves within its bound when a write never settles, and the legacy key is kept', async () => {
  const adapter = { load: async () => new Map(), write: () => new Promise(() => {}), remove: async () => {} };
  const legacy = fakeLegacy({ [JOURNEY]: 'x' });
  const s = openStore({ adapter, legacy, migrateKeys: KEYS });
  const started = Date.now();
  await s.ready();
  assert.ok(Date.now() - started < 3500);
  assert.equal(s.getItem(JOURNEY), 'x');
  assert.equal(legacy.getItem(JOURNEY), 'x');
});

test('writes and removes made before ready() reach the backend, and a removed key stays removed', async () => {
  const adapter = durable({ disk: [['gone', 'old'], ['kept', 'k']] });
  const s = openStore({ adapter, legacy: null });
  s.setItem('early', '1');
  s.removeItem('gone');
  await s.ready();
  await tick();
  assert.equal(s.getItem('gone'), null);
  assert.equal(s.getItem('early'), '1');
  assert.equal(s.getItem('kept'), 'k');
  assert.equal(adapter.disk.get('early'), '1');
  assert.equal(adapter.disk.has('gone'), false);
});

test('migration is skipped when the store already has the key', async () => {
  const legacy = fakeLegacy({ [JOURNEY]: 'old' });
  const s = openStore({ backend: 'memory', legacy, migrateKeys: KEYS });
  s.setItem(JOURNEY, 'new');
  await s.ready();
  assert.equal(s.getItem(JOURNEY), 'new');
  assert.equal(legacy.getItem(JOURNEY), 'old');
});

test('a second store over the same backend and legacy after migration leaves one copy and no legacy key', async () => {
  const adapter = durable();
  const legacy = fakeLegacy({ [JOURNEY]: 'x' });
  const first = openStore({ adapter, legacy, migrateKeys: KEYS });
  await first.ready();
  await first.ready();
  const second = openStore({ adapter, legacy, migrateKeys: KEYS });
  await second.ready();
  assert.equal(second.getItem(JOURNEY), 'x');
  assert.equal(legacy.getItem(JOURNEY), null);
  assert.equal(adapter.log.filter(([, k]) => k === JOURNEY).length, 1);
});

test('a throwing indexedDB falls back to memory and ready() resolves', async () => {
  const s = openStore({ indexedDB: { open() { throw new Error('blocked'); } }, legacy: null });
  await s.ready();
  assert.equal(s.persistence(), 'memory');
});

test('after a failed write the store is memory, the listener fired once, and no further backend writes happen', async () => {
  let writes = 0;
  const adapter = {
    load: async () => new Map(),
    write: async () => { writes += 1; throw new Error('quota'); },
    remove: async () => {},
  };
  const s = openStore({ adapter, legacy: null });
  const errors = [];
  s.onFailure((e) => errors.push(e));
  await s.ready();
  s.setItem('a', '1');
  await tick();
  assert.equal(s.persistence(), 'memory');
  assert.equal(errors.length, 1);
  assert.ok(errors[0] instanceof Error);
  assert.equal(writes, 1);
  s.setItem('b', '2');
  await tick();
  assert.equal(writes, 1);
  assert.equal(errors.length, 1);
  assert.equal(s.getItem('b'), '2');
});

test('two quick setItem calls end with the last value in the backend', async () => {
  const disk = new Map();
  const adapter = {
    load: async () => new Map(disk),
    write: async (k, v) => { await new Promise((r) => setTimeout(r, 1)); disk.set(k, v); },
    remove: async (k) => { disk.delete(k); },
  };
  const s = openStore({ adapter, legacy: null });
  await s.ready();
  s.setItem('a', '1');
  s.setItem('a', '2');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(disk.get('a'), '2');
});

/* A factory whose open() succeeds but whose database cannot be read. */
const brokenIndexedDB = { open() {
  const req = {};
  queueMicrotask(() => { req.result = { transaction() { throw new Error('unreadable'); } }; req.onsuccess(); });
  return req;
} };
const fakeStorage = () => ({ ...fakeLegacy(), length: 0, key: () => null });

test('an IndexedDB that opens but cannot be read falls through to localStorage', async () => {
  await withLocalStorage(fakeStorage(), async () => {
    const s = openStore({ indexedDB: brokenIndexedDB, legacy: null });
    await s.ready();
    assert.equal(s.persistence(), 'localstorage');
  });
});

test('a blocked localStorage does not break the module or the store', async () => {
  await withLocalStorage(() => { throw new Error('SecurityError'); }, async () => {
    const mod = await import('../app/idb.js?blocked');
    await mod.store.ready();
    const s = openStore({ indexedDB: null, legacy: null });
    await s.ready();
    assert.equal(s.persistence(), 'memory');
  });
});

test('an open() that never settles falls through instead of hanging ready()', async () => {
  await withLocalStorage(undefined, async () => {
    const s = openStore({ indexedDB: { open: () => ({}) }, legacy: null });
    await s.ready();
    assert.notEqual(s.persistence(), 'indexeddb');
  });
});

test('a slow IndexedDB open keeps the session in memory, leaves localStorage alone, and closes the late connection', async () => {
  const map = new Map([[JOURNEY, '{"saved":[{"slug":"a"}]}']]);
  let writes = 0;
  const ls = {
    get length() { return map.size; }, key: (i) => [...map.keys()][i], getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { writes += 1; map.set(k, String(v)); }, removeItem: (k) => { writes += 1; map.delete(k); },
  };
  let closed = false;
  // Opens only after the 1.5 s per-backend bound has passed.
  const slow = { open() {
    const req = {};
    setTimeout(() => { req.result = { close() { closed = true; }, transaction() { throw new Error('unused'); } }; req.onsuccess(); }, 1600);
    return req;
  } };
  await withLocalStorage(ls, async () => {
    const s = openStore({ indexedDB: slow, legacy: ls, migrateKeys: KEYS });
    await s.ready();
    assert.equal(s.persistence(), 'memory');
    assert.equal(ls.getItem(JOURNEY), '{"saved":[{"slug":"a"}]}');
    s.setItem(JOURNEY, '{"saved":[{"slug":"c"}]}');
    await tick(200);
    assert.equal(writes, 0);
    assert.deepEqual([...map.keys()], [JOURNEY]);
    assert.equal(closed, true);
  });
});
