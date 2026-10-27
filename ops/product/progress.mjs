#!/usr/bin/env node
/* Reads and edits ops/product/PROGRESS.md so a fresh session can resume the roadmap.
 *
 *   node ops/product/progress.mjs summary              counts per status
 *   node ops/product/progress.mjs next [n]            the next n `todo` items, in order (default 5)
 *   node ops/product/progress.mjs set <id> <status> [note...]
 *   node ops/product/progress.mjs unblock <tag>        blocked items waiting on <tag> become todo
 *   node ops/product/progress.mjs lock acquire <who> | release | status
 *
 * The lock is a heartbeat in the file header: a second run that finds a lock newer
 * than 90 minutes must stop. Nothing here runs a build or touches git.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const STATUSES = ['todo', 'doing', 'done', 'blocked', 'parked', 'dropped'];
export const LOCK_MINUTES = 90;
const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'PROGRESS.md');

export function parse(text) {
  const lines = text.split('\n');
  const rows = [];
  lines.forEach((line, index) => {
    const m = /^\| (\d+) \| (\w+) \| ([^|]*) \| ([^|]*) \| ([^|]*) \| ([^|]*) \|$/.exec(line);
    if (m) rows.push({ index, id: Number(m[1]), status: m[2], tags: m[3].trim(), title: m[4].trim(), section: m[5].trim(), note: m[6].trim() });
  });
  return { lines, rows };
}

export function render(doc) {
  for (const r of doc.rows) doc.lines[r.index] = `| ${r.id} | ${r.status} | ${r.tags} | ${r.title} | ${r.section} | ${r.note} |`;
  return doc.lines.join('\n');
}

export function summary(rows) {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
  return counts;
}

export function setStatus(doc, id, status, note = '') {
  if (!STATUSES.includes(status)) throw new Error(`status must be one of ${STATUSES.join(', ')}`);
  const row = doc.rows.find((r) => r.id === id);
  if (!row) throw new Error(`no item ${id}`);
  row.status = status;
  row.note = note.replace(/\|/g, '/').trim();
  return row;
}

export function unblock(doc, tag) {
  let n = 0;
  for (const r of doc.rows) {
    if (r.status === 'blocked' && r.note === tag) { r.status = 'todo'; r.note = `unblocked ${tag}`; n += 1; }
  }
  return n;
}

export function readLock(text) {
  const m = /^Run lock: (.*)$/m.exec(text);
  const value = m ? m[1].trim() : 'none';
  if (value === 'none') return { held: false };
  const [iso, ...who] = value.split(' ');
  const age = (Date.now() - Date.parse(iso)) / 60000;
  return { held: Number.isFinite(age) && age < LOCK_MINUTES, since: iso, who: who.join(' '), ageMinutes: Math.round(age) };
}

export function writeLock(text, value) {
  return text.replace(/^Run lock: .*$/m, `Run lock: ${value}`);
}

function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const text = fs.readFileSync(FILE, 'utf8');
  const doc = parse(text);
  const save = () => fs.writeFileSync(FILE, render(doc));
  if (cmd === 'summary') {
    const c = summary(doc.rows);
    console.log(Object.entries(c).map(([k, v]) => `${k} ${v}`).join(' · '), `· total ${doc.rows.length}`);
  } else if (cmd === 'next') {
    const n = Number(args[0] || 5);
    for (const r of doc.rows.filter((x) => x.status === 'todo').slice(0, n)) console.log(`${r.id}\t${r.section}\t${r.title}`);
  } else if (cmd === 'set') {
    const row = setStatus(doc, Number(args[0]), args[1], args.slice(2).join(' '));
    save();
    console.log(`${row.id} -> ${row.status} ${row.note}`);
  } else if (cmd === 'unblock') {
    const n = unblock(doc, args[0]);
    save();
    console.log(`unblocked ${n}`);
  } else if (cmd === 'lock') {
    const lock = readLock(text);
    if (args[0] === 'status') { console.log(JSON.stringify(lock)); process.exit(lock.held ? 3 : 0); }
    if (args[0] === 'acquire') {
      if (lock.held) { console.error(`lock held by ${lock.who} for ${lock.ageMinutes} min; stop`); process.exit(3); }
      fs.writeFileSync(FILE, writeLock(text, `${new Date().toISOString()} ${args.slice(1).join(' ') || 'session'}`));
      console.log('lock acquired');
    } else if (args[0] === 'release') { fs.writeFileSync(FILE, writeLock(text, 'none')); console.log('lock released'); }
    else { console.error('lock acquire <who> | release | status'); process.exit(2); }
  } else { console.error('summary | next [n] | set <id> <status> [note] | unblock <tag> | lock ...'); process.exit(2); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
