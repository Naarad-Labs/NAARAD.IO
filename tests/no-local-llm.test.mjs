import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);

test('no shipped code calls the owner-machine LLM endpoint', () => {
  const files = [...walk('app'), 'sw.js'].filter((f) => /\.(js|mjs|html)$/.test(f));
  const hits = files.filter((f) => /127\.0\.0\.1:31415|localhost:31415/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(hits, []);
});
