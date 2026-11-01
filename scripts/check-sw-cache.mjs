#!/usr/bin/env node
/* Check the service worker's precache list against the files in the repo.
 *
 *   node scripts/check-sw-cache.mjs                        # check the repo above scripts/
 *   node scripts/check-sw-cache.mjs --root /path/to/repo   # check another repo
 *   node scripts/check-sw-cache.mjs --base origin/main     # compare VERSION with another git ref
 *
 * Exit code: 0 clean, 1 at least one problem, 2 bad arguments. Zero dependencies, Node 18+.
 *
 * Rules (the rule id is printed in square brackets):
 *   missing-precache-file  an entry in SHELL_ASSETS or CONTENT_ASSETS that is not a file in the tree
 *   no-precache-entries    sw.js has no entries in those two arrays (the parser found nothing to check)
 *   stale-cache-version    a precached file changed since the base ref but VERSION did not
 *
 * The version check needs git and the base ref. If either is missing (a shallow clone, say) it prints a
 * warning and is skipped; it never fails the run.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARRAYS = ['SHELL_ASSETS', 'CONTENT_ASSETS'];

/* The entries of `const NAME = [ ... ];` in sw.js text. Entries are root-relative strings that start with
   a slash. A bare name in the array (OFFLINE_SHELL) is resolved from its own `const NAME = '/...'` line. */
export function extractEntries(source, name) {
  const start = source.search(new RegExp(String.raw`\bconst\s+${name}\s*=\s*\[`));
  if (start === -1) return [];
  const open = source.indexOf('[', start);
  const close = source.indexOf(']', open);
  if (close === -1) return [];
  const body = source.slice(open + 1, close).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const entries = [];
  for (const raw of body.split(',')) {
    const token = raw.trim();
    if (!token) continue;
    const literal = /^(['"])(\/[^'"]*)\1$/.exec(token);
    if (literal) {
      entries.push(literal[2]);
      continue;
    }
    if (/^[A-Za-z_$][\w$]*$/.test(token)) {
      const ref = new RegExp(String.raw`\bconst\s+${token}\s*=\s*(['"])(\/[^'"]*)\1`).exec(source);
      if (ref) entries.push(ref[2]);
    }
  }
  return entries;
}

/* Every precache entry in sw.js text, in order. */
export function precacheEntries(source) {
  return ARRAYS.flatMap((name) => extractEntries(source, name));
}

/* The cache version string, for example v19, or null when sw.js has no VERSION constant. */
export function versionOf(source) {
  const match = /\bconst\s+VERSION\s*=\s*(['"])([^'"]+)\1/.exec(source);
  return match ? match[2] : null;
}

/* A precache entry as a repo-relative file path: '/' and any folder address map to that folder's index.html. */
export function entryToRelative(entry) {
  const rel = entry.split(/[?#]/)[0].replace(/^\//, '');
  return rel === '' || rel.endsWith('/') ? `${rel}index.html` : rel;
}

/* Problems when a precached file is in changedFiles (repo-relative paths) but VERSION is the same in both
   sw.js texts. Pure: it reads no files and runs no git. */
export function checkStaleVersion(oldSwText, newSwText, changedFiles) {
  const problems = [];
  const oldVersion = versionOf(oldSwText);
  const newVersion = versionOf(newSwText);
  if (oldVersion === null || newVersion === null || oldVersion !== newVersion) return problems;
  const changed = new Set(changedFiles.map((file) => file.replace(/\\/g, '/')));
  for (const entry of precacheEntries(newSwText)) {
    if (changed.has(entryToRelative(entry))) {
      problems.push({
        rule: 'stale-cache-version',
        file: 'sw.js',
        message: `${entry} changed but VERSION is still ${newVersion}`,
      });
    }
  }
  return problems;
}

/* The old sw.js text and the list of files that differ from the base ref, or null when git cannot say. */
function readGitBase(rootDir, base) {
  try {
    const run = (args) => execFileSync('git', args, { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return {
      oldSwText: run(['show', `${base}:sw.js`]),
      changedFiles: run(['diff', '--name-only', base]).split('\n').filter(Boolean),
    };
  } catch {
    return null;
  }
}

/* All problems for the repo at rootDir. options.base is the git ref for the version check (default
   origin/main); options.git === false skips that check; options.warn receives skip warnings. */
export function check(rootDir, options = {}) {
  const swPath = path.join(rootDir, 'sw.js');
  if (!fs.existsSync(swPath)) {
    return [{ rule: 'missing-sw', file: 'sw.js', message: 'sw.js not found' }];
  }
  const problems = [];
  const source = fs.readFileSync(swPath, 'utf8');
  const entries = precacheEntries(source);
  if (entries.length === 0) {
    problems.push({ rule: 'no-precache-entries', file: 'sw.js', message: 'found no entries in SHELL_ASSETS or CONTENT_ASSETS' });
  }
  for (const entry of entries) {
    const file = path.join(rootDir, entryToRelative(entry));
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      problems.push({ rule: 'missing-precache-file', file: entry, message: `not a file in the tree: ${entryToRelative(entry)}` });
    }
  }
  if (options.git !== false) {
    const base = options.base || 'origin/main';
    const git = readGitBase(rootDir, base);
    if (git) {
      problems.push(...checkStaleVersion(git.oldSwText, source, git.changedFiles));
    } else {
      (options.warn || ((message) => console.warn(message)))(`warning: skipping the cache-version check (git could not read ${base})`);
    }
  }
  return problems;
}

const USAGE = `Usage: node scripts/check-sw-cache.mjs [--root DIR] [--base REF]
  --root DIR   repository root directory (default: the directory above scripts/)
  --base REF   git ref to compare the cache version against (default: origin/main)`;

export function main(argv, io = { out: (s) => console.log(s), err: (s) => console.error(s) }) {
  let rootDir = ROOT;
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      io.out(USAGE);
      return 0;
    }
    if (arg === '--root' || arg === '--base') {
      if (i + 1 >= argv.length) {
        io.err(`${arg} needs a value\n${USAGE}`);
        return 2;
      }
      const value = argv[++i];
      if (arg === '--root') rootDir = path.resolve(process.cwd(), value);
      else options.base = value;
      continue;
    }
    io.err(arg.startsWith('-') ? `unknown option ${arg}\n${USAGE}` : `unexpected argument ${arg}\n${USAGE}`);
    return 2;
  }
  try {
    if (!fs.statSync(rootDir).isDirectory()) throw new Error('not a directory');
  } catch {
    io.err(`directory not found: ${rootDir}`);
    return 2;
  }
  options.warn = (message) => io.err(message);
  const problems = check(rootDir, options);
  if (problems.length === 0) {
    io.out('No problems found');
    return 0;
  }
  for (const problem of problems) io.out(`[${problem.rule}] ${problem.file}: ${problem.message}`);
  io.out(`${problems.length} problem${problems.length === 1 ? '' : 's'} found`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
