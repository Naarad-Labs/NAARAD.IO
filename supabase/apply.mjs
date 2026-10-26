#!/usr/bin/env node
/* Apply supabase/migrations/*.sql to the project in DATABASE_URL (from .env.local).
 *
 *   node supabase/apply.mjs --dry-run    say what would happen, change nothing
 *   node supabase/apply.mjs              apply what has not been applied yet
 *
 * Each migration runs in its own transaction and is recorded in
 * public._naarad_migrations, so it never runs twice. Before it applies anything
 * it refuses to continue if a table it would create already exists: an existing
 * `profiles` table is common in a Supabase project, and silently reshaping one
 * would be worse than stopping. It never prints the connection string.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes('--dry-run');

function readEnv() {
  const file = process.env.NAARAD_ENV_FILE || path.join(here, '..', '.env.local');
  if (!fs.existsSync(file)) throw new Error('.env.local not found: copy .env.example and fill in DATABASE_URL');
  const env = {};
  fs.readFileSync(file, 'utf8').split('\n').forEach((line) => {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  });
  return env;
}

/* Tables a migration creates, found from its own text. */
const creates = (sql) => [...sql.matchAll(/create table\s+(?:if not exists\s+)?public\.(\w+)/gi)].map((match) => match[1]);

async function main() {
  const { DATABASE_URL: url } = readEnv();
  if (!url) throw new Error('DATABASE_URL is empty in .env.local');
  const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
  await client.connect();
  try {
    const exists = (await client.query(`select to_regclass('public._naarad_migrations') as found`)).rows[0].found;
    if (!exists && !dryRun) {
      /* A table in the public schema is reachable by the browser's anon key unless it is locked. */
      await client.query(`create table public._naarad_migrations (name text primary key, applied_at timestamptz not null default now());
        alter table public._naarad_migrations enable row level security;
        revoke all on public._naarad_migrations from public, anon, authenticated;`);
    }
    const done = new Set(exists || !dryRun
      ? (await client.query('select name from public._naarad_migrations')).rows.map((row) => row.name)
      : []);
    const files = fs.readdirSync(path.join(here, 'migrations')).filter((name) => name.endsWith('.sql')).sort();
    const pending = files.filter((name) => !done.has(name));
    if (!pending.length) { console.log('nothing to apply: all migrations are already recorded'); return; }

    for (const name of pending) {
      const sql = fs.readFileSync(path.join(here, 'migrations', name), 'utf8');
      for (const table of creates(sql)) {
        const found = await client.query('select to_regclass($1) as found', [`public.${table}`]);
        if (found.rows[0].found) {
          const columns = await client.query(`select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position`, [table]);
          console.error(`stop: public.${table} already exists (${columns.rows.map((c) => `${c.column_name} ${c.data_type}`).join(', ')}). Reconcile it by hand; nothing was changed.`);
          process.exitCode = 1;
          return;
        }
      }
      if (dryRun) { console.log(`would apply ${name}`); continue; }
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into public._naarad_migrations (name) values ($1)', [name]);
        await client.query('commit');
        console.log(`applied ${name}`);
      } catch (error) {
        await client.query('rollback');
        throw new Error(`${name} failed and was rolled back: ${error.message}`);
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => { console.error(`error: ${error.message.replace(/postgres(ql)?:\/\/\S+/g, '<connection string>')}`); process.exit(1); });
