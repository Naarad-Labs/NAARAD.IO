import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { measure, check } from '../scripts/check-budget.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/budget');
const gz = (f) => zlib.gzipSync(fs.readFileSync(path.join(root, f))).length;
const opts = { root, entry: 'app/entry.js', views: ['app/v.js'], shellCss: ['app/shell.css'] };

test('measure: entry + view closure (static and dynamic), shell + view css, gsap split out', () => {
  const rows = measure(opts);
  const page = rows.find((r) => r.page === 'v');
  assert.equal(page.js, ['app/entry.js', 'app/a.js', 'app/v.js', 'app/lazy.js'].reduce((n, f) => n + gz(f), 0));
  assert.equal(page.css, ['app/shell.css', 'app/v.css', 'app/imp.css'].reduce((n, f) => n + gz(f), 0));
  const g = rows.find((r) => r.page === 'gsap');
  assert.deepEqual(g, { page: 'gsap', js: gz('app/vendor/gsap/gsap.js'), css: 0 });
  assert.equal(rows.length, 2);
});

test('measure: no gsap row without app/vendor/gsap', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-'));
  fs.writeFileSync(path.join(tmp, 'e.js'), 'export const e = 1;');
  fs.writeFileSync(path.join(tmp, 'v.js'), 'export const v = 1;');
  const rows = measure({ root: tmp, entry: 'e.js', views: ['v.js'], shellCss: [] });
  assert.deepEqual(rows.map((r) => r.page), ['v']);
});

test('measure: entry lazy non-view import() and the vendor files it names count on every page', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-'));
  fs.mkdirSync(path.join(tmp, 'vendor/x'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'e.js'), "const load = () => import('./lazy.js');\nexport {load};");
  fs.writeFileSync(path.join(tmp, 'lazy.js'), "const SRC = '/vendor/x/x.js'; const CSS = '/vendor/x/x.css';");
  fs.writeFileSync(path.join(tmp, 'vendor/x/x.js'), 'var x = "xxxxxxxxxxxxxxxxxxxxxxxxxx";');
  fs.writeFileSync(path.join(tmp, 'vendor/x/x.css'), '.x{color:red}');
  fs.writeFileSync(path.join(tmp, 'v.js'), 'export const v = 1;');
  const [row] = measure({ root: tmp, entry: 'e.js', views: ['v.js'], shellCss: [] });
  const g = (f) => zlib.gzipSync(fs.readFileSync(path.join(tmp, f))).length;
  assert.equal(row.js, g('e.js') + g('lazy.js') + g('v.js') + g('vendor/x/x.js'));
  assert.equal(row.css, g('vendor/x/x.css'));
});

test('check: breaches name the page; gsap held to its own cap', () => {
  const rows = [{ page: 'v', js: 100, css: 100 }, { page: 'gsap', js: 100, css: 0 }];
  assert.deepEqual(check(rows), []);
  const m = check(rows, { js: 10 });
  assert.equal(m.length, 1);
  assert.match(m[0], /v/);
  assert.equal(check(rows, { css: 10 }).length, 1);
  const g = check(rows, { js: 1000, gsap: 10 });
  assert.equal(g.length, 1);
  assert.match(g[0], /gsap/);
});
