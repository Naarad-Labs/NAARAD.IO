#!/usr/bin/env node
/* Takes the clone's side of the layout diff (replica/parity.md): the Discover area only, at 390 px wide,
 * in the same states as the original's phone screenshots (replica/screens-notes.md).
 *
 *   NODE_PATH=$(npm root -g) node replica/build/diff-screens.js
 *
 * Writes replica/clone-screens/D-*.png (2x) and replica/diffs/clone-geometry.json (where the parts are). The original's side is cropped to the same area, since its
 * screenshots include the Android status bar and tab bar, which the clone does not have:
 *
 *   convert replica/screens/orig-m-map-chennai.jpg -crop 1080x1938+0+90 +repage replica/screens/crop-map-chennai.png
 *   python3 .claude/skills/replica-diff/imgdiff.py replica/screens/crop-map-chennai.png replica/clone-screens/D-map-place.png --json
 *
 * Same server and stubs as check-discover.js: real Leaflet, no map tiles, a stub geocoder.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'replica', 'clone-screens') + path.sep;
const LEAFLET_DIR = path.dirname(require.resolve('leaflet/dist/leaflet.js'));
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]); if (rel === '/') rel = '/index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch();

  async function open() {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    await page.route('**/*', (r) => {
      const u = r.request().url();
      if (u.startsWith(origin)) return r.continue();
      if (u.includes('leaflet@1.9.4/dist/leaflet.js')) return r.fulfill({ contentType: 'application/javascript', path: path.join(LEAFLET_DIR, 'leaflet.js') });
      if (u.includes('leaflet@1.9.4/dist/leaflet.css')) return r.fulfill({ contentType: 'text/css', path: path.join(LEAFLET_DIR, 'leaflet.css') });
      if (u.startsWith('https://nominatim.openstreetmap.org/')) return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify([{ lat: '13.0836939', lon: '80.270186', display_name: 'Chennai, Chennai district, Tamil Nadu, India' }]) });
      return r.abort();
    });
    await page.goto(origin + '/?page=planner');
    await page.waitForFunction(() => document.getElementById('nd-list').getAttribute('aria-busy') === 'false');
    await page.waitForTimeout(400);
    return { page, ctx };
  }
  const shot = async (page, name) => { await page.waitForTimeout(500); await page.locator('#nd-discover').screenshot({ path: OUT + name }); console.log('wrote', name); };

  // Positions of the parts, in CSS px from the top left of the Discover area, for the measured comparison in parity.md.
  const measure = (page, list) => page.evaluate((list) => {
    const area = document.getElementById('nd-discover').getBoundingClientRect();
    const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left - area.left), y: Math.round(b.top - area.top), w: Math.round(b.width), h: Math.round(b.height) }; };
    const chips = [...document.querySelectorAll('.nd-chiprow > details > summary')].map(r);
    const out = { area: { w: Math.round(area.width), h: Math.round(area.height) }, pill: r(document.querySelector('.nd-search__pill')), chips, sheet: r(document.getElementById('nd-sheet')), handle: r(document.querySelector('.nd-sheet__handle')), count: r(document.getElementById('nd-status')) };
    if (list) {
      // Inside a card, positions are from the card's own top. The first card is a curated route (rating and badge, no drawn track);
      // the first track card has the tall media. The original's card has all of them, which no one card of ours does.
      const cards = [...document.querySelectorAll('#nd-list .nd-card')], track = cards.find((c) => !c.querySelector('.nd-card__media--none'));
      const rel = (card, el) => { if (!el) return null; const c = card.getBoundingClientRect(), b = el.getBoundingClientRect(); return { x: Math.round(b.left - c.left), y: Math.round(b.top - c.top), w: Math.round(b.width), h: Math.round(b.height) }; };
      const describe = (card) => ({ size: r(card), media: rel(card, card.querySelector('.nd-card__media')), badge: rel(card, card.querySelector('.nd-badge')), rating: rel(card, card.querySelector('.nd-card__rating')), title: rel(card, card.querySelector('.nd-card__title')), meta: rel(card, card.querySelector('.nd-card__meta')), stats: rel(card, card.querySelector('.nd-card__stats')) });
      out.firstCard = describe(cards[0]); out.trackCard = describe(track);
      out.cardGap = Math.round(cards[1].getBoundingClientRect().top - cards[0].getBoundingClientRect().bottom);
      out.mapButton = r(document.getElementById('nd-mapbtn'));
    }
    return out;
  }, list);
  const geometry = {};

  // 1. Map view, zoomed out, no place, sheet collapsed to its peek  (original: orig-m-map-wide, "14 runs")
  let { page, ctx } = await open();
  await page.focus('#nd-handle'); await page.keyboard.press('Home');
  await shot(page, 'D-map-wide.png');
  geometry.mapWide = await measure(page, false);

  // 2. Map view after searching Chennai, sheet at its peek  (original: orig-m-map-chennai, "2 runs")
  await page.fill('#nd-place', 'Chennai'); await page.press('#nd-place', 'Enter');
  await page.waitForFunction(() => /Chennai/.test(document.getElementById('nd-status').textContent));
  await page.locator('#nd-status').click();   // the hint steps aside, focus ring off the pill
  await page.focus('#nd-handle'); await page.keyboard.press('Home');
  await shot(page, 'D-map-place.png');
  geometry.mapPlace = await measure(page, false);
  await ctx.close();

  // 3. List view, top of the list  (original: orig-m-routes-list-top)
  ({ page, ctx } = await open());
  await page.click('#nd-handle');
  await page.mouse.move(5, 5);
  await shot(page, 'D-list.png');
  geometry.list = await measure(page, true);
  await ctx.close();
  fs.writeFileSync(path.join(ROOT, 'replica', 'diffs', 'clone-geometry.json'), JSON.stringify(geometry, null, 2) + '\n');
  console.log('wrote replica/diffs/clone-geometry.json');

  await browser.close(); server.close();
})().catch((e) => { console.error('CRASH', e.message); server.close(); process.exit(2); });
