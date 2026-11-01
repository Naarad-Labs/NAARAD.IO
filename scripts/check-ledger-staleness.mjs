#!/usr/bin/env node
/* Evidence-ledger staleness report. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_LEDGER = path.resolve(process.cwd(), 'ops', 'evidence', 'ledger.jsonl');
const RECHECK_FIELDS = ['recheck', 'rechecked', 'recheckDate', 'recheck_date', 'rechecked_on', 'last_recheck'];

function parseArgs(argv) {
  const opts = { days: 90, today: null, ledger: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const take = (name) => {
      if (a === name) return argv[++i];
      if (a.startsWith(name + '=')) return a.slice(name.length + 1);
      return undefined;
    };
    const d = take('--days');
    if (d !== undefined || a === '--days') {
      const n = Number(d);
      if (!Number.isInteger(n) || n < 0) { console.error(`--days needs a whole number, got ${JSON.stringify(d)}`); return null; }
      opts.days = n; continue;
    }
    const t = take('--today');
    if (t !== undefined || a === '--today') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) { console.error(`--today needs YYYY-MM-DD, got ${JSON.stringify(t)}`); return null; }
      opts.today = t; continue;
    }
    const l = take('--ledger');
    if (l !== undefined || a === '--ledger') { opts.ledger = l; continue; }
    if (a.startsWith('-')) { console.error(`unknown option ${a}`); return null; }
    if (opts.ledger === null) opts.ledger = a;
    else { console.error(`unexpected argument ${a}`); return null; }
  }
  if (!opts.today) opts.today = new Date().toISOString().slice(0, 10);
  if (!opts.ledger) opts.ledger = DEFAULT_LEDGER;
  return opts;
}

function daysBetween(a, b) {
  const da = new Date(a + 'T00:00:00Z').getTime();
  const db = new Date(b + 'T00:00:00Z').getTime();
  return Math.round((db - da) / 86400000);
}

export function run(opts, io) {
  const out = io || console;
  const ledgerPath = path.resolve(opts.ledger);
  let lines = [];
  try {
    if (!fs.existsSync(ledgerPath)) lines = [];
    else lines = fs.readFileSync(ledgerPath, 'utf8').split('\n');
  } catch (err) {
    out.log(`WARN  ledger unreadable: ${err.message}`);
    out.log('0 stale of 0 entries');
    return 0;
  }
  const entries = [];
  let malformed = 0;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw.startsWith('#')) continue;
    try { entries.push(JSON.parse(raw)); }
    catch (err) { malformed++; out.log(`WARN  malformed ledger entry (line ${i + 1}): ${err.message}`); }
  }
  let stale = 0;
  for (const e of entries) {
    const id = (e && e.id != null) ? e.id : '(no id)';
    const date = e && e.date;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { out.log(`WARN  entry ${id} has no valid date`); continue; }
    const hasRecheck = RECHECK_FIELDS.some((f) => e && e[f] != null && e[f] !== '' && e[f] !== false);
    const age = daysBetween(date, opts.today);
    if (age > opts.days && !hasRecheck) {
      stale++;
      out.log(`${id}: date ${date}, ${age} days old`);
    }
  }
  out.log(`${stale} stale of ${entries.length} entries`);
  if (malformed) out.log(`WARN  ${malformed} malformed entry/entries skipped`);
  return 0;
}

function main(argv) {
  const opts = parseArgs(argv);
  if (!opts) return 0;
  return run(opts);
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) process.exitCode = main(process.argv.slice(2));
export { parseArgs };
