import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBytes, assessSpace, isQuotaError, requestPersistence, persistenceNote, SpaceError } from '../../app/storage-budget.js';

test('formatBytes is honest at both scales', () => {
  assert.equal(formatBytes(2_621_440), '2.5 MB');
  assert.equal(formatBytes(10_240), '10 KB');
  assert.equal(formatBytes(10), '1 KB');
});

test('enough room: ok, and says how much is free', () => {
  const result = assessSpace({ usage: 1_000_000, quota: 50_000_000 }, 3_000_000);
  assert.equal(result.ok, true);
  assert.equal(result.free, 49_000_000);
});

test('not enough room: not ok, and the message names what is needed and what is free', () => {
  const result = assessSpace({ usage: 9_000_000, quota: 10_000_000 }, 3_145_728);
  assert.equal(result.ok, false);
  assert.match(result.message, /3\.0 MB/);
  assert.match(result.message, /space/i);
  assert.match(result.message, /remove|free/i);
});

test('a safety margin is kept: a download that would use the last of the space is refused', () => {
  assert.equal(assessSpace({ usage: 0, quota: 3_000_000 }, 3_000_000).ok, false);
  assert.equal(assessSpace({ usage: 0, quota: 3_000_000 }, 3_000_000, 0).ok, true);
});

test('an estimate the browser does not give is not a refusal: we cannot know, so we try', () => {
  assert.equal(assessSpace(undefined, 3_000_000).ok, true);
  assert.equal(assessSpace({}, 3_000_000).ok, true);
  assert.equal(assessSpace({ usage: 1, quota: 0 }, 3_000_000).ok, true);
});

test('isQuotaError recognises the ways browsers report a full store', () => {
  assert.equal(isQuotaError({ name: 'QuotaExceededError' }), true);
  assert.equal(isQuotaError({ name: 'Error', code: 22 }), true);
  assert.equal(isQuotaError({ name: 'Error', message: 'Quota exceeded for this origin' }), true);
  assert.equal(isQuotaError(new Error('network down')), false);
  assert.equal(isQuotaError(null), false);
});

test('SpaceError is an Error that carries a message the visitor can read', () => {
  const error = new SpaceError('Not enough space.');
  assert.ok(error instanceof Error);
  assert.equal(error.name, 'SpaceError');
  assert.equal(error.message, 'Not enough space.');
});

test('persistence: already persisted means no second ask; otherwise ask once and report plainly', async () => {
  let asked = 0;
  const nav = (persisted, grant) => ({ storage: { persisted: async () => persisted, persist: async () => { asked += 1; return grant; } } });
  assert.equal(await requestPersistence(nav(true, true)), 'granted');
  assert.equal(asked, 0);
  assert.equal(await requestPersistence(nav(false, true)), 'granted');
  assert.equal(await requestPersistence(nav(false, false)), 'denied');
  assert.equal(asked, 2);
});

test('persistence never throws: a missing or broken API is "unsupported"', async () => {
  assert.equal(await requestPersistence({}), 'unsupported');
  assert.equal(await requestPersistence({ storage: {} }), 'unsupported');
  assert.equal(await requestPersistence({ storage: { persisted: async () => { throw new Error('x'); }, persist: async () => true } }), 'unsupported');
  assert.equal(await requestPersistence(undefined), 'unsupported');
});

test('persistenceNote tells the truth about each outcome and says nothing when it does not know', () => {
  assert.match(persistenceNote('granted'), /keep/i);
  assert.match(persistenceNote('denied'), /may (be )?remove|could (be )?remove|space runs low/i);
  assert.equal(persistenceNote('unsupported'), '');
});
