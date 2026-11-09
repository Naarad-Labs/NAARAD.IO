// Per-page gzipped size budget. Run: node scripts/check-budget.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const KB = 1024;
const GSAP_DIR = 'app/vendor/gsap';
const gz = (file) => zlib.gzipSync(fs.readFileSync(file)).length;
const STATIC = /(?:\bimport|\bexport)\s[^'"`;]*?from\s*['"](\.[^'"]+)['"]|\bimport\s*['"](\.[^'"]+)['"]/g;
const DYNAMIC = /\bimport\(\s*['"](\.[^'"]+)['"]\s*\)/g;
const CSS_IMPORT = /@import\s+(?:url\(\s*)?['"]?(\.[^'")\s]+)['"]?/g;

// shortcut: regex scan, not a parser; a specifier built at runtime is invisible. Upgrade if one appears.
function closure(file, dynamic, seen = new Set()) {
  if (seen.has(file)) return seen;
  seen.add(file);
  const src = fs.readFileSync(file, 'utf8');
  const res = [...src.matchAll(STATIC)].map((m) => m[1] || m[2]);
  if (dynamic) res.push(...[...src.matchAll(DYNAMIC)].map((m) => m[1]));
  for (const r of res) closure(path.resolve(path.dirname(file), r), dynamic, seen);
  return seen;
}

function cssClosure(file, seen = new Set()) {
  if (seen.has(file)) return seen;
  seen.add(file);
  for (const m of fs.readFileSync(file, 'utf8').matchAll(CSS_IMPORT)) cssClosure(path.resolve(path.dirname(file), m[1]), seen);
  return seen;
}

const VENDOR = /['"](\/(?:app\/)?vendor\/[^'"]+\.(?:js|css))['"]/g;

const sum = (files) => [...files].reduce((n, f) => n + gz(f), 0);

export function measure({ root, entry, views, shellCss }) {
  const gsapDir = path.resolve(root, GSAP_DIR) + path.sep;
  const jsOf = (files) => [...files].filter((f) => !f.startsWith(gsapDir));
  const entryPath = path.resolve(root, entry);
  const entryFiles = closure(entryPath, false);
  // shortcut: every page is charged all of main.js's lazy non-view modules and their vendor files (overstates home), split per page when a page nears the cap.
  const viewSet = new Set(views.map((v) => path.resolve(root, v)));
  for (const m of fs.readFileSync(entryPath, 'utf8').matchAll(DYNAMIC)) {
    const target = path.resolve(path.dirname(entryPath), m[1]);
    if (!viewSet.has(target)) closure(target, true, entryFiles);
  }
  const rows = views.map((view) => {
    const viewPath = path.resolve(root, view);
    const js = new Set([...entryFiles, ...closure(viewPath, true)]);
    const css = new Set();
    for (const f of [...js]) {
      for (const m of fs.readFileSync(f, 'utf8').matchAll(VENDOR)) {
        const v = path.resolve(root, m[1].slice(1));
        if (v.startsWith(gsapDir) || !fs.existsSync(v)) continue;
        if (v.endsWith('.css')) cssClosure(v, css);
        else js.add(v);
      }
    }
    for (const c of shellCss) cssClosure(path.resolve(root, c), css);
    const m = fs.readFileSync(viewPath, 'utf8').match(/export const stylesheet\s*=\s*['"]([^'"]+)['"]/);
    if (m) cssClosure(path.resolve(root, m[1].replace(/^\//, '')), css);
    return { page: path.basename(view, '.js'), js: sum(jsOf(js)), css: sum(css) };
  });
  const gsapDirAbs = gsapDir.slice(0, -1);
  if (fs.existsSync(gsapDirAbs)) {
    const files = fs.readdirSync(gsapDirAbs).filter((f) => f.endsWith('.js')).map((f) => path.join(gsapDirAbs, f));
    rows.push({ page: 'gsap', js: sum(files), css: 0 });
  }
  return rows;
}

export function check(rows, { js = 150 * KB, css = 60 * KB, gsap = 70 * KB } = {}) {
  const out = [];
  for (const r of rows) {
    if (r.page === 'gsap') {
      if (r.js > gsap) out.push(`gsap: JS ${r.js} B gzipped exceeds ${gsap} B`);
      continue;
    }
    if (r.js > js) out.push(`${r.page}: JS ${r.js} B gzipped exceeds ${js} B`);
    if (r.css > css) out.push(`${r.page}: CSS ${r.css} B gzipped exceeds ${css} B`);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const shell = fs.readFileSync(path.join(root, 'app/shell.html'), 'utf8');
  const shellCss = [...shell.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="\/([^"]+)"/g)].map((m) => m[1]);
  const views = fs.readdirSync(path.join(root, 'app/views')).filter((f) => f.endsWith('.js')).sort().map((f) => `app/views/${f}`);
  const rows = measure({ root, entry: 'app/main.js', views, shellCss });
  console.log('page'.padEnd(16) + 'JS KB'.padStart(8) + 'CSS KB'.padStart(8));
  for (const r of rows) console.log(r.page.padEnd(16) + (r.js / KB).toFixed(1).padStart(8) + (r.css / KB).toFixed(1).padStart(8));
  const breaches = check(rows);
  breaches.forEach((b) => console.error('BUDGET: ' + b));
  process.exit(breaches.length ? 1 : 0);
}
