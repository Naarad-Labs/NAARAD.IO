// node --test tests/
// The listening tracker counts seconds that really played. A fake clock and fake timers stand in for real time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createListenTracker } from '../app/listen-tracker.js';

/* A clock and a timer the test drives by hand. */
function rig() {
  let time = 1_000_000;
  const timers = new Map();
  let nextId = 1;
  const recorded = [];
  const tracker = createListenTracker({
    record: (id, seconds) => recorded.push([id, seconds]),
    now: () => time,
    setTimer: (fn) => { timers.set(nextId, fn); return nextId++; },
    clearTimer: (id) => timers.delete(id),
  });
  return {
    tracker, recorded, timers,
    advance(seconds) { time += seconds * 1000; },
    tick() { for (const fn of [...timers.values()]) fn(); },
  };
}

const playing = (id) => ({ playing: true, item: { id } });
const paused = (id) => ({ playing: false, item: { id } });

test('nothing is recorded just because play was tapped', () => {
  const { tracker, recorded } = rig();
  tracker.update(playing('stop-1'));
  assert.deepEqual(recorded, []);
});

test('seconds that really played are recorded on each tick', () => {
  const { tracker, recorded, advance, tick } = rig();
  tracker.update(playing('stop-1'));
  advance(5); tick();
  advance(5); tick();
  assert.deepEqual(recorded, [['stop-1', 5], ['stop-1', 5]]);
});

test('pausing records the seconds up to the pause and stops the timer', () => {
  const { tracker, recorded, timers, advance } = rig();
  tracker.update(playing('stop-1'));
  advance(7);
  tracker.update(paused('stop-1'));
  assert.deepEqual(recorded, [['stop-1', 7]]);
  assert.equal(timers.size, 0, 'no timer keeps running while paused');
});

test('a fraction of a second is carried, not lost or double counted', () => {
  const recorded = [];
  let time = 0;
  const tracker = createListenTracker({ record: (id, s) => recorded.push([id, s]), now: () => time, setTimer: () => 1, clearTimer: () => {} });
  tracker.update(playing('a'));
  time = 1500; tracker.flush();    // 1.5 s played: records 1 whole second, carries 0.5
  time = 2400; tracker.flush();    // 2.4 s: one more whole second (2 so far), carries 0.4
  time = 3000; tracker.flush();    // 3.0 s: the third second
  assert.deepEqual(recorded, [['a', 1], ['a', 1], ['a', 1]]);
});

test('moving to the next stop credits the old stop up to that moment and starts the new one fresh', () => {
  const { tracker, recorded, advance } = rig();
  tracker.update(playing('stop-1'));
  advance(12);
  tracker.update(playing('stop-2'));
  advance(3);
  tracker.update(paused('stop-2'));
  assert.deepEqual(recorded, [['stop-1', 12], ['stop-2', 3]]);
});

test('the same item reported again does not restart or double count', () => {
  const { tracker, recorded, timers, advance } = rig();
  tracker.update(playing('stop-1'));
  advance(4);
  tracker.update(playing('stop-1'));     // a progress update, still the same item
  advance(4);
  tracker.update(paused('stop-1'));
  assert.deepEqual(recorded, [['stop-1', 8]]);
  assert.equal(timers.size, 0);
});

test('a long gap, like a laptop that slept, is dropped rather than credited as listening', () => {
  const { tracker, recorded, advance, tick } = rig();
  tracker.update(playing('stop-1'));
  advance(3600);                         // an hour with no ticks
  tick();
  assert.deepEqual(recorded, [], 'the hour is not credited');
  advance(5); tick();
  assert.deepEqual(recorded, [['stop-1', 5]], 'counting resumes from the wake-up');
});

test('a throttled background timer (a little over a minute between ticks) still counts as listening', () => {
  const { tracker, recorded, advance, tick } = rig();
  tracker.update(playing('stop-1'));
  advance(61); tick();
  assert.deepEqual(recorded, [['stop-1', 61]]);
});

test('a missing or empty player state is safe', () => {
  const { tracker, recorded } = rig();
  assert.doesNotThrow(() => tracker.update(undefined));
  assert.doesNotThrow(() => tracker.update({ playing: true }));
  assert.doesNotThrow(() => tracker.update({ playing: true, item: null }));
  assert.doesNotThrow(() => tracker.flush());
  assert.deepEqual(recorded, []);
});

test('flush records what has played so far without stopping the count', () => {
  const { tracker, recorded, advance } = rig();
  tracker.update(playing('stop-1'));
  advance(9);
  tracker.flush();
  advance(2);
  tracker.update(paused('stop-1'));
  assert.deepEqual(recorded, [['stop-1', 9], ['stop-1', 2]]);
});
