// Shared fixtures. Every test gets a page that:
//   - is cut off from the internet, except that Leaflet comes from the local npm copy and the
//     geocoder (Nominatim) is answered by a stub the test can control through `env.nominatim`
//   - fails the test on any console error, page error or 5xx from our own server
// Tests that expect a failure on purpose (a 500 from the seed, say) say so in `env.allow`.
const base = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default || require('@axe-core/playwright');
const fs = require('fs');
const path = require('path');

const { expect } = base;
const ROOT = path.resolve(__dirname, '..');
const LEAFLET = path.dirname(require.resolve('leaflet/dist/leaflet.js'));

const PLACES = {
  chennai: [{ lat: '13.0836939', lon: '80.270186', display_name: 'Chennai, Chennai district, Tamil Nadu, India' }],
  mysuru: [{ lat: '12.2958', lon: '76.6394', display_name: 'Mysuru, Mysore taluk, Karnataka, India' }],
  delhi: [{ lat: '28.6138954', lon: '77.2090057', display_name: 'Delhi, New Delhi, Delhi, India' }],
};

/** What the stub geocoder says for a query. Return an array of places, or 'down' for a 500. */
function defaultAnswer(q) {
  const key = q.trim().toLowerCase();
  return PLACES[key] || [];
}

function installRoutes(page, env, baseURL) {
  return page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith(baseURL)) {
      if (url.includes('/discover/seed-tours.json')) {
        if (env.seed === 'fail') return route.fulfill({ status: 500, body: 'no' });
        if (env.seedDelayMs) await new Promise((r) => setTimeout(r, env.seedDelayMs));
        if (env.seed === 'long') {
          const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'discover', 'seed-tours.json'), 'utf8'));
          data.tours.unshift({ ...data.tours[0], id: 'long-1', slug: 'long-1', name: 'The Extraordinarily Long Named Heritage Circuit Through Old Quarters And Lanes', location_label: 'A very long place name, Somewhere In The Middle Of Nowhere, Some District, Some State' });
          return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
        }
      }
      return route.continue();
    }
    if (url.includes('unpkg.com/leaflet@1.9.4/dist/leaflet.js')) return env.noLeaflet ? route.abort() : route.fulfill({ contentType: 'application/javascript', path: path.join(LEAFLET, 'leaflet.js') });
    if (url.includes('unpkg.com/leaflet@1.9.4/dist/leaflet.css')) return route.fulfill({ contentType: 'text/css', path: path.join(LEAFLET, 'leaflet.css') });
    if (url.startsWith('https://nominatim.openstreetmap.org/')) {
      const q = new URL(url).searchParams.get('q') || '';
      env.nominatim.urls.push(url);
      env.nominatim.queries.push(q);
      if (env.nominatim.delayMs) await new Promise((r) => setTimeout(r, env.nominatim.delayMs));
      const answer = env.nominatim.answer(q);
      const headers = { 'access-control-allow-origin': '*' };
      if (answer === 'down') return route.fulfill({ status: 500, headers, body: 'x' });
      return route.fulfill({ contentType: 'application/json', headers, body: JSON.stringify(answer) });
    }
    return route.abort();
  });
}

function watch(page, env, baseURL) {
  page.on('pageerror', (e) => env.problems.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = m.location().url || '';
    if (url.includes('LOGO_PLACEHOLDER')) return;   // known: the logo <img> ships with a placeholder src that a script swaps afterwards
    if (url.startsWith(baseURL) || !url) env.problems.push('console error: ' + m.text() + ' ' + url.replace(baseURL, ''));
  });
  page.on('response', (r) => { if (r.status() >= 500 && r.url().startsWith(baseURL)) env.problems.push(`${r.status()} on ${r.url()}`); });
}

const test = base.test.extend({
  env: async ({}, use) => {
    await use({
      seed: 'ok', seedDelayMs: 0, noLeaflet: false, allow: [], problems: [],
      nominatim: { urls: [], queries: [], delayMs: 0, answer: defaultAnswer },
    });
  },
  page: async ({ page, env, baseURL }, use) => {
    watch(page, env, baseURL);
    await installRoutes(page, env, baseURL);
    await use(page);
    const real = env.problems.filter((p) => !env.allow.some((a) => p.includes(a)));
    expect(real, 'console errors, page errors or 5xx during the test').toEqual([]);
  },
});

/* ------------------------------------------------------------------ helpers */

const root = (page) => page.locator('#nd-root');
const statusOf = (page) => root(page).getByRole('status');
const articles = (page) => root(page).getByRole('article');
const placeField = (page) => root(page).getByLabel('Place');
const isPhone = (page) => (page.viewportSize() || { width: 1440 }).width < 900;

async function ready(page) {
  await expect(page.locator('#nd-list')).toHaveAttribute('aria-busy', 'false');
}

/** On a phone the filters sit behind a button. Opens them if they are closed. */
async function openFilters(page) {
  if (!isPhone(page)) return;
  const filters = page.locator('#nd-filters');
  if (!(await filters.evaluate((d) => d.open))) await root(page).locator('summary').click();
  await expect(filters).toHaveJSProperty('open', true);
}

async function goDiscover(page, query = '') {
  await page.goto('/?page=planner' + query);
  await ready(page);
}

async function axeViolations(page, label) {
  const result = await new AxeBuilder({ page }).include('#nd-root').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  return result.violations.map((v) => `${label}: ${v.id} (${v.impact}) ${v.help} -> ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
}

const DESKTOP = { name: 'desktop', size: { width: 1440, height: 900 } };
const PHONE = { name: 'phone', size: { width: 390, height: 844 } };

module.exports = { test, expect, root, statusOf, articles, placeField, isPhone, ready, openFilters, goDiscover, axeViolations, installRoutes, watch, PLACES, DESKTOP, PHONE };
