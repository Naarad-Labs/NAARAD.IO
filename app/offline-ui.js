/* The offline bar, and the marks on routes that are not saved.
 *
 * Behind the offline-bundles flag (offline-bundles.js). When the browser says
 * there is no network, a slim bar says so, and every link to a route that is
 * not saved on this device is marked and does not navigate: the alternative is
 * a dead end with no explanation. The decisions live in offline-state.js; this
 * file only reads the page and the browser and applies them.
 *
 * The SW update prompt (app/offline-ui.js, sw.js SWUpdateBanner). When a new
 * service worker is found, the page shows a banner "New version available — Reload"
 * that the visitor can dismiss or click to refresh.
 */

import * as Offline from './offline-bundles.js';
import * as Journey from './journey-store.js';
import * as State from './offline-state.js';

let started = false;
let observer = null;
let timer = null;
let updateBanner = null;

const savedSlugs = () => Journey.getDownloads().map((entry) => entry.slug);
const online = () => State.isOnline(globalThis.navigator);

function context() {
  return { origin: globalThis.location.origin, online: online(), savedSlugs: savedSlugs(), enabled: Offline.enabled() };
}

function barHost() {
  let host = document.getElementById('offline-bar-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'offline-bar-host';
    document.body.prepend(host);
  }
  return host;
}

function applyMarks(root, ctx) {
  const links = [...root.querySelectorAll('a[href]')];
  const flags = State.markLinks(links.map((link) => link.getAttribute('href')), ctx);
  links.forEach((link, index) => {
    const note = link.querySelector(':scope > .unsaved-note');
    if (flags[index]) {
      link.setAttribute('data-unsaved-offline', '');
      link.setAttribute('aria-disabled', 'true');
      if (!note) {
        const label = document.createElement('span');
        label.className = 'unsaved-note';
        label.textContent = State.UNSAVED_LABEL;
        link.append(label);
      }
    } else {
      link.removeAttribute('data-unsaved-offline');
      link.removeAttribute('aria-disabled');
      if (note) note.remove();
    }
  });
}

/** Draw the bar and the marks for the browser's current state. Safe to call often. */
export function refresh() {
  const ctx = context();
  if (observer) observer.disconnect();           // our own changes must not trigger us
  const model = ctx.enabled ? State.barModel({ online: ctx.online, savedCount: ctx.savedSlugs.length }) : { visible: false, text: '' };
  const host = document.getElementById('offline-bar-host');
  if (host || model.visible) barHost().innerHTML = State.renderBar(model);
  const main = document.getElementById('app-content');
  if (main) applyMarks(main, ctx);
  if (observer && main) observer.observe(main, { childList: true, subtree: true });
}

/** Start listening to the browser. Does nothing unless the flag is on. */
export function start() {
  if (started || !Offline.enabled()) return;
  started = true;
  globalThis.addEventListener('online', refresh);
  globalThis.addEventListener('offline', refresh);
  const main = document.getElementById('app-content');
  if (main) {
    observer = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(refresh, 50); });
    observer.observe(main, { childList: true, subtree: true });
  }
  refresh();
}

/** Would opening this address be a dead end right now? */
export function blocks(url) {
  return State.blocksNavigation({ ...context(), url: String(url) });
}

/* ── SW update prompt ───────────────────────────────────────────────────── */

const updateHostId = 'sw-update-host';

function updateBannerHtml() {
  return `<div id="${updateHostId}" class="sw-update-banner" role="status">
    <span>New version available. <button id="sw-update-reload" class="sw-update-btn">Reload</button></span>
    <button id="sw-update-dismiss" class="sw-update-dismiss" aria-label="Dismiss update notice">&times;</button>
  </div>`;
}

export function showUpdateBanner() {
  if (updateBanner) return;          // already visible
  let host = document.getElementById(updateHostId);
  if (!host) {
    host = document.createElement('div');
    host.id = updateHostId;
    document.body.prepend(host);
    host.innerHTML = updateBannerHtml();
    host.querySelector('#sw-update-reload')?.addEventListener('click', () => location.reload());
    host.querySelector('#sw-update-dismiss')?.addEventListener('click', () => {
      host.remove();
      updateBanner = null;
    });
    updateBanner = host;
  }
}

export function hideUpdateBanner() {
  if (updateBanner) { updateBanner.remove(); updateBanner = null; }
}

/** Check and optionally show the update banner. Returns true if an update is waiting. */
export function checkUpdate() {
  const registration = globalThis.navigator?.serviceWorker?.controller;
  if (!registration) return false;
  const waiting = globalThis.registration?.waiting;
  if (!waiting) return false;
  showUpdateBanner();
  return true;
}
