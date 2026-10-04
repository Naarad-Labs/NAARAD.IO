// F06 Plan a route and take it with me. This is Naarad's existing Plan mode, which the Discover rebuild did not
// touch. Cases are in replica/test-plan.md.
const fs = require('fs');
const { test, expect, root, goDiscover, DESKTOP, PHONE } = require('./fixtures');

async function openPlan(page) {
  await goDiscover(page);
  await page.getByRole('button', { name: 'Plan Route' }).click();
  await expect(page.locator('#pmode-plan')).toHaveClass(/active/);
  await expect(page.locator('#plan-map .leaflet-pane').first()).toBeAttached();
}

/** Add two waypoints a little apart. The map only adds one per press of the Add button. */
async function addTwoWaypoints(page) {
  const map = page.locator('#plan-map');
  const box = await map.boundingBox();
  for (const dx of [-40, 40]) {
    await page.getByRole('button', { name: 'Add waypoint by clicking map' }).click();
    await map.click({ position: { x: box.width / 2 + dx, y: box.height / 2 } });
    await page.waitForTimeout(400);   // two clicks inside 300 ms are a double-click zoom in Leaflet
  }
  await expect(page.locator('#wp-list')).toContainText('Stop 1');
}

async function exportGpx(page) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export route as GPX' }).click()]);
  return { name: download.suggestedFilename(), text: fs.readFileSync(await download.path(), 'utf8') };
}

test.describe('F06 plan mode', () => {
  test.use({ viewport: DESKTOP.size });

  test('F06-H1 two waypoints export as a GPX file with both points and a track', async ({ page }) => {
    await openPlan(page);
    await addTwoWaypoints(page);
    await expect(page.locator('#wp-list')).toContainText('Start');
    const file = await exportGpx(page);
    expect(file.name).toBe('naarad-route.gpx');
    expect(file.text.match(/<wpt /g)).toHaveLength(2);
    expect(file.text.match(/<trkpt /g)).toHaveLength(2);
    expect(file.text).toMatch(/<gpx [^>]*version="1\.1"/);
    for (const m of file.text.matchAll(/lat="([-\d.]+)" lon="([-\d.]+)"/g)) { expect(Math.abs(+m[1])).toBeLessThanOrEqual(90); expect(Math.abs(+m[2])).toBeLessThanOrEqual(180); }
  });

  test('F06-E1 exporting with fewer than two points says so and writes no file', async ({ page }) => {
    await openPlan(page);
    let message = null, downloaded = false;
    page.on('dialog', (d) => { message = d.message(); d.dismiss(); });
    page.on('download', () => { downloaded = true; });
    await page.getByRole('button', { name: 'Export route as GPX' }).click();
    await page.waitForTimeout(400);
    expect(message).toMatch(/at least 2 waypoints/i);
    expect(downloaded).toBe(false);
  });

  test('F06-E2 clearing the route and starting again resets the list', async ({ page }) => {
    await openPlan(page);
    await addTwoWaypoints(page);
    await expect(page.locator('#wp-list .wp-item, #wp-list [class*="wp-"]').filter({ hasText: /Stop|Start/ }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Clear all waypoints' }).click();
    await expect(page.locator('#wp-empty')).toBeVisible();
    await page.getByRole('button', { name: 'Add waypoint by clicking map' }).click();
    const box = await page.locator('#plan-map').boundingBox();
    await page.locator('#plan-map').click({ position: { x: box.width / 2, y: box.height / 2 } });
    await expect(page.locator('#wp-empty')).toBeHidden();
    await expect(page.locator('#wp-list')).toContainText('Start');
    await expect(page.locator('#wp-list')).not.toContainText('Stop 1');
  });

  test('F06-E4 clicking the map, as the empty list says to, adds a waypoint', async ({ page }) => {
    test.fail(true, 'BUG-006: the list says "click the map to begin" but nothing happens until the Add waypoint button is pressed');
    await openPlan(page);
    await expect(page.locator('#wp-empty')).toContainText('click the map to begin');
    const box = await page.locator('#plan-map').boundingBox();
    await page.locator('#plan-map').click({ position: { x: box.width / 2, y: box.height / 2 } });   // no Add button first: the page says to just click
    await expect(page.locator('#wp-list'), 'the page tells people to click the map, so that should add a waypoint').toContainText('Start');
  });

  test('F06-N1 the planner bar search moves the map to the city', async ({ page }) => {
    test.fail(true, 'BUG-007: the planner bar search geocodes, then pans window.discMap, which nothing sets');
    await openPlan(page);
    await page.getByPlaceholder('Search city or heritage site…').fill('Chennai');
    await page.getByPlaceholder('Search city or heritage site…').press('Enter');
    await page.waitForTimeout(800);
    await addTwoWaypoints(page);
    const file = await exportGpx(page);
    const lat = +/lat="([-\d.]+)"/.exec(file.text)[1];
    expect(lat, 'after searching Chennai the map centre should be near 13 N, not the India overview (20.6 N)').toBeLessThan(15);
  });
});

test.describe('F06 plan mode on a phone', () => {
  test.use({ viewport: PHONE.size });

  test('F06-E3 the map and the waypoint panel are both usable at 390px', async ({ page }) => {
    await openPlan(page);
    const layout = await page.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right), h: Math.round(b.height), w: Math.round(b.width) }; };
      const add = document.getElementById('wp-add-btn'), a = add.getBoundingClientRect();
      const hit = document.elementFromPoint(a.x + a.width / 2, a.y + a.height / 2);
      return { map: r('#plan-map'), addReachable: !!hit && (hit === add || add.contains(hit)), vh: innerHeight, vw: innerWidth, scrollW: document.documentElement.scrollWidth };
    });
    expect(layout.map.h, 'the map should have room').toBeGreaterThanOrEqual(150);
    expect(layout.addReachable, 'the Add waypoint button should be reachable').toBe(true);
    expect(layout.scrollW).toBeLessThanOrEqual(layout.vw);
  });
});
