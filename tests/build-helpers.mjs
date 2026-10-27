/* Shared by the build tests: a throwaway copy of the site to run the build in,
   so a test can break the content without touching the real tree. */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Why the build cannot run here, or null. It needs Chromium and Playwright (e2e/node_modules). */
export function cannotBuild() {
  if (!fs.existsSync(path.join(ROOT, 'e2e', 'node_modules', 'playwright'))) return 'e2e/node_modules is not installed (cd e2e && npm install)';
  const chromium = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    || ['/opt/pw-browsers', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((candidate) => fs.existsSync(candidate));
  return chromium ? null : 'no Chromium to draw the pages with';
}

const LEFT_OUT = new Set(['.git', 'node_modules', 'replica', 'docs', '.claude', '.agents', '.cache', 'test-results']);

/** A copy of the site in a temporary directory; call `remove()` when done. */
export function copySite() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'naarad-build-'));
  fs.cpSync(ROOT, dir, { recursive: true, filter: (source) => !LEFT_OUT.has(path.basename(source)) });
  fs.symlinkSync(path.join(ROOT, 'e2e', 'node_modules'), path.join(dir, 'e2e', 'node_modules'));
  return { dir, remove: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

/** Every file under a directory, with a hash of its bytes. */
export function snapshot(dir) {
  const files = new Map();
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.name === 'node_modules') continue;
      if (entry.isDirectory()) walk(full);
      else files.set(path.relative(dir, full), crypto.createHash('sha1').update(fs.readFileSync(full)).digest('hex'));
    }
  };
  walk(dir);
  return files;
}

export function build(dir, args = [], env = {}) {
  const result = spawnSync(process.execPath, [path.join(dir, 'scripts', 'build-site.mjs'), ...args], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, ...env }, timeout: 170000,
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr, output: `${result.stdout}\n${result.stderr}` };
}

export const edit = (dir, relative, change) => {
  const file = path.join(dir, relative);
  fs.writeFileSync(file, change(fs.readFileSync(file, 'utf8')));
};

export const lastmods = (dir) => Object.fromEntries(
  [...fs.readFileSync(path.join(dir, 'sitemap.xml'), 'utf8').matchAll(/<loc>https:\/\/naarad\.io([^<]*)<\/loc>(?:<lastmod>([^<]*)<\/lastmod>)?/g)]
    .map((match) => [match[1], match[2] || null]),
);

/** The differences between two snapshots, as readable lines. */
export function changes(before, after) {
  const lines = [];
  for (const [file, hash] of before) {
    if (!after.has(file)) lines.push(`deleted ${file}`);
    else if (after.get(file) !== hash) lines.push(`changed ${file}`);
  }
  for (const file of after.keys()) if (!before.has(file)) lines.push(`added ${file}`);
  return lines;
}
