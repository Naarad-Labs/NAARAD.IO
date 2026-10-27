import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

test('every data file the worker keeps at install exists, and the app fetches no other data file', () => {
  const kept = [...sw.match(/CONTENT_ASSETS = \[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(kept.length >= 5);
  for (const file of kept) assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} is missing`);
  const wanted = ['app/data.js', 'app/media.js', 'app/views/story.js']
    .flatMap((f) => [...fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/'(\/(?:content|discover|routes)\/[^']+\.json)'/g)].map((m) => m[1]));
  for (const file of wanted) assert.ok(kept.includes(file), `${file} is fetched by the app but not kept at install`);
});
