// node --test tests/
// The route preview drawing (app/previews.js) is also used by the share-card page (scripts/og-card.html), which loads
// only base.css. Every rp-* class the drawing emits must be styled in app/home.css (the site) AND in og-card.html, or the
// drawing loses its colour there: an SVG rect with no fill is drawn black.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const previews = read('app/previews.js');
const emitted = [...new Set(previews.match(/\brp-[a-z]+(?:-[a-z]+)*\b/g) || [])].sort();

test('the preview drawing emits its ground and grid as classes, not colour attributes', () => {
  assert.ok(emitted.includes('rp-ground'), 'rp-ground is emitted');
  assert.ok(emitted.includes('rp-grid'), 'rp-grid is emitted');
  assert.doesNotMatch(previews, /fill="#eef2e6"/, 'the ground is not a fill attribute');
  assert.doesNotMatch(previews, /stroke="rgba\(18,41,74/, 'the grid is not a stroke attribute');
});

test('every class the preview drawing emits is styled in app/home.css', () => {
  const css = read('app/home.css');
  for (const name of emitted) assert.ok(css.includes(`.${name}`), `app/home.css styles .${name}`);
});

test('every class the preview drawing emits is styled in scripts/og-card.html, which does not load home.css', () => {
  const page = read('scripts/og-card.html');
  assert.doesNotMatch(page, /href="\/app\/home\.css"/, 'og-card.html still loads only base.css (if it now links home.css, this test can be relaxed)');
  for (const name of emitted) assert.ok(page.includes(`.${name}`), `scripts/og-card.html styles .${name}`);
});

test('the colours the preview classes use are declared tokens', () => {
  const tokens = read('app/tokens.css');
  for (const token of ['--preview-ground', '--ink-rgb', '--white-rgb']) {
    assert.match(tokens, new RegExp(`${token}\\s*:`), `${token} is declared in app/tokens.css`);
  }
});
