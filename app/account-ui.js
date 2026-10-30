/* Account user interface, behind a feature flag.
 *
 * Provides the account panel rendering, consent notice, feature flag
 * state check, and view state holder.
 */

export const FLAG_KEY = 'naarad.flag.accounts';

export const CONSENT_TEXT =
  'Naarad keeps your email address and the route drafts you write so you can send routes for review. You can delete your account and everything you wrote at any time.';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function enabled({ search, storage, configured, prerender } = {}) {
  if (prerender || !configured) return false;
  try {
    const params = new URLSearchParams(search || '');
    const flag = params.get('accounts');
    if (flag === 'on' || flag === 'off') {
      storage.setItem(FLAG_KEY, flag);
    }
    return storage.getItem(FLAG_KEY) === 'on';
  } catch {
    return false;
  }
}

export function createView() {
  const defaults = { mode: 'in', pending: false, email: '', error: '', busy: false };
  let state = { ...defaults };
  return {
    get() {
      return { ...state };
    },
    set(patch) {
      state = { ...state, ...patch };
    },
    reset() {
      state = { ...defaults };
    },
  };
}

export function renderPanel(view = {}) {
  const mode = view.mode === 'up' ? 'up' : 'in';
  const errorHtml = view.error
    ? `<p class="account-error" role="alert" data-account-error>${escapeHtml(view.error)}</p>`
    : '';

  let bodyHtml = '';

  if (view.session) {
    const email = view.session.user?.email || view.session.email || '';
    const erase = view.confirmDelete
      ? `<p role="alert">This erases your account and every draft you sent for review. It cannot be undone.</p>` +
        `<button type="button" class="button button-sm" data-account-delete-confirm>Delete everything</button> ` +
        `<button type="button" class="button button-sm" data-account-delete-cancel>Keep my account</button>`
      : `<button type="button" class="button button-sm" data-account-delete>Delete my account</button>`;
    bodyHtml = `<p>Signed in as ${escapeHtml(email)}</p><button type="button" class="button button-sm" data-account-signout>Sign out</button> ${erase}`;
  } else if (view.pending) {
    bodyHtml = `<p>Check your inbox to confirm ${escapeHtml(view.email || '')}.</p><button type="button" class="button button-sm" data-account-mode="in">Sign in</button>`;
  } else {
    const isUp = mode === 'up';
    const pwdAttrs = isUp
      ? 'autocomplete="new-password" minlength="8"'
      : 'autocomplete="current-password"';
    const extraFields = isUp
      ? `<p><label><input type="checkbox" name="over18" required> I am 18 or older</label></p><p>${CONSENT_TEXT}</p>`
      : '';
    const submitLabel = isUp ? 'Create account' : 'Sign in';
    const switchMode = isUp ? 'in' : 'up';
    const switchLabel = isUp ? 'I already have an account' : 'Create an account';
    const busyAttr = view.busy ? ' aria-busy="true"' : '';
    const disabledAttr = view.busy ? ' disabled' : '';

    bodyHtml = `<form data-account-form data-mode="${mode}" novalidate${busyAttr}>` +
      `<p><label>Email <input type="email" name="email" autocomplete="email" required value="${escapeHtml(view.email || '')}"></label></p>` +
      `<p><label>Password <input type="password" name="password" ${pwdAttrs} required></label></p>` +
      `${extraFields}` +
      `<button type="submit" class="button button-primary"${disabledAttr}>${submitLabel}</button>` +
      `<button type="button" class="button button-sm" data-account-mode="${switchMode}">${switchLabel}</button>` +
      `</form>`;
  }

  return `<section class="account-panel" aria-labelledby="account-title"><h2 id="account-title">Account</h2>${errorHtml}${bodyHtml}</section>`;
}
