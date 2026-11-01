// node --test tests/
// Tests scripts/check-sw-cache.mjs against small fixture trees in a temp directory, never the real repo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { check, checkStaleVersion, entryToRelative, main, precacheEntries, versionOf } from '../scripts/check-sw-cache.mjs';

/* A small sw.js: a version, a SHELL_ASSETS array over several lines and a one-line CONTENT_ASSETS array. */
function swText({ version = 'v1', shell = ["'/'", "'/app/main.js'"], content = ["'/content/routes.json'"], extra = '' } = {}) {
  return `const VERSION = '${version}';
${extra}
const SHELL_ASSETS = [
  ${shell.join(', ')},
];
const CONTENT_ASSETS = [${content.join(', ')}];
`;
}

/* Writes the given { relativePath: text } files into a fresh temp directory and returns its path. */
function makeTree(files) {
  const dir = mkdtempSync(path.join(tmpdir(), 'sw-cache-test-'));
  for (const [rel, text] of Object.entries(files)) {
    const file = path.join(dir, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
  return dir;
}

function capture() {
  const out = [];
  const err = [];
  return { out, err, io: { out: (s) => out.push(s), err: (s) => err.push(s) } };
}

const CLEAN_FILES = {
  'sw.js': swText(),
  'index.html': '<html></html>',
  'app/main.js': '// main',
  'content/routes.json': '{}',
};

test('a clean fixture returns no problems', () => {
  const dir = makeTree(CLEAN_FILES);
  try {
    assert.deepEqual(check(dir, { git: false }), []);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('a precache entry with no file is reported as missing-precache-file and names the entry', () => {
  const dir = makeTree({ ...CLEAN_FILES, 'sw.js': swText({ shell: ["'/'", "'/app/main.js'", "'/app/gone.js'"] }) });
  try {
    const problems = check(dir, { git: false });
    assert.equal(problems.length, 1);
    assert.equal(problems[0].rule, 'missing-precache-file');
    assert.equal(problems[0].file, '/app/gone.js');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('a folder entry maps to that folder index.html, not the root one', () => {
  const files = { ...CLEAN_FILES, 'sw.js': swText({ shell: ["'/'", "'/routes/'"] }) };
  const withFolder = makeTree({ ...files, 'routes/index.html': '<html></html>' });
  const withoutFolder = makeTree(files);
  try {
    assert.deepEqual(check(withFolder, { git: false }), []);
    const problems = check(withoutFolder, { git: false });
    assert.equal(problems.length, 1);
    assert.equal(problems[0].rule, 'missing-precache-file');
    assert.equal(problems[0].file, '/routes/');
  } finally {
    rmSync(withFolder, { recursive: true });
    rmSync(withoutFolder, { recursive: true });
  }
});

test('a bare constant in the array is resolved from its own const line and checked', () => {
  const sw = swText({ shell: ["'/'", 'OFFLINE_SHELL'], extra: "const OFFLINE_SHELL = '/app/shell.html';" });
  assert.deepEqual(precacheEntries(sw), ['/', '/app/shell.html', '/content/routes.json']);
  const dir = makeTree({ ...CLEAN_FILES, 'sw.js': sw });
  try {
    const problems = check(dir, { git: false });
    assert.equal(problems.length, 1);
    assert.equal(problems[0].file, '/app/shell.html');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('entries come out without quote characters and without comments', () => {
  const sw = `const SHELL_ASSETS = [
  '/a.js', // a comment
  /* another */ "/b.css",
];
const CONTENT_ASSETS = [];
`;
  assert.deepEqual(precacheEntries(sw), ['/a.js', '/b.css']);
});

test('an sw.js with no precache arrays is reported as no-precache-entries', () => {
  const dir = makeTree({ 'sw.js': "const VERSION = 'v1';\n" });
  try {
    const problems = check(dir, { git: false });
    assert.equal(problems.length, 1);
    assert.equal(problems[0].rule, 'no-precache-entries');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('a missing sw.js is reported as missing-sw', () => {
  const dir = makeTree({ 'index.html': '<html></html>' });
  try {
    assert.equal(check(dir, { git: false })[0].rule, 'missing-sw');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('a precached file that changed with the same VERSION is reported as stale-cache-version', () => {
  const sw = swText({ version: 'v7' });
  const problems = checkStaleVersion(sw, sw, ['app/main.js']);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].rule, 'stale-cache-version');
  assert.equal(problems[0].file, 'sw.js');
  assert.match(problems[0].message, /\/app\/main\.js/);
  assert.match(problems[0].message, /v7/);
});

test('a bumped VERSION passes even when precached files changed', () => {
  assert.deepEqual(checkStaleVersion(swText({ version: 'v7' }), swText({ version: 'v8' }), ['app/main.js']), []);
});

test('a changed file that is not precached does not need a version bump', () => {
  const sw = swText({ version: 'v7' });
  assert.deepEqual(checkStaleVersion(sw, sw, ['README.md', 'content/not-precached.json']), []);
});

test('a folder entry is matched against index.html in the changed files', () => {
  const sw = swText({ shell: ["'/routes/'"] });
  assert.equal(checkStaleVersion(sw, sw, ['routes/index.html']).length, 1);
  assert.equal(entryToRelative('/'), 'index.html');
  assert.equal(entryToRelative('/routes/'), 'routes/index.html');
  assert.equal(entryToRelative('/app/main.js?v=2'), 'app/main.js');
});

test('versionOf reads the VERSION constant and returns null when there is none', () => {
  assert.equal(versionOf("const VERSION = 'v19';"), 'v19');
  assert.equal(versionOf('const OTHER = 1;'), null);
});

test('when git cannot read the base ref the version check is skipped with a warning, not a failure', () => {
  const dir = makeTree(CLEAN_FILES);
  const warnings = [];
  try {
    const problems = check(dir, { base: 'no-such-ref', warn: (message) => warnings.push(message) });
    assert.deepEqual(problems, []);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /skipping the cache-version check/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('main() returns 0 on a clean tree, 1 with problems printed, and 2 for bad arguments', () => {
  const clean = makeTree(CLEAN_FILES);
  const broken = makeTree({ ...CLEAN_FILES, 'sw.js': swText({ shell: ["'/'", "'/app/gone.js'"] }) });
  try {
    const ok = capture();
    assert.equal(main(['--root', clean], ok.io), 0);
    assert.match(ok.out.join(' '), /No problems found/);

    const bad = capture();
    assert.equal(main(['--root', broken], bad.io), 1);
    assert.match(bad.out.join(' '), /\[missing-precache-file\] \/app\/gone\.js/);
    assert.match(bad.out.join(' '), /1 problem found/);

    assert.equal(main(['--bogus'], capture().io), 2);
    assert.equal(main(['--root'], capture().io), 2);
    assert.equal(main(['--base'], capture().io), 2);
    assert.equal(main(['stray'], capture().io), 2);
    assert.equal(main(['--root', path.join(clean, 'does-not-exist')], capture().io), 2);
    assert.equal(main(['--help'], capture().io), 0);
  } finally {
    rmSync(clean, { recursive: true });
    rmSync(broken, { recursive: true });
  }
});
