/* Storage budget: how much room is left, and whether a download fits.
 *
 * The browser's Storage API tells us how much of the quota is used and how
 * much is left. We keep a safety margin so a download never fills the store
 * to the last byte. If the browser will not tell us (no estimate, or a zero
 * quota), we assume we can try and let the write fail if it cannot.
 *
 * Persistence is a separate ask: the browser may drop cached data when space
 * runs low unless we ask it to keep it. We ask once, and report plainly what
 * the answer was.
 */

export function formatBytes(bytes) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export class SpaceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SpaceError';
  }
}

export function assessSpace(estimate, needBytes, margin = 1_000_000) {
  if (!estimate || !Number.isFinite(estimate.usage) || !Number.isFinite(estimate.quota) || estimate.quota === 0) {
    return { ok: true, free: null, need: needBytes, message: '' };
  }
  const free = Math.max(0, estimate.quota - estimate.usage);
  const ok = free >= needBytes + margin;
  const message = ok
    ? ''
    : `There is not enough space. This needs ${formatBytes(needBytes)} but only ${formatBytes(free)} is free. Remove a saved route or free up space and try again.`;
  return { ok, free, need: needBytes, message };
}

export function isQuotaError(error) {
  if (!error) return false;
  if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
  if (error.code === 22 || error.code === 1014) return true;
  if (typeof error.message === 'string' && /quota/i.test(error.message)) return true;
  return false;
}

export async function requestPersistence(nav = globalThis.navigator) {
  try {
    if (!nav || !nav.storage || typeof nav.storage.persisted !== 'function' || typeof nav.storage.persist !== 'function') {
      return 'unsupported';
    }
    const already = await nav.storage.persisted();
    if (already) return 'granted';
    const granted = await nav.storage.persist();
    return granted ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

export function persistenceNote(result) {
  if (result === 'granted') return 'Your browser will keep this unless you remove it.';
  if (result === 'denied') return 'Your browser may remove this if space runs low.';
  return '';
}
