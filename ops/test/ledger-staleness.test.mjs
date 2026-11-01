import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', 'check-ledger-staleness.mjs');

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}

function tmpLedger(lines) {
  const dir = mkdtempSync(join(tmpdir(), 'ledger-'));
  const file = join(dir, 'ledger.jsonl');
  writeFileSync(file, lines.join('\n') + '\n');
  return { dir, file };
}

test('empty ledger', () => {
  const { dir, file } = tmpLedger(['# header']);
  const r = run(['--ledger', file, '--today', '2026-01-01']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /0 stale of 0 entries/);
  rmSync(dir, { recursive: true });
});

test('fresh entry', () => {
  const { dir, file } = tmpLedger([JSON.stringify({ id: 'E-1', date: '2025-12-20', claim: 'x' })]);
  const r = run(['--ledger', file, '--today', '2026-01-01', '--days', '90']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /0 stale of 1 entries/);
  rmSync(dir, { recursive: true });
});

test('stale entry named', () => {
  const { dir, file } = tmpLedger([JSON.stringify({ id: 'E-2', date: '2025-01-01', claim: 'x' })]);
  const r = run(['--ledger', file, '--today', '2026-01-01', '--days', '90']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /E-2/);
  assert.match(r.stdout, /2025-01-01/);
  assert.match(r.stdout, /365 days old/);
  rmSync(dir, { recursive: true });
});

test('stale with recheck not listed', () => {
  const { dir, file } = tmpLedger([JSON.stringify({ id: 'E-3', date: '2025-01-01', recheck: '2025-06-01', claim: 'x' })]);
  const r = run(['--ledger', file, '--today', '2026-01-01', '--days', '90']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /0 stale of 1 entries/);
  rmSync(dir, { recursive: true });
});

test('--days option', () => {
  const { dir, file } = tmpLedger([JSON.stringify({ id: 'E-4', date: '2025-11-01', claim: 'x' })]);
  const r = run(['--ledger', file, '--today', '2026-01-01', '--days', '10']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /E-4/);
  rmSync(dir, { recursive: true });
});

test('malformed entry warning no crash', () => {
  const { dir, file } = tmpLedger(['{bad json']);
  const r = run(['--ledger', file, '--today', '2026-01-01']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /WARN/);
  rmSync(dir, { recursive: true });
});
