import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';

/* Supabase's own pieces, stubbed: the roles, auth.users, auth.uid() and auth.jwt()
   read the same request settings PostgREST sets from the caller's token. */
const STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as
    $$ select jsonb_build_object('role', nullif(current_setting('request.jwt.claim.role', true), ''),
                                 'sub', nullif(current_setting('request.jwt.claim.sub', true), '')) $$;
  grant usage on schema auth, public to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to service_role;
`;

async function fresh() {
  const db = new PGlite();
  await db.exec(STUB);
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
  }
  await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}')`);
  return db;
}

/* Run as a role and user, then put the connection back. */
async function as(db, { role = 'authenticated', user = null }, run) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${user || ''}', false), set_config('request.jwt.claim.role', '${role}', false)`);
  try { return await run(); } finally { await db.exec('reset role'); }
}
const q = (db, sql, params) => db.query(sql, params).then((result) => result.rows);
const asA = (db, run) => as(db, { user: A }, run);
const asB = (db, run) => as(db, { user: B }, run);
const insertDraft = (db, extra = '') => q(db, `insert into creator_submissions (title, draft${extra ? ', ' + extra.split('=')[0] : ''}) values ('Hampi at dawn', '{"steps":[1]}'${extra ? ', ' + extra.split('=')[1] : ''}) returning id, author_id, status`);

test('the migration applies cleanly and turns row level security on for both tables', async () => {
  const db = await fresh();
  const rows = await q(db, `select relname, relrowsecurity from pg_class where relname in ('profiles','creator_submissions') order by 1`);
  assert.deepEqual(rows.map((row) => [row.relname, row.relrowsecurity]), [['creator_submissions', true], ['profiles', true]]);
});

test('signed-out visitors can read and write nothing', async () => {
  const db = await fresh();
  await as(db, { role: 'anon' }, async () => {
    await assert.rejects(q(db, 'select * from creator_submissions'), /permission denied/);
    await assert.rejects(q(db, `insert into creator_submissions (title, draft) values ('x', '{}')`), /permission denied/);
    await assert.rejects(q(db, 'select * from profiles'), /permission denied/);
    await assert.rejects(q(db, 'select public.delete_my_account()'), /permission denied/);
  });
});

test('an author writes under their own id and sees only their own rows', async () => {
  const db = await fresh();
  const [mine] = await asA(db, () => insertDraft(db));
  assert.equal(mine.author_id, A);
  assert.equal(mine.status, 'draft');
  assert.equal((await asA(db, () => q(db, 'select id from creator_submissions'))).length, 1);
  assert.equal((await asB(db, () => q(db, 'select id from creator_submissions'))).length, 0);
});

test('nobody can write as someone else, or start as approved', async () => {
  const db = await fresh();
  await asA(db, async () => {
    await assert.rejects(q(db, `insert into creator_submissions (author_id, title, draft) values ('${B}', 'x', '{}')`), /row-level security/);
    await assert.rejects(q(db, `insert into creator_submissions (title, draft, status) values ('x', '{}', 'approved')`), /row-level security/);
  });
});

test('an author can send a draft for review but cannot approve it, reassign it or write the reviewer note', async () => {
  const db = await fresh();
  const [row] = await asA(db, () => insertDraft(db));
  await asA(db, async () => {
    await q(db, `update creator_submissions set status = 'submitted' where id = $1`, [row.id]);
    await assert.rejects(q(db, `update creator_submissions set status = 'approved' where id = $1`, [row.id]), /row-level security/);
    await q(db, `update creator_submissions set review_note = 'looks great', author_id = '${B}' where id = $1`, [row.id]);
  });
  const [after] = await q(db, 'select author_id, review_note, status from creator_submissions where id = $1', [row.id]);
  assert.equal(after.author_id, A);
  assert.equal(after.review_note, null);
  assert.equal(after.status, 'submitted');
});

test("another user cannot change or delete someone else's submission", async () => {
  const db = await fresh();
  const [row] = await asA(db, () => insertDraft(db));
  await asB(db, async () => {
    assert.equal((await db.query(`update creator_submissions set title = 'hijacked' where id = $1`, [row.id])).affectedRows, 0);
    assert.equal((await db.query('delete from creator_submissions where id = $1', [row.id])).affectedRows, 0);
  });
  assert.equal((await q(db, 'select title from creator_submissions'))[0].title, 'Hampi at dawn');
});

test('a moderator approves with a note; the author then reads it but can no longer edit or delete it', async () => {
  const db = await fresh();
  const [row] = await asA(db, () => insertDraft(db));
  await as(db, { role: 'service_role' }, () => q(db, `update creator_submissions set status = 'approved', review_note = 'facts checked' where id = $1`, [row.id]));
  await asA(db, async () => {
    const [seen] = await q(db, 'select status, review_note from creator_submissions');
    assert.deepEqual([seen.status, seen.review_note], ['approved', 'facts checked']);
    assert.equal((await db.query(`update creator_submissions set title = 'edit after approval' where id = $1`, [row.id])).affectedRows, 0);
    assert.equal((await db.query('delete from creator_submissions where id = $1', [row.id])).affectedRows, 0);
  });
});

test('the server sets the update time, not the browser', async () => {
  const db = await fresh();
  const [row] = await asA(db, () => insertDraft(db));
  await asA(db, () => q(db, `update creator_submissions set updated_at = '2001-01-01' where id = $1`, [row.id]));
  const [after] = await q(db, `select updated_at > '2020-01-01' as fresh from creator_submissions`);
  assert.equal(after.fresh, true);
});

test('size and length limits hold', async () => {
  const db = await fresh();
  await asA(db, async () => {
    await assert.rejects(q(db, `insert into creator_submissions (title, draft) values ('', '{}')`), /check constraint/);
    await assert.rejects(q(db, `insert into creator_submissions (title, draft) values ('x', '[1]')`), /check constraint/);
    await assert.rejects(q(db, `insert into creator_submissions (title, draft) values ('x', jsonb_build_object('blob', repeat('a', 250000)))`), /check constraint/);
  });
});

test('a profile is private to its owner and cannot be made for someone else', async () => {
  const db = await fresh();
  await asA(db, async () => {
    await q(db, `insert into profiles (id, display_name) values ('${A}', 'Asha')`);
    await assert.rejects(q(db, `insert into profiles (id, display_name) values ('${B}', 'Not me')`), /row-level security/);
  });
  assert.equal((await asB(db, () => q(db, 'select * from profiles'))).length, 0);
});

test('delete_my_account removes the caller and everything they wrote, and nobody else', async () => {
  const db = await fresh();
  await asA(db, async () => { await q(db, `insert into profiles (id, display_name) values ('${A}', 'Asha')`); await insertDraft(db); });
  await asB(db, () => insertDraft(db));
  await asA(db, () => q(db, 'select public.delete_my_account()'));
  assert.deepEqual((await q(db, 'select id from auth.users')).map((row) => row.id), [B]);
  assert.equal((await q(db, 'select * from profiles')).length, 0);
  const left = await q(db, 'select author_id from creator_submissions');
  assert.deepEqual(left.map((row) => row.author_id), [B]);
});

test('delete_my_account refuses a caller who is not signed in', async () => {
  const db = await fresh();
  await as(db, { role: 'authenticated', user: null }, async () => {
    await assert.rejects(q(db, 'select public.delete_my_account()'), /not signed in/);
  });
});
