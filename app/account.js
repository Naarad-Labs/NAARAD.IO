/* The sign-in panel's wiring: what happens when the form is sent.
 *
 * Behind the accounts flag (account-ui.js), and only when app/config.js holds a
 * project URL and key. The password is read from the form once, sent, and never
 * kept: the panel is drawn again from state that has no password in it.
 */

import { backend } from './backend.js';
import * as UI from './account-ui.js';

const view = UI.createView();
const PRERENDER = Boolean(globalThis.__NAARAD_PRERENDER__);

function storage() {
  try { return globalThis.localStorage; } catch { return null; }
}

export function isOn() {
  return UI.enabled({
    search: globalThis.location ? globalThis.location.search : '',
    storage: storage(),
    configured: backend.configured(),
    prerender: PRERENDER,
  });
}

/** The panel's HTML, or nothing at all when the flag is off. */
export function panel() {
  return isOn() ? UI.renderPanel({ ...view.get(), session: backend.session() }) : '';
}

/** A sign-in or sign-up form was sent. `repaint` draws the page again. */
export async function submit(form, repaint) {
  const data = new FormData(form);
  const mode = form.dataset.mode === 'up' ? 'up' : 'in';
  const email = String(data.get('email') || '').trim();
  const password = String(data.get('password') || '');
  const refuse = async (error) => { view.set({ mode, email, error, busy: false }); await repaint(); };

  if (!email || !password) return refuse('Enter your email address and your password.');
  if (mode === 'up' && data.get('over18') !== 'on') return refuse('Accounts are for people aged 18 or over.');
  if (mode === 'up' && password.length < 8) return refuse('Use a password of at least 8 characters.');

  view.set({ mode, email, error: '', busy: true });
  await repaint();
  try {
    if (mode === 'up') {
      const session = await backend.signUp({ email, password, over18: true });
      view.set(session ? { mode: 'in', pending: false } : { mode: 'in', pending: true });
    } else {
      await backend.signIn({ email, password });
      view.reset();
    }
  } catch (error) {
    view.set({ error: error.message || 'Something went wrong. Nothing was sent.' });
  }
  view.set({ busy: false });
  await repaint();
}

/** A button inside the panel: switch between sign in and sign up, or sign out. */
export async function click(button, repaint) {
  if (button.hasAttribute('data-account-signout')) {
    await backend.signOut();
    view.reset();
  } else if (button.hasAttribute('data-account-delete')) {
    view.set({ confirmDelete: true, error: '' });
  } else if (button.hasAttribute('data-account-delete-cancel')) {
    view.set({ confirmDelete: false });
  } else if (button.hasAttribute('data-account-delete-confirm')) {
    try { await backend.deleteAccount(); view.reset(); } catch (error) { view.set({ confirmDelete: false, error: error.message || 'Nothing was deleted.' }); }
  } else {
    view.set({ mode: button.dataset.accountMode === 'up' ? 'up' : 'in', pending: false, error: '' });
  }
  await repaint();
}

/** Is someone signed in here (and the flag on)? */
export const signedIn = () => isOn() && Boolean(backend.session());

/** Send one Studio draft for review. Returns true when the server has it. */
export async function send(draft, repaint) {
  try {
    await backend.saveSubmission({ title: String(draft.title || 'Untitled story').slice(0, 160), draft: {
      routeSlug: draft.routeSlug, stopOrder: draft.stopOrder, language: draft.language, transcript: draft.transcript,
      summary: draft.summary, targetLanguages: draft.targetLanguages,
    }, send: true });
    return true;
  } catch (error) {
    view.set({ error: error.message || 'Nothing was sent.' });
    await repaint();
    return false;
  }
}
