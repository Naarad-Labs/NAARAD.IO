import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, render, summary, setStatus, unblock, readLock, writeLock, STATUSES } from '../product/progress.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const text = fs.readFileSync(path.join(HERE, '..', 'product', 'PROGRESS.md'), 'utf8');

test('the progress table has every roadmap item once, in order', () => {
  const { rows } = parse(text);
  assert.equal(rows.length, 1000);
  rows.forEach((r, i) => assert.equal(r.id, i + 1));
  for (const r of rows) assert.ok(STATUSES.includes(r.status), `item ${r.id} has status ${r.status}`);
});

test('every roadmap item has a row and the other way round', () => {
  const roadmap = fs.readFileSync(path.join(HERE, '..', 'product', 'ROADMAP-1000.md'), 'utf8');
  const ids = [...roadmap.matchAll(/^(\d+)\. \*\*/gm)].map((m) => Number(m[1]));
  assert.deepEqual(ids, parse(text).rows.map((r) => r.id));
});

test('render round-trips and setStatus edits one row', () => {
  const doc = parse(text);
  assert.equal(render(doc), text.replace(/\n$/, ''));
  setStatus(doc, 5, 'done', 'PR 1 | extra');
  const again = parse(render(doc));
  assert.equal(again.rows[4].status, 'done');
  assert.equal(again.rows[4].note, 'PR 1 / extra');
  assert.throws(() => setStatus(doc, 5, 'finished'), /status must be/);
  assert.throws(() => setStatus(doc, 5000, 'done'), /no item/);
});

test('unblock moves only the matching blocked items to todo', () => {
  const doc = parse(text);
  const before = summary(doc.rows);
  const n = unblock(doc, 'needs-sarvam');
  const after = summary(doc.rows);
  assert.equal(after.todo, before.todo + n);
  assert.equal(after.blocked, before.blocked - n);
});

test('the lock is held for 90 minutes and then free', () => {
  assert.equal(readLock('Run lock: none').held, false);
  const fresh = writeLock('Run lock: none', `${new Date().toISOString()} a`);
  assert.equal(readLock(fresh).held, true);
  const old = writeLock('Run lock: none', `${new Date(Date.now() - 100 * 60000).toISOString()} a`);
  assert.equal(readLock(old).held, false);
});
