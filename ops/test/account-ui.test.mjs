import test from 'node:test';
import assert from 'node:assert/strict';
import { FLAG_KEY, CONSENT_TEXT, enabled, renderPanel, createView } from '../../app/account-ui.js';

function storage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k), data };
}
const on = (extra = {}) => ({ search: '', storage: storage({ [FLAG_KEY]: 'on' }), configured: true, prerender: false, ...extra });

test('the panel is off unless the flag is on, the backend is configured, and this is not a pre-render', () => {
  assert.equal(enabled(on()), true);
  assert.equal(enabled({ ...on(), storage: storage() }), false);
  assert.equal(enabled(on({ configured: false })), false);
  assert.equal(enabled(on({ prerender: true })), false);
});

test('?accounts=on turns the flag on in this browser and ?accounts=off turns it off', () => {
  const store = storage();
  assert.equal(enabled({ search: '?accounts=on', storage: store, configured: true, prerender: false }), true);
  assert.equal(store.getItem(FLAG_KEY), 'on');
  assert.equal(enabled({ search: '?accounts=off', storage: store, configured: true, prerender: false }), false);
  assert.equal(store.getItem(FLAG_KEY), 'off');
});

test('a broken storage means off, never a crash', () => {
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(enabled({ search: '?accounts=on', storage: broken, configured: true, prerender: false }), false);
});

test('signed out, sign-in mode: labelled email and password, right autocomplete, a way to switch, no age box', () => {
  const html = renderPanel({ session: null, mode: 'in' });
  assert.match(html, /<form[^>]*data-account-form[^>]*data-mode="in"/);
  assert.match(html, /<label[^>]*>[^<]*Email/);
  assert.match(html, /type="email"[^>]*autocomplete="email"|autocomplete="email"[^>]*type="email"/);
  assert.match(html, /type="password"[^>]*autocomplete="current-password"|autocomplete="current-password"[^>]*type="password"/);
  assert.match(html, /data-account-mode="up"/);
  assert.doesNotMatch(html, /over18/);
});

test('sign-up mode: new-password, a minimum length, a required 18-or-over box, the notice, a way back', () => {
  const html = renderPanel({ session: null, mode: 'up' });
  assert.match(html, /data-mode="up"/);
  assert.match(html, /autocomplete="new-password"/);
  assert.match(html, /minlength="8"/);
  assert.match(html, /<input[^>]*type="checkbox"[^>]*name="over18"[^>]*required|<input[^>]*name="over18"[^>]*type="checkbox"[^>]*required/);
  assert.match(html, /18 or (older|over)/i);
  assert.ok(html.includes(CONSENT_TEXT));
  assert.match(html, /data-account-mode="in"/);
});

test('the notice says what is kept, why, and that it can all be deleted', () => {
  assert.match(CONSENT_TEXT, /email/i);
  assert.match(CONSENT_TEXT, /draft/i);
  assert.match(CONSENT_TEXT, /delete/i);
  assert.ok(CONSENT_TEXT.length < 400, 'short enough to be read');
});

test('a password field never carries a value back into the page', () => {
  for (const mode of ['in', 'up']) assert.doesNotMatch(renderPanel({ session: null, mode, email: 'person@example.com' }).match(/<input[^>]*type="password"[^>]*>/)[0], /value=/);
});

test('an email the person typed is put back, escaped', () => {
  assert.match(renderPanel({ session: null, mode: 'in', email: 'person@example.com' }), /value="person@example\.com"/);
  const html = renderPanel({ session: null, mode: 'in', email: '"><script>alert(1)</script>' });
  assert.doesNotMatch(html, /<script>/);
});

test('an error is announced to screen readers and escaped, whatever the server sent', () => {
  const html = renderPanel({ session: null, mode: 'in', error: '<img src=x onerror=alert(1)>' });
  assert.match(html, /role="alert"/);
  assert.match(html, /data-account-error/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(renderPanel({ session: null, mode: 'in', error: '' }), /data-account-error/);
});

test('while a request is out the button is disabled and says so', () => {
  const html = renderPanel({ session: null, mode: 'in', busy: true });
  assert.match(html, /<button[^>]*type="submit"[^>]*disabled|<button[^>]*disabled[^>]*type="submit"/);
  assert.match(html, /aria-busy="true"/);
});

test('after sign-up the person is told to confirm their email, and can go to sign in', () => {
  const html = renderPanel({ session: null, mode: 'in', pending: true, email: 'person@example.com' });
  assert.match(html, /Check your (inbox|email)/i);
  assert.match(html, /person@example\.com/);
  assert.match(html, /data-account-mode="in"/);
});

test('signed in: shows who, offers sign out, and no password field', () => {
  const html = renderPanel({ session: { user: { id: 'u1', email: 'person@example.com' } }, mode: 'in' });
  assert.match(html, /Signed in as[^<]*person@example\.com/);
  assert.match(html, /data-account-signout/);
  assert.doesNotMatch(html, /type="password"/);
  assert.doesNotMatch(renderPanel({ session: { user: { email: '<b>x</b>' } }, mode: 'in' }), /<b>x<\/b>/);
});

test('touch targets and landmarks: the panel is a labelled region', () => {
  const html = renderPanel({ session: null, mode: 'in' });
  assert.match(html, /<section[^>]*aria-labelledby="account-title"/);
  assert.match(html, /id="account-title"/);
});

test('the view holder merges changes, resets to signed-out defaults, and hands out copies', () => {
  const view = createView();
  assert.deepEqual(view.get(), { mode: 'in', pending: false, email: '', error: '', busy: false });
  view.set({ mode: 'up', error: 'x' });
  assert.equal(view.get().mode, 'up');
  assert.equal(view.get().busy, false);
  view.get().mode = 'hacked';
  assert.equal(view.get().mode, 'up');
  view.reset();
  assert.deepEqual(view.get(), { mode: 'in', pending: false, email: '', error: '', busy: false });
});

test('signed in: deleting the account takes a second, explicit step that says what is erased', () => {
  const session = { user: { email: 'person@example.com' } };
  const first = renderPanel({ session });
  assert.match(first, /data-account-delete(?!-)/);
  assert.doesNotMatch(first, /data-account-delete-confirm/);
  const second = renderPanel({ session, confirmDelete: true });
  assert.match(second, /data-account-delete-confirm/);
  assert.match(second, /data-account-delete-cancel/);
  assert.match(second, /erases your account and every draft/i);
});
