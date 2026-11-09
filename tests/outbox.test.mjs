import test from 'node:test';
import assert from 'node:assert/strict';
import { openStore } from '../app/idb.js';
import { backoffDelay, createOutbox, createRetrier } from '../app/outbox.js';

const memStore = async () => { const s = openStore({ backend: 'memory' }); await s.ready(); return s; };

test('backoffDelay doubles from 1 s, caps at 300 s, jitters +-20%', () => {
  assert.equal(backoffDelay(0, () => 0.5), 1000);
  assert.equal(backoffDelay(3, () => 0.5), 8000);
  assert.equal(backoffDelay(20, () => 0.5), 300000);
  assert.equal(backoffDelay(0, () => 0), 800);
  assert.equal(backoffDelay(0, () => 1), 1200);
});

test('a repeated dedupeKey is refused', async () => {
  const box = createOutbox({ store: await memStore() });
  assert.equal(box.enqueue('upload', { n: 1 }, 'a'), true);
  assert.equal(box.enqueue('upload', { n: 2 }, 'a'), false);
  assert.equal(box.size(), 1);
});

test('over the cap the oldest go and are counted', async () => {
  const store = await memStore();
  const box = createOutbox({ store, cap: 3 });
  ['a', 'b', 'c', 'd'].forEach((k) => box.enqueue('k', {}, k));
  assert.equal(box.size(), 3);
  assert.equal(box.droppedCount(), 1);
  const seen = [];
  await box.flush(async (items) => { seen.push(...items.map((i) => i.key)); return { ok: [], permanent: [] }; });
  assert.deepEqual(seen, ['b', 'c', 'd']);
});

test('flush removes ok and permanent keys, retries the rest with tries + 1', async () => {
  const box = createOutbox({ store: await memStore() });
  ['a', 'b', 'c'].forEach((k) => box.enqueue('k', {}, k));
  const result = await box.flush(async () => ({ ok: ['a'], permanent: ['b'] }));
  assert.deepEqual(result, { sent: 1, dropped: 1, remaining: 1 });
  assert.equal(box.droppedCount(), 1);
  let left;
  await box.flush(async (items) => { left = items; return { ok: [], permanent: [] }; });
  assert.equal(left.length, 1);
  assert.equal(left[0].key, 'c');
  assert.equal(left[0].tries, 1); // the first flush counted one failed attempt
});

test('a throwing sender leaves everything queued', async () => {
  const box = createOutbox({ store: await memStore() });
  box.enqueue('k', {}, 'a');
  await assert.rejects(box.flush(async () => { throw new Error('net'); }));
  assert.equal(box.size(), 1);
});

test('order and the dropped count survive a new outbox over the same store', async () => {
  const store = await memStore();
  const first = createOutbox({ store, cap: 2 });
  ['a', 'b', 'c'].forEach((k) => first.enqueue('k', {}, k));
  const second = createOutbox({ store, cap: 2 });
  const seen = [];
  await second.flush(async (items) => { seen.push(...items.map((i) => i.key)); return { ok: [], permanent: [] }; });
  assert.deepEqual(seen, ['b', 'c']);
  assert.equal(second.droppedCount(), 1);
});

function fakeTimers() {
  const timers = [];
  return {
    timers,
    setTimer: (fn, ms) => { const t = { fn, ms, live: true }; timers.push(t); return t; },
    clearTimer: (t) => { if (t) t.live = false; },
    live: () => timers.filter((t) => t.live),
  };
}

test('createRetrier retries after backoffDelay while run says false, and stops on true', async () => {
  const clock = fakeTimers();
  const results = [false, false, true];
  let calls = 0;
  const retrier = createRetrier(async () => { calls += 1; return results.shift(); }, { random: () => 0.5, ...clock });
  retrier.kick();
  await new Promise((r) => setImmediate(r));
  assert.equal(calls, 1);
  assert.equal(clock.live().length, 1);
  assert.equal(clock.live()[0].ms, 1000);
  const t1 = clock.live()[0]; t1.live = false; t1.fn();
  await new Promise((r) => setImmediate(r));
  assert.equal(clock.live()[0].ms, 2000);
  const t2 = clock.live()[0]; t2.live = false; t2.fn();
  await new Promise((r) => setImmediate(r));
  assert.equal(calls, 3);
  assert.equal(clock.live().length, 0);
  retrier.kick(); // tries were reset: a new failure would start at 1 s again
  retrier.stop();
});
