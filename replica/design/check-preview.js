#!/usr/bin/env node
/* Design-system check for replica/design/preview.html.
 *
 *   npm i playwright axe-core        (anywhere; then point NODE_PATH at it)
 *   NODE_PATH=$(npm root -g) node replica/design/check-preview.js
 *
 * Serves the repo on a local port, opens the preview at desktop (1440) and
 * phone (390) width, and fails if any of these is false:
 *   - axe-core finds no WCAG 2.x A/AA or best-practice violations
 *   - no horizontal scroll, no text under 12px, nothing clipped in the results list
 *   - on a phone the map keeps at least 160px above the results sheet
 *   - the sheet handle works from the keyboard (arrows, Home, End)
 * Writes preview-desktop.png, preview-desktop-full.png and preview-mobile.png
 * next to the preview. External hosts (fonts) are blocked so runs are the same
 * everywhere, which means the screenshots use the system sans, not Inter.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = __dirname + path.sep;
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch();
  let problems = 0;
  const fail = msg => { problems++; console.log('  PROBLEM:', msg); };

  for (const [w, h, tag] of [[1440, 900, 'desktop'], [390, 844, 'mobile']]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.route('**/*', r => (r.request().url().startsWith(origin) ? r.continue() : r.abort()));
    await page.goto(origin + '/replica/design/preview.html', { waitUntil: 'load' });
    await page.addScriptTag({ content: AXE });

    const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }));
    console.log(`[${tag}] axe: ${axe.violations.length} violations, ${axe.passes.length} rules passed, ${axe.incomplete.length} need review`);
    axe.violations.forEach(v => fail(`${v.id} (${v.impact}): ${v.help} -> ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`));
    axe.incomplete.forEach(v => console.log('  needs review:', v.id));

    const m = await page.evaluate(() => {
      const texts = [...document.querySelectorAll('.pv *')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
      const sheet = document.querySelector('.nd-sheet'), bar = document.querySelector('.nd-filterbar');
      return {
        scrollW: document.documentElement.scrollWidth, innerW: innerWidth,
        minFont: Math.min(...texts.map(e => parseFloat(getComputedStyle(e).fontSize))),
        clipped: [...document.querySelectorAll('.nd-sheet__list .nd-card')].filter(c => c.scrollHeight > c.clientHeight + 1).length,
        mapRoom: Math.round(sheet.getBoundingClientRect().top - bar.getBoundingClientRect().bottom),
        columns: getComputedStyle(document.querySelector('.nd-split')).gridTemplateColumns,
        handle: getComputedStyle(document.getElementById('handle')).display,
        filtersOpen: document.getElementById('filters').open,
      };
    });
    console.log(`[${tag}]`, JSON.stringify(m));
    if (m.scrollW > m.innerW) fail(`horizontal scroll (${m.scrollW} > ${m.innerW})`);
    if (m.minFont < 12) fail(`text smaller than 12px (${m.minFont})`);
    if (m.clipped) fail(`${m.clipped} result card(s) clipped`);
    if (tag === 'desktop' && (m.handle !== 'none' || !m.filtersOpen || !/^380px /.test(m.columns))) fail('desktop should show a 380px list column, open filters and no sheet handle');
    if (tag === 'mobile') {
      if (m.mapRoom < 160) fail(`map has only ${m.mapRoom}px above the sheet on a phone`);
      if (m.filtersOpen) fail('filters should start collapsed on a phone');
      await page.focus('#handle');
      const read = async () => +(await page.getAttribute('#handle', 'aria-valuenow'));
      const start = await read();
      await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
      const up = await read();
      await page.keyboard.press('Home'); const home = await read();
      await page.keyboard.press('End'); const end = await read();
      console.log(`[mobile] handle: ${start} -> ${up} (ArrowUp x2), Home ${home}, End ${end}`);
      if (!(up > start) || home !== 80 || end !== 560) fail('sheet handle is not operable from the keyboard');
    }
    if (errors.length) fail('page errors: ' + errors.slice(0, 2).join(' | '));

    await (await page.$('.nd-discover')).screenshot({ path: `${OUT}preview-${tag}.png` });
    if (tag === 'desktop') await page.screenshot({ path: `${OUT}preview-desktop-full.png`, fullPage: true });
    await page.close();
  }

  await browser.close();
  server.close();
  console.log(problems ? `FAILED: ${problems} problem(s)` : 'ALL CHECKS PASSED');
  process.exit(problems ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); server.close(); process.exit(2); });
