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

test('migration copies the legacy value and deletes the legacy key', async () => {
  const legacy = fakeLegacy({ [JOURNEY]: '{"saved":[]}' });
  const s = openStore({ backend: 'memory', legacy, migrateKeys: KEYS });
  await s.ready();
  assert.equal(s.getItem(JOURNEY), '{"saved":[]}');
  assert.equal(legacy.getItem(JOURNEY), null);
});

test('migration is skipped when the store already has the key', async () => {
  const legacy = fakeLegacy({ [JOURNEY]: 'old' });
  const s = openStore({ backend: 'memory', legacy, migrateKeys: KEYS });
  s.setItem(JOURNEY, 'new');
  await s.ready();
  assert.equal(s.getItem(JOURNEY), 'new');
  assert.equal(legacy.getItem(JOURNEY), 'old');
});

test('ready() twice leaves one copy and no legacy key', async () => {
  const legacy = fakeLegacy({ [JOURNEY]: 'x' });
  const s = openStore({ backend: 'memory', legacy, migrateKeys: KEYS });
  await s.ready();
  await s.ready();
  assert.equal(s.getItem(JOURNEY), 'x');
  assert.equal(legacy.getItem(JOURNEY), null);
});

test('a throwing indexedDB falls back to memory and ready() resolves', async () => {
  const s = openStore({ indexedDB: { open() { throw new Error('blocked'); } }, legacy: null });
  await s.ready();
  assert.equal(s.persistence(), 'memory');
});

test('a rejecting write downgrades to memory and notifies once', async () => {
  const adapter = {
    load: async () => new Map(),
    write: async () => { throw new Error('quota'); },
    remove: async () => {},
  };
  const s = openStore({ adapter, legacy: null });
  const errors = [];
  s.onFailure((e) => errors.push(e));
  await s.ready();
  s.setItem('a', '1');
  s.setItem('b', '2');
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(s.persistence(), 'memory');
  assert.equal(errors.length, 1);
  assert.ok(errors[0] instanceof Error);
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
