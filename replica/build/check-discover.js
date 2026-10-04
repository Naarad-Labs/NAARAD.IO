#!/usr/bin/env node
/* End-to-end check of the live Discover screens (S01 results and map, S02 filters,
 * S03 place search), against the real index.html. This is replica-build's
 * definition of done, as a script.
 *
 *   npm i playwright axe-core leaflet@1.9.4      (anywhere; point NODE_PATH at it)
 *   NODE_PATH=$(npm root -g) node replica/build/check-discover.js
 *
 * Serves the repo on a local port. External hosts are blocked so runs are the same
 * everywhere, except: Leaflet is served from the local npm copy, and Nominatim is
 * answered by a stub (so the test never calls it). Map tiles are not loaded.
 * Writes screenshots to replica/clone-screens/.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = path.join(ROOT, 'replica', 'clone-screens') + path.sep;
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const LEAFLET_DIR = path.dirname(require.resolve('leaflet/dist/leaflet.js'));
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.gpx': 'application/gpx+xml' };
fs.mkdirSync(SHOTS, { recursive: true });

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]); if (rel === '/') rel = '/index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const PLACES = {
  chennai: [{ lat: '13.0836939', lon: '80.270186', display_name: 'Chennai, Chennai district, Tamil Nadu, India' }],
  mysuru: [{ lat: '12.2958', lon: '76.6394', display_name: 'Mysuru, Mysore taluk, Karnataka, India' }],
};

let origin, browser, failures = 0, ran = 0;
const fail = (msg) => { failures++; console.log('    PROBLEM:', msg); };
const ok = (cond, msg) => { if (!cond) fail(msg); };

/* One fresh page per scenario. opts: { w, h, url, seed: 'delay' | 'fail' | 'long', geo: 'granted' } */
async function open(opts = {}) {
  const w = opts.w || 1440, h = opts.h || 900;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, permissions: opts.geo === 'granted' ? ['geolocation'] : [], geolocation: opts.geo === 'granted' ? { latitude: 13.0827, longitude: 80.2707 } : undefined, serviceWorkers: 'block' });
  ctx.setDefaultTimeout(8000);   // a missing control should fail fast, not hang for 30 seconds
  const page = await ctx.newPage();
  page.problems = [];
  page.on('pageerror', (e) => page.problems.push('pageerror: ' + String(e).slice(0, 160)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const u = m.location().url || '';
    if (u.includes('LOGO_PLACEHOLDER')) return;   // pre-existing: <img src="LOGO_PLACEHOLDER"> is swapped by a script after the browser has requested it
    if (u.startsWith(origin) || !u) page.problems.push('console error: ' + m.text().slice(0, 160) + ' ' + u.replace(origin, ''));   // errors from blocked external hosts are expected
  });
  await page.route('**/*', async (r) => {
    const u = r.request().url();
    if (u.startsWith(origin)) {
      if (u.includes('/discover/seed-tours.json')) {
        if (opts.seed === 'fail') return r.fulfill({ status: 500, body: 'no' });
        if (opts.seed === 'delay') { await new Promise((x) => setTimeout(x, 1500)); return r.continue(); }
        if (opts.seed === 'long') {
          const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'discover', 'seed-tours.json'), 'utf8'));
          data.tours.unshift({ ...data.tours[0], id: 'long-1', slug: 'long-1', name: 'The Extraordinarily Long Named Heritage Circuit Through Old Quarters And Lanes', location_label: 'A very long place name, Somewhere In The Middle Of Nowhere, Some District, Some State' });
          return r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
        }
      }
      return r.continue();
    }
    if (u.includes('unpkg.com/leaflet@1.9.4/dist/leaflet.js')) return r.fulfill({ contentType: 'application/javascript', path: path.join(LEAFLET_DIR, 'leaflet.js') });
    if (u.includes('unpkg.com/leaflet@1.9.4/dist/leaflet.css')) return r.fulfill({ contentType: 'text/css', path: path.join(LEAFLET_DIR, 'leaflet.css') });
    if (u.startsWith('https://nominatim.openstreetmap.org/search')) {
      const q = (new URL(u).searchParams.get('q') || '').toLowerCase();
      if (q === 'boom') return r.fulfill({ status: 500, headers: { 'access-control-allow-origin': '*' }, body: 'x' });
      return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(PLACES[q] || []) });
    }
    return r.abort();
  });
  await page.goto(origin + (opts.url || '/?page=planner'), { waitUntil: 'load' });
  page.ctx = ctx;
  return page;
}
const done = async (page) => { page.problems.forEach(fail); await page.ctx.close(); };
const status = (page) => page.locator('#nd-status').innerText();
const cards = (page) => page.locator('#nd-list .nd-card:not(.nd-card--skeleton)');
async function ready(page) { await page.waitForFunction(() => { const l = document.getElementById('nd-list'); return l && l.getAttribute('aria-busy') === 'false'; }); }
async function axeCheck(page, label) {
  await page.addScriptTag({ content: AXE });
  const res = await page.evaluate(() => axe.run('#nd-root', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }));
  res.violations.forEach((v) => fail(`axe ${label}: ${v.id} (${v.impact}) ${v.help} -> ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
  return res;
}

// Below 900px the controls sit behind three chips, one panel open at a time. No-op at 900px and up.
async function panel(p, tag, id) {
  if (tag !== 'mobile') return;
  if (!(await p.evaluate((i) => document.getElementById(i).open, id))) await p.click('#' + id + ' summary');
  await p.waitForTimeout(100);
}

async function scenario(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;   // ONLY=keyboard node ... runs one scenario
  ran++; console.log('- ' + name);
  const before = failures;
  try { await fn(); } catch (e) { fail('crashed: ' + e.message.split('\n').slice(0, 3).join(' | ')); }
  if (failures === before) console.log('    ok');
}

/* ---------------------------------------------------------------- scenarios */

async function main() {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch();

  for (const [w, h, tag] of [[1440, 900, 'desktop'], [390, 844, 'mobile']]) {
    console.log(`\n== ${tag} ${w}x${h}`);

    await scenario('filled: every route, no clipping, no overflow, text 12px or more, axe clean', async () => {
      const p = await open({ w, h }); await ready(p);
      ok((await status(p)) === '21 routes', 'status should say 21 routes, got ' + (await status(p)));
      ok((await cards(p).count()) === 21, '21 cards expected');
      const m = await p.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth, innerW: innerWidth,
        clipped: [...document.querySelectorAll('#nd-list .nd-card')].filter((c) => c.scrollHeight > c.clientHeight + 1).length,
        minFont: Math.min(...[...document.querySelectorAll('#nd-root *')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => parseFloat(getComputedStyle(e).fontSize))),
        columns: getComputedStyle(document.querySelector('.nd-split')).gridTemplateColumns, handle: getComputedStyle(document.getElementById('nd-handle')).display,
        filtersOpen: document.getElementById('nd-filters').open, mapH: document.getElementById('nd-map').getBoundingClientRect().height,
        leaflet: !!document.querySelector('#nd-map .leaflet-pane'), lines: document.querySelectorAll('#nd-map path.route-line--unknown:not(.route-line--casing)').length,
        starts: document.querySelectorAll('#nd-map path.nd-start').length,
        sheetTop: document.getElementById('nd-sheet').getBoundingClientRect().top, filterBottom: document.querySelector('.nd-filterbar').getBoundingClientRect().bottom,
      }));
      ok(m.scrollW <= m.innerW, `horizontal scroll ${m.scrollW} > ${m.innerW}`);
      ok(m.clipped === 0, m.clipped + ' cards clipped');
      ok(m.minFont >= 12, 'text under 12px: ' + m.minFont);
      ok(m.leaflet, 'the Leaflet map did not start');
      const vis = await p.evaluate(() => {
        const map = document.getElementById('nd-map').getBoundingClientRect(), sheet = document.getElementById('nd-sheet').getBoundingClientRect();
        const inView = (r) => r.width >= 8 && r.height >= 8 && r.left >= map.left && r.right <= map.right && r.top >= map.top && r.bottom <= map.bottom;
        const covered = (r) => r.bottom > sheet.top && r.right > sheet.left && r.left < sheet.right && getComputedStyle(document.getElementById('nd-sheet')).position !== 'static' && innerWidth < 900;
        const starts = [...document.querySelectorAll('#nd-map path.nd-start')].map((e) => e.getBoundingClientRect());
        const flag = document.querySelector('#nd-map .leaflet-control-attribution svg'); const f = flag && flag.getBoundingClientRect();
        return { drawn: starts.filter(inView).length, hiddenBySheet: starts.filter((r) => inView(r) && covered(r)).length, flagH: f ? Math.round(f.height) : 0 };
      });
      ok(vis.drawn >= 20, `at least 20 of the 21 start markers should be visible on the map, got ${vis.drawn}`);
      if (tag === 'desktop') ok(vis.hiddenBySheet === 0, 'no marker should be hidden by the list column');
      ok(vis.flagH > 0 && vis.flagH <= 24, `Leaflet's attribution flag should be small, got ${vis.flagH}px`);
      ok(m.starts === 21, `21 start markers expected, got ${m.starts}`);
      ok(m.lines === 9, `9 real track lines expected (the unknown-difficulty ones), got ${m.lines}`);
      if (tag === 'desktop') ok(/^380px /.test(m.columns) && m.handle === 'none' && m.filtersOpen, 'desktop: 380px list column, no handle, filters open: ' + JSON.stringify(m));
      else ok(m.handle !== 'none' && !m.filtersOpen && m.sheetTop - m.filterBottom >= 160, 'phone: sheet handle, filters closed, 160px of map: ' + JSON.stringify(m));
      await axeCheck(p, tag);
      await p.screenshot({ path: `${SHOTS}S01-${tag}.png` });
      await done(p);
    });

    await scenario('every control is reachable with the filters open (nothing hides under the results sheet)', async () => {
      const p = await open({ w, h }); await ready(p);
      const unreachable = [];
      for (const [id, sel] of [[null, tag === 'mobile' ? '#nd-place, #nd-locate, .nd-pillbtn' : '#nd-place, #nd-locate'], ['nd-sport-pop', '#nd-sport label'], ['nd-within-pop', '#nd-radius'], ['nd-filters', '#nd-themes .nd-chip, #nd-longest, #nd-diffs .nd-chip']]) {
      if (id) await panel(p, tag, id);
      unreachable.push(...await p.evaluate((sel) => {
        const out = [];
        const targets = [...document.querySelectorAll(sel)];
        targets.forEach((t) => {
          t.scrollIntoView({ block: 'center' });
          const r = t.getBoundingClientRect(), top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          const visibleHere = r.width > 0 && r.height > 0 && r.bottom <= innerHeight && r.top >= 0;
          if (!visibleHere || !top || !(t === top || t.contains(top) || top.contains(t)) || top.closest('.nd-sheet')) out.push((t.id || t.textContent || t.className).trim().slice(0, 30));
        });
        return out;
      }, sel));
      }
      ok(unreachable.length === 0, 'controls hidden or covered: ' + unreachable.join(', '));
      await done(p);
    });

    await scenario('S02 filters: sport, theme, difficulty and longest narrow the list; the URL follows', async () => {
      const p = await open({ w, h }); await ready(p);
      if (tag === 'mobile') { await panel(p, tag, 'nd-filters'); await p.screenshot({ path: `${SHOTS}S02-filters-mobile.png` }); }
      await panel(p, tag, 'nd-sport-pop');
      await p.getByRole('radio', { name: 'Cycle' }).check(); await p.waitForTimeout(150);
      ok((await status(p)) === '1 route', 'Cycle should give 1 route, got ' + (await status(p)));
      await panel(p, tag, 'nd-sport-pop');
      await p.getByRole('radio', { name: 'Any' }).check(); await p.waitForTimeout(150);
      await panel(p, tag, 'nd-filters');
      await p.getByRole('button', { name: 'Easy', exact: true }).click(); await p.waitForTimeout(150);
      ok((await status(p)) === '8 routes', 'Easy should give 8 routes, got ' + (await status(p)));
      await p.getByRole('button', { name: 'Hard', exact: true }).click(); await p.waitForTimeout(150);
      ok((await status(p)) === '9 routes', 'Easy + Hard should give 9, got ' + (await status(p)));
      await p.getByRole('button', { name: 'Hard', exact: true }).click(); await p.getByRole('button', { name: 'Easy', exact: true }).click(); await p.waitForTimeout(150);
      await p.getByRole('button', { name: 'Temple trail' }).click(); await p.waitForTimeout(150);
      ok((await status(p)) === '3 routes', 'Temple trail should give 3 routes, got ' + (await status(p)));
      await p.getByRole('button', { name: 'Temple trail' }).click();
      await p.locator('#nd-longest').fill('10'); await p.waitForTimeout(400);
      const n = await cards(p).count(); ok(n > 0 && n < 21, 'longest 10 km should narrow the list, got ' + n);
      const lens = await p.$$eval('#nd-list [data-stat="distance"] strong', (els) => els.map((e) => parseFloat(e.textContent)));
      ok(lens.every((x) => x <= 10), 'every route should be 10 km or less: ' + lens.join(','));
      ok((await p.evaluate(() => location.search)).includes('max=10'), 'URL should carry max=10');
      if (tag === 'mobile') ok((await p.locator('#nd-filters-summary').innerText()).includes('(1)'), 'the Filters button should count active filters');
      await done(p);
    });

    await scenario('URL state restores the search on load', async () => {
      const p = await open({ w, h, url: '/?page=planner&mode=discover&sport=hike&diff=hard&max=100' }); await ready(p);
      ok((await status(p)) === '1 route', 'hike + hard should give 1 route (Coorg), got ' + (await status(p)));
      await panel(p, tag, 'nd-sport-pop');
      ok(await p.getByRole('radio', { name: 'Hike' }).isChecked(), 'Hike radio should be checked');
      await panel(p, tag, 'nd-filters');
      ok((await p.getByRole('button', { name: 'Hard', exact: true }).getAttribute('aria-pressed')) === 'true', 'Hard chip should be pressed');
      ok((await p.inputValue('#nd-longest')) === '100', 'longest slider should be 100');
      await done(p);
    });

    await scenario('empty state explains itself and Clear filters recovers', async () => {
      const p = await open({ w, h }); await ready(p);
      await panel(p, tag, 'nd-sport-pop');
      await p.getByRole('radio', { name: 'Run' }).check(); await p.waitForTimeout(150);
      ok((await p.locator('.nd-empty h3').innerText()) === 'No routes match', 'empty heading');
      ok((await status(p)) === '0 routes', 'status should say 0 routes');
      await p.screenshot({ path: `${SHOTS}S01-empty-${tag}.png` });
      await p.getByRole('button', { name: 'Clear filters' }).click(); await p.waitForTimeout(200);
      ok((await status(p)) === '21 routes', 'clearing should restore 21 routes');
      await done(p);
    });

    await scenario('S03 place search: found, not found, search down. Enter only: typing never calls the geocoder', async () => {
      const p = await open({ w, h }); await ready(p);
      let calls = 0; p.on('request', (r) => { if (r.url().startsWith('https://nominatim')) calls++; });
      await p.fill('#nd-place', 'Chenn'); await p.waitForTimeout(500);
      ok(calls === 0, 'typing alone must not call Nominatim (policy: no search-as-you-type); calls=' + calls);
      await p.fill('#nd-place', 'Chennai'); await p.press('#nd-place', 'Enter'); await p.waitForTimeout(500);
      ok((await status(p)) === '10 routes within 30 km of Chennai, Tamil Nadu', 'status after Chennai: ' + (await status(p)));
      ok(calls === 1, 'exactly one geocoder call, got ' + calls);
      ok(await p.locator('#nd-radius').isEnabled(), 'distance slider should be enabled once there is a place');
      const first = await p.locator('#nd-list .nd-card__meta').first().innerText(); ok(/away/.test(first), 'cards should say how far away: ' + first);
      ok((await p.evaluate(() => location.search)).includes('lat=13.08'), 'URL should carry the place');
      await p.screenshot({ path: `${SHOTS}S03-place-${tag}.png` });
      await p.fill('#nd-place', 'Zzxqv'); await p.press('#nd-place', 'Enter'); await p.waitForTimeout(400);
      ok((await p.locator('#nd-place-error').innerText()).startsWith('We could not find that place'), 'not-found message');
      ok((await p.getAttribute('#nd-place', 'aria-invalid')) === 'true', 'field should be aria-invalid');
      await p.fill('#nd-place', 'boom'); await p.press('#nd-place', 'Enter'); await p.waitForTimeout(400);
      ok((await p.locator('#nd-place-error').innerText()).includes('not available'), 'search-down message');
      await p.fill('#nd-place', ''); await p.press('#nd-place', 'Enter'); await p.waitForTimeout(300);
      ok((await status(p)) === '21 routes', 'clearing the place goes back to all of India');
      await done(p);
    });

    await scenario('use my location: granted, and denied explains what to do', async () => {
      const g = await open({ w, h, geo: 'granted' }); await ready(g);
      await g.click('#nd-locate'); await g.waitForTimeout(500);
      ok((await status(g)).includes('of My location'), 'granted: ' + (await status(g)));
      await done(g);
      const d = await open({ w, h }); await ready(d);
      await d.click('#nd-locate'); await d.waitForTimeout(500);
      ok((await d.locator('#nd-place-error').innerText()).startsWith('Location is blocked'), 'denied message: ' + (await d.locator('#nd-place-error').innerText()));
      await done(d);
    });

    await scenario('loading shows skeletons, then results', async () => {
      const p = await open({ w, h, seed: 'delay' });
      await p.waitForSelector('#nd-list .nd-card--skeleton', { timeout: 3000 });
      ok((await p.getAttribute('#nd-list', 'aria-busy')) === 'true', 'list should be aria-busy while loading');
      ok((await status(p)) === 'Loading routes…', 'status while loading');
      await ready(p); ok((await cards(p).count()) === 21, 'results arrive after loading');
      await done(p);
    });

    await scenario('error state is announced and Try again recovers', async () => {
      const p = await open({ w, h, seed: 'fail' }); await ready(p);
      ok((await p.locator('[role="alert"] h3').innerText()) === 'We could not load routes', 'error heading');
      await p.screenshot({ path: `${SHOTS}S01-error-${tag}.png` });
      await p.unroute('**/*'); await p.route('**/*', (r) => { const u = r.request().url(); return u.startsWith(origin) ? r.continue() : u.includes('leaflet@1.9.4/dist/leaflet.js') ? r.fulfill({ contentType: 'application/javascript', path: path.join(LEAFLET_DIR, 'leaflet.js') }) : r.abort(); });
      await p.getByRole('button', { name: 'Try again' }).click(); await ready(p); await p.waitForTimeout(200);
      ok((await cards(p).count()) === 21, 'Try again should load the routes');
      p.problems = p.problems.filter((x) => !/500|Failed to load resource/.test(x)); // the 500 was the point of the test
      await done(p);
    });

    await scenario('long content wraps: a 70 character name and a long place do not clip or overflow', async () => {
      const p = await open({ w, h, seed: 'long' }); await ready(p);
      const m = await p.evaluate(() => { const c = [...document.querySelectorAll('#nd-list .nd-card')].find((x) => x.textContent.includes('Extraordinarily')); return { clipped: c.scrollHeight > c.clientHeight + 1, over: c.scrollWidth > c.clientWidth + 1, scrollW: document.documentElement.scrollWidth, innerW: innerWidth, title: c.querySelector('.nd-card__title').getBoundingClientRect().height }; });
      ok(!m.clipped && !m.over && m.scrollW <= m.innerW, 'long card overflowed: ' + JSON.stringify(m));
      ok(m.title > 20, 'the long title should wrap onto more than one line');
      await done(p);
    });

    await scenario('selecting: card and map agree, and Open route page works', async () => {
      const p = await open({ w, h }); await ready(p);
      const track = p.locator('#nd-list .nd-card', { hasText: 'Marina Beach Trail' });
      await track.getByRole('button', { name: 'Marina Beach Trail' }).click(); await p.waitForTimeout(300);
      ok(await track.evaluate((e) => e.classList.contains('is-selected')), 'card should be selected');
      ok((await track.getByRole('button', { name: 'Marina Beach Trail' }).getAttribute('aria-current')) === 'true', 'aria-current on the title button');
      ok((await p.locator('#nd-map path.is-selected').count()) >= 1, 'a line or marker on the map should be selected too');
      // the other way: click a start marker on the map and the card follows
      await p.locator('#nd-map path.nd-start').nth(3).dispatchEvent('click'); await p.waitForTimeout(300);
      ok((await p.locator('#nd-list .nd-card.is-selected').count()) === 1, 'exactly one card selected after a map click');
      const hampi = p.locator('#nd-list .nd-card', { hasText: 'Hampi Vijayanagara Circuit' });
      await hampi.getByRole('button', { name: /Open the route page/ }).click(); await p.waitForTimeout(200);
      ok(await p.evaluate(() => document.getElementById('page-route-hampi').classList.contains('active')), 'the Hampi route page should open');
      await done(p);
    });

    await scenario('keyboard only: place, sport, chips, card and (phone) the sheet handle', async () => {
      const p = await open({ w, h }); await ready(p);
      await p.focus('#nd-place'); await p.keyboard.type('Chennai'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
      ok((await status(p)).includes('Chennai'), 'Enter in the place field should search');
      await p.focus('#nd-list .nd-card__link'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
      ok((await p.locator('#nd-list .nd-card.is-selected').count()) === 1, 'Enter on a title should select the card');
      const ring = await p.evaluate(() => { const b = document.querySelector('#nd-list .nd-card__link'); b.focus(); return getComputedStyle(b, '::after').outlineStyle; });
      ok(ring === 'solid', 'a focused card should show a ring, got ' + ring);
      await panel(p, tag, 'nd-sport-pop');
      await p.focus('input[name="nd-sport"][value=""]'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(200);
      ok(await p.locator('input[name="nd-sport"][value="walk"]').isChecked(), 'ArrowRight should move the sport to Walk');
      await panel(p, tag, 'nd-filters');
      await p.focus('#nd-diffs .nd-chip'); await p.keyboard.press('Space'); await p.waitForTimeout(200);
      ok((await p.locator('#nd-diffs .nd-chip').first().getAttribute('aria-pressed')) === 'true', 'Space should press a chip');
      if (tag === 'mobile') {
        await p.click('#nd-filters-summary'); await p.waitForTimeout(400);   // close the panel
        await p.focus('#nd-handle'); const a = +(await p.getAttribute('#nd-handle', 'aria-valuenow'));
        await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp'); const b = +(await p.getAttribute('#nd-handle', 'aria-valuenow'));
        ok(b > a, `ArrowUp should grow the sheet (${a} -> ${b})`);
        await p.keyboard.press('Home'); ok(+(await p.getAttribute('#nd-handle', 'aria-valuenow')) === 80, 'Home should shrink the sheet to its peek');
      }
      await done(p);
    });
  }

  /* ---- the rest of the site must still work */
  console.log('\n== regression');
  await scenario('switching to Plan mode and back; the planner bar search follows the mode', async () => {
    const p = await open({}); await ready(p);
    ok((await p.evaluate(() => getComputedStyle(document.querySelector('.pm-search-wrap')).display)) === 'none', 'the planner bar search should be hidden in Discover');
    await p.click('#pmtab-plan'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => document.getElementById('pmode-plan').classList.contains('active')), 'Plan mode should open');
    ok((await p.evaluate(() => getComputedStyle(document.querySelector('.pm-search-wrap')).display)) !== 'none', 'the planner bar search should come back in Plan mode');
    ok(await p.evaluate(() => !!document.querySelector('#plan-map .leaflet-pane')), 'the plan map should start');
    await p.click('#pmtab-discover'); await p.waitForTimeout(500);
    ok((await cards(p).count()) === 21 && await p.evaluate(() => document.getElementById('nd-map').getBoundingClientRect().height > 100), 'Discover should still be there');
    await done(p);
  });
  await scenario('other pages load; home swipe cards keep their difficulty pill colours', async () => {
    const p = await open({ url: '/' }); await p.waitForSelector('.swipe-card .diff-easy', { timeout: 5000 });   // fails loudly if the home cards do not render
    const pill = await p.evaluate(() => getComputedStyle(document.querySelector('.swipe-card .diff-easy')).color);
    ok(pill === 'rgb(74, 222, 128)', 'swipe card pill colour changed: ' + pill);
    for (const id of ['routes', 'features', 'about', 'planner', 'home']) { await p.evaluate((i) => showPage(i), id); await p.waitForTimeout(150); }
    await done(p);
  });
  await scenario('without the map library the list still works and says so', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' }); const page = await ctx.newPage(); page.problems = [];
    page.on('pageerror', (e) => page.problems.push('pageerror: ' + String(e).slice(0, 160)));
    await page.route('**/*', (r) => (r.request().url().startsWith(origin) ? r.continue() : r.abort()));
    await page.goto(origin + '/?page=planner'); await ready(page);
    ok((await cards(page).count()) === 21, 'the list should work without Leaflet');
    ok((await page.locator('#nd-map-note').innerText()).includes('map could not load'), 'a notice should say the map did not load');
    page.ctx = ctx; await done(page);
  });

  await browser.close(); server.close();
  console.log(`\n${ran} scenarios, ${failures} problem(s)`);
  console.log(failures ? 'FAILED' : 'ALL CHECKS PASSED');
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error('CRASH', e); try { server.close(); } catch (x) { /* ignore */ } process.exit(2); });
