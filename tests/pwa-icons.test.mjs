// node --test tests/
// The installed-app basics: every manifest icon is a real PNG of the size it says, the maskable icon is its own
// file (not the plain icon reused), and the home page carries the standalone and Apple touch icon tags.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* Width and height from a PNG's IHDR chunk. */
function pngSize(file) {
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.subarray(1, 4).toString('latin1'), 'PNG', `${file} is a PNG`);
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

test('every manifest icon exists and is the size it declares', () => {
  for (const icon of manifest.icons) {
    const file = path.join(ROOT, icon.src.replace(/^\//, ''));
    assert.ok(fs.existsSync(file), `${icon.src} exists`);
    assert.equal(pngSize(file), icon.sizes, `${icon.src} size`);
  }
});

test('the maskable icon is a dedicated file, not the plain icon reused', () => {
  const maskable = manifest.icons.filter((icon) => icon.purpose === 'maskable');
  const plain = manifest.icons.filter((icon) => icon.purpose === 'any');
  assert.ok(maskable.length >= 1, 'a maskable icon is declared');
  for (const icon of maskable) {
    assert.ok(!plain.some((other) => other.src === icon.src), `${icon.src} is also declared as a plain icon`);
  }
});

test('the home page links a 180px Apple touch icon that exists', () => {
  const link = /<link rel="apple-touch-icon" sizes="180x180" href="([^"]+)">/.exec(home);
  assert.ok(link, 'apple-touch-icon with sizes 180x180');
  const file = path.join(ROOT, link[1].replace(/^\//, ''));
  assert.equal(pngSize(file), '180x180');
});

test('the home page asks for a standalone app with a light status bar, and the manifest background matches the theme colour', () => {
  assert.match(home, /<meta name="apple-mobile-web-app-capable" content="yes">/);
  assert.match(home, /<meta name="mobile-web-app-capable" content="yes">/);
  assert.match(home, /<meta name="apple-mobile-web-app-status-bar-style" content="default">/);
  const theme = /<meta name="theme-color" content="([^"]+)">/.exec(home)?.[1];
  assert.equal(manifest.theme_color, theme);
  assert.equal(manifest.background_color, theme);
});
