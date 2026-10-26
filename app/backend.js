/* The Naarad backend: accounts and Studio submissions on Supabase.
 *
 * Plain fetch against Supabase's auth (GoTrue) and REST (PostgREST) endpoints,
 * so there is no library to vendor. Everything it can do is limited by row level
 * security in supabase/migrations, not by this file: the key in the browser is
 * public. While app/config.js is empty it is off, and every call says so.
 *
 * The session (access and refresh token) is kept in this browser's
 * localStorage, the same place My Journey lives. Signing out clears it.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const KEY = 'naarad.auth.v1';
/* A pre-rendered page is the same for everyone, so the build never reads or
   writes a session (main.js explains the mode). */
const PRERENDER = Boolean(globalThis.__NAARAD_PRERENDER__);

export class BackendError extends Error {
  constructor(message, status) { super(message); this.name = 'BackendError'; this.status = status; }
}

export function createBackend({
  url = SUPABASE_URL,
  anonKey = SUPABASE_ANON_KEY,
  fetchImpl = globalThis.fetch && globalThis.fetch.bind(globalThis),
  storage = (() => { try { return globalThis.localStorage; } catch { return null; } })(),
  now = () => Date.now(),
} = {}) {
  const base = String(url || '').replace(/\/$/, '');
  const configured = () => Boolean(base && anonKey && fetchImpl) && !PRERENDER;

  function load() {
    try { return JSON.parse(storage.getItem(KEY) || 'null'); } catch { return null; }
  }
  function save(session) {
    try { if (session) storage.setItem(KEY, JSON.stringify(session)); else storage.removeItem(KEY); } catch { /* private mode */ }
  }
  function keep(body) {
    if (!body || !body.access_token) return null;
    const session = {
      access_token: body.access_token,
      refresh_token: body.refresh_token,
      expires_at: body.expires_at ? body.expires_at * 1000 : now() + (body.expires_in || 3600) * 1000,
      user: body.user ? { id: body.user.id, email: body.user.email } : (load() || {}).user || null,
    };
    save(session);
    return session;
  }

  async function raw(path, { method = 'GET', body, token, headers = {} } = {}) {
    if (!configured()) throw new BackendError('Accounts are not available yet.', 0);
    let response;
    try {
      response = await fetchImpl(`${base}${path}`, {
        method,
        headers: { apikey: anonKey, authorization: `Bearer ${token || anonKey}`, 'content-type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new BackendError('No connection. Nothing was sent.', 0);
    }
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!response.ok) {
      throw new BackendError((data && (data.msg || data.message || data.error_description || data.error)) || `The server answered ${response.status}.`, response.status);
    }
    return data;
  }

  async function refresh() {
    const current = load();
    if (!current || !current.refresh_token) throw new BackendError('Please sign in again.', 401);
    try {
      return keep(await raw('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: current.refresh_token } }));
    } catch (error) {
      if (error.status === 400 || error.status === 401) save(null);
      throw error;
    }
  }

  /* A signed-in call; one refresh and one retry if the token has gone stale. */
  async function authed(path, options = {}) {
    let session = load();
    if (!session) throw new BackendError('Please sign in first.', 401);
    if (session.expires_at - now() < 30000) session = await refresh();
    try {
      return await raw(path, { ...options, token: session.access_token });
    } catch (error) {
      if (error.status !== 401) throw error;
      session = await refresh();
      return raw(path, { ...options, token: session.access_token });
    }
  }

  return {
    configured,
    session: () => (configured() ? load() : null),

    /* Creating an account records, in the account itself, that the person said
       they are 18 or older. Under 18 needs a parent's consent this site does not
       collect yet, so it is refused here, before anything is sent. */
    async signUp({ email, password, over18 }) {
      if (over18 !== true) throw new BackendError('Accounts are for people aged 18 or over for now.', 0);
      const body = await raw('/auth/v1/signup', { method: 'POST', body: { email, password, data: { over_18: true } } });
      return keep(body);   // null when the project asks the person to confirm their email first
    },
    async signIn({ email, password }) {
      return keep(await raw('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } }));
    },
    async signOut() {
      const session = load();
      save(null);          // signing out always works locally, even with no network
      if (session) { try { await raw('/auth/v1/logout', { method: 'POST', token: session.access_token }); } catch { /* the token expires on its own */ } }
    },

    /* Save a Studio draft; `send: true` marks it submitted for review. A creator
       cannot approve, reject or write the reviewer's note: the database refuses. */
    async saveSubmission({ id = null, title, draft, send = false }) {
      const row = { title, draft, status: send ? 'submitted' : 'draft' };
      const rows = id
        ? await authed(`/rest/v1/creator_submissions?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: row, headers: { prefer: 'return=representation' } })
        : await authed('/rest/v1/creator_submissions', { method: 'POST', body: row, headers: { prefer: 'return=representation' } });
      return Array.isArray(rows) ? rows[0] : rows;
    },
    listMine() {
      return authed('/rest/v1/creator_submissions?select=id,title,status,review_note,updated_at&order=updated_at.desc');
    },
    /* Erasure: removes the account and everything it wrote (DPDP right to erasure). */
    async deleteAccount() {
      await authed('/rest/v1/rpc/delete_my_account', { method: 'POST', body: {} });
      save(null);
    },
  };
}

export const backend = createBackend();
