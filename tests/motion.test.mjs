import test from 'node:test';
import assert from 'node:assert/strict';
import { motionAllowed, countUpText } from '../app/motion.js';

test('motionAllowed is false when any flag is set, true when none is', () => {
  const off = { reducedMotion: false, saveData: false, prerender: false };
  assert.equal(motionAllowed(off), true);
  for (const flag of Object.keys(off)) assert.equal(motionAllowed({ ...off, [flag]: true }), false, flag);
});

test('countUpText animates every number from 0 to its exact final form', () => {
  assert.equal(countUpText('5.2 km', 1), '5.2 km');
  assert.equal(countUpText('5.2 km', 0), '0.0 km');
  assert.equal(countUpText('8 stops', 0.5), '4 stops');
  assert.equal(countUpText('No numbers', 0.3), 'No numbers');
  assert.equal(countUpText('2 h 10 min', 0), '0 h 0 min');
});

test('countUpText returns final text for NaN or negative progress (no NaN display)', () => {
  // NaN progress should return the final text unchanged, not "NaN"
  assert.equal(countUpText('5.2 km', NaN), '5.2 km');
  // Negative progress should return the final text unchanged
  assert.equal(countUpText('5.2 km', -1), '5.2 km');
  // null progress should return the final text unchanged
  assert.equal(countUpText('5.2 km', null), '5.2 km');
  // undefined progress should return the final text unchanged
  assert.equal(countUpText('5.2 km', undefined), '5.2 km');
});
