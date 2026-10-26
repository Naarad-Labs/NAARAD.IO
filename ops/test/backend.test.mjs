import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBackend, BackendError } from '../../app/backend.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function storage() {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k), data };
}

/* A fake Supabase: records calls, answers from a queue of [status, body]. */
function setup(answers = [], { now = () => 1_000_000 } = {}) {
  const calls = [];
  const queue = [...answers];
  const fetchImpl = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined });
    const [status, body] = queue.length ? queue.shift() : [200, null];
    return { ok: status < 400, status, text: async () => (body === null ? '' : JSON.stringify(body)) };
  };
  const store = storage();
  const backend = createBackend({ url: 'https://p.example/', anonKey: 'anon-public', fetchImpl, storage: store, now });
  return { backend, calls, store };
}
const session = (extra = {}) => ({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, user: { id: 'u1', email: 'a@b.co' }, ...extra });

test('with no URL or key it is off and says so, and sends nothing', async () => {
  const calls = [];
  const backend = createBackend({ url: '', anonKey: '', fetchImpl: async () => { calls.push(1); }, storage: storage() });
  assert.equal(backend.configured(), false);
  await assert.rejects(backend.signIn({ email: 'a', password: 'b' }), /not available/);
  assert.equal(calls.length, 0);
});

test('signing up needs the person to say they are 18 or over, before anything is sent', async () => {
  const { backend, calls } = setup();
  await assert.rejects(backend.signUp({ email: 'a@b.co', password: 'pw', over18: false }), /18 or over/);
  await assert.rejects(backend.signUp({ email: 'a@b.co', password: 'pw' }), /18 or over/);
  assert.equal(calls.length, 0);
});

test('sign up records the over-18 statement in the account and keeps the session', async () => {
  const { backend, calls, store } = setup([[200, session()]]);
  const result = await backend.signUp({ email: 'a@b.co', password: 'pw', over18: true });
  assert.equal(calls[0].url, 'https://p.example/auth/v1/signup');
  assert.deepEqual(calls[0].body.data, { over_18: true });
  assert.equal(calls[0].headers.apikey, 'anon-public');
  assert.equal(result.user.email, 'a@b.co');
  assert.ok(store.data.has('naarad.auth.v1'));
});

test('sign up that needs email confirmation keeps no session', async () => {
  const { backend, store } = setup([[200, { id: 'u1', email: 'a@b.co' }]]);
  assert.equal(await backend.signUp({ email: 'a@b.co', password: 'pw', over18: true }), null);
  assert.equal(store.data.size, 0);
});

test('a wrong password is reported in the server\'s words and keeps nothing', async () => {
  const { backend, store } = setup([[400, { error_description: 'Invalid login credentials' }]]);
  await assert.rejects(backend.signIn({ email: 'a@b.co', password: 'x' }), (error) => error instanceof BackendError && /Invalid login/.test(error.message));
  assert.equal(store.data.size, 0);
});

test('a submission goes out with the person\'s own token and asks for the row back', async () => {
  const { backend, calls } = setup([[200, session()], [201, [{ id: 's1', status: 'submitted' }]]]);
  await backend.signIn({ email: 'a@b.co', password: 'pw' });
  const row = await backend.saveSubmission({ title: 'Hampi', draft: { steps: [] }, send: true });
  assert.equal(row.id, 's1');
  assert.equal(calls[1].headers.authorization, 'Bearer at');
  assert.equal(calls[1].body.status, 'submitted');
  assert.equal(calls[1].headers.prefer, 'return=representation');
});

test('a stale token is refreshed once and the call retried', async () => {
  const { backend, calls } = setup([[200, session()], [401, { message: 'jwt expired' }], [200, session({ access_token: 'at2', refresh_token: 'rt2' })], [200, []]]);
  await backend.signIn({ email: 'a@b.co', password: 'pw' });
  await backend.listMine();
  assert.equal(calls[2].url, 'https://p.example/auth/v1/token?grant_type=refresh_token');
  assert.equal(calls[2].body.refresh_token, 'rt');
  assert.equal(calls[3].headers.authorization, 'Bearer at2');
});

test('a dead refresh token signs the person out locally', async () => {
  const { backend, store } = setup([[200, session()], [401, {}], [400, { error_description: 'Invalid Refresh Token' }]]);
  await backend.signIn({ email: 'a@b.co', password: 'pw' });
  await assert.rejects(backend.listMine());
  assert.equal(store.data.size, 0);
});

test('signing out clears the session even with no network', async () => {
  const { backend, store } = setup([[200, session()]]);
  await backend.signIn({ email: 'a@b.co', password: 'pw' });
  backend.session = backend.session;   // exercise the getter path
  const offline = createBackend({ url: 'https://p.example', anonKey: 'k', storage: store, fetchImpl: async () => { throw new Error('offline'); } });
  await offline.signOut();
  assert.equal(store.data.size, 0);
});

test('deleting the account calls the erasure function and clears the session', async () => {
  const { backend, calls, store } = setup([[200, session()], [200, null]]);
  await backend.signIn({ email: 'a@b.co', password: 'pw' });
  await backend.deleteAccount();
  assert.equal(calls[1].url, 'https://p.example/rest/v1/rpc/delete_my_account');
  assert.equal(store.data.size, 0);
});

test('calls that need a session refuse politely without one', async () => {
  const { backend, calls } = setup();
  await assert.rejects(backend.listMine(), /sign in first/);
  assert.equal(calls.length, 0);
});

test('no secret is anywhere under app/: no service-role key, no database URL', () => {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory()
    ? (entry.name === 'vendor' || entry.name === 'fonts' ? [] : walk(path.join(dir, entry.name)))
    : [path.join(dir, entry.name)]));
  for (const file of walk(path.join(ROOT, 'app')).filter((name) => /\.(js|html|css|json)$/.test(name))) {
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(!/service_role|DATABASE_URL|postgres(ql)?:\/\//i.test(text.replace(/the service-role key|service-role key/gi, '')), `${file} mentions a secret`);
  }
});
