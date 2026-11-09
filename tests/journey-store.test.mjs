import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './fresh-module.mjs';

const KEY = 'naarad.journey.v1';
const saved = { saved: [{ slug: 'x-trail', name: 'X Trail' }] };

test('ready() brings in a journey stored by an earlier version, and the journey sees it', async () => {
  const { store } = await load('journey-store', { [KEY]: JSON.stringify(saved) });
  assert.equal(store.isSaved('x-trail'), true);
  assert.equal(store.persistence(), 'localstorage'); // Node has no IndexedDB: the fake localStorage is the backend and keeps the key
});

test('a legacy value of the wrong shape leaves an empty journey, without throwing', async () => {
  const { store } = await load('journey-store', { [KEY]: '{"saved":"x"}' });
  assert.deepEqual(store.all().saved, []);
});

test('the cache is reset by ready(): a read before it does not stick', async () => {
  const { store } = await load('journey-store', { [KEY]: JSON.stringify(saved) }, { wait: false });
  assert.equal(store.isSaved('x-trail'), false, 'before ready() the store holds nothing yet');
  await store.ready();
  assert.equal(store.isSaved('x-trail'), true);
});

test('drafts expose ready() too', async () => {
  const { store } = await load('studio-store');
  assert.equal(typeof store.ready, 'function');
});

test('persistenceNote returns message when persistence failed mid-session', async () => {
  // When persistence() returns 'memory' due to a failure, persistenceNote
  // should inform the user that their data is not being saved
  const { store } = await load('journey-store', {}, { wait: false });
  
  // Initially in memory mode (no IndexedDB in Node)
  assert.equal(store.persistence(), 'memory');
  
  // persistenceNote should return a message for memory mode
  const note = store.persistenceNote();
  assert.ok(note.includes('not being saved') || note.includes('not saved'), 'persistenceNote mentions unsaved state');
});

test('persistenceNote returns empty string when storage is working', async () => {
  // When persistence() returns 'localstorage' (working), persistenceNote should return empty
  const { store } = await load('journey-store', { [KEY]: JSON.stringify(saved) });
  
  // persistence should be localstorage (the fake in Node)
  assert.equal(store.persistence(), 'localstorage');
  
  // persistenceNote should return empty for working storage
  const note = store.persistenceNote();
  assert.equal(note, '', 'persistenceNote is empty for working storage');
});
