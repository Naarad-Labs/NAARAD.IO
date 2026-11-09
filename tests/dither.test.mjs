import test from 'node:test';
import assert from 'node:assert/strict';
import { PALETTES, pickPalette, bayer4, shouldAnimate, mountDither } from '../app/dither.js';

test('pickPalette falls back to navy for unknown or missing names', () => {
  assert.deepEqual(pickPalette(null), PALETTES.navy);
  assert.deepEqual(pickPalette('nope'), PALETTES.navy);
  assert.deepEqual(pickPalette('sand'), PALETTES.sand);
  assert.equal(PALETTES.navy.back, '#0B1D3A');
  assert.equal(PALETTES.navy.front, '#F26A1C');
});

test('bayer4 gives 16 distinct thresholds in [0,1) and repeats every 4 pixels', () => {
  const seen = new Set();
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const v = bayer4(x, y);
    assert.ok(v >= 0 && v < 1);
    seen.add(v);
  }
  assert.equal(seen.size, 16);
  assert.equal(bayer4(4, 4), bayer4(0, 0));
});

test('shouldAnimate is false for reduced motion or no WebGL', () => {
  assert.equal(shouldAnimate({ reducedMotion: true, hasWebGL: true }), false);
  assert.equal(shouldAnimate({ reducedMotion: false, hasWebGL: false }), false);
  assert.equal(shouldAnimate({ reducedMotion: false, hasWebGL: true }), true);
});

test('mountDither marks the fallback and returns a teardown when WebGL is missing', () => {
  const canvas = { getContext: () => null, style: {}, setAttribute() {}, classList: { add() {} } };
  const el = { dataset: {}, ownerDocument: { createElement: () => canvas }, prepend() { throw new Error('no canvas expected'); } };
  const stop = mountDither(el, { palette: 'nope' });
  assert.equal(el.dataset.ditherFallback, '1');
  assert.equal(typeof stop, 'function');
  stop();
});

test('teardown releases the WebGL context so page swaps do not leak contexts', () => {
  let lost = false;
  const gl = new Proxy({}, {
    get: (_, name) => {
      if (name === 'getExtension') return (ext) => (ext === 'WEBGL_lose_context' ? { loseContext: () => { lost = true; } } : null);
      if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true;
      if (/^[A-Z_0-9]+$/.test(String(name))) return 1;
      return () => 1;
    },
  });
  const canvas = { getContext: () => gl, setAttribute() {}, addEventListener() {}, remove() {} };
  const el = { dataset: {}, clientWidth: 100, clientHeight: 50, ownerDocument: { createElement: () => canvas }, prepend() {} };
  Object.assign(globalThis, {
    window: { devicePixelRatio: 1 },
    document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
  });
  const stop = mountDither(el);
  assert.equal(el.dataset.ditherFallback, undefined);
  stop();
  assert.equal(lost, true);
});
