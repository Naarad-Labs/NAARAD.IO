const { test, expect } = require('@playwright/test');
const path = require('path');

const LEAFLET = path.join(__dirname, 'node_modules', 'leaflet', 'dist');
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lQAAAABJRU5ErkJggg==', 'base64');

test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.includes('unpkg.com/leaflet@1.9.4/dist/leaflet.js')) return route.fulfill({ path: path.join(LEAFLET, 'leaflet.js'), contentType: 'application/javascript' });
    if (url.includes('unpkg.com/leaflet@1.9.4/dist/leaflet.css')) return route.fulfill({ path: path.join(LEAFLET, 'leaflet.css'), contentType: 'text/css' });
    if (url.includes('tile.openstreetmap.org') || url.includes('server.arcgisonline.com')) return route.fulfill({ body: tinyPng, contentType: 'image/png' });
    if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) return route.abort();
    return route.continue();
  });
});

test('route detail uses published data and keeps missing story data honest', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#route-title')).toHaveText('Hampi Vijayanagara Circuit');
  await expect(page.locator('.route-stats')).toContainText('8.4 km');
  await expect(page.locator('#route-stops')).toContainText('not been published');
  await expect(page.locator('#elevation-profile')).toContainText('measured route samples');
  await expect(page.locator('#map.leaflet-container')).toBeVisible();
  await expect(page.locator('#map .nr-map-start-marker')).toHaveCount(1);
  await expect(page.locator('#map .leaflet-overlay-pane canvas')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('catalogue search opens a mapped route with a real GeoJSON line', async ({ page }) => {
  await page.goto('/');
  await page.locator('#nav-explore').click();
  await expect(page.locator('#catalogue-count')).toHaveText('21 routes');
  await page.locator('#catalogue-query').fill('Airport Hidden Lake');
  await expect(page.locator('.catalogue-card')).toHaveCount(1);
  await page.locator('.catalogue-card').click();
  await expect(page.locator('#route-title')).toHaveText('Airport Hidden Lake Trail');
  await expect(page.locator('#map .leaflet-overlay-pane canvas')).toHaveCount(1);
  await page.locator('#map-satellite').click();
  await expect(page.locator('#map')).toHaveAttribute('data-map-layer', 'street');
  await page.locator('#fit-route').click();
});

test('mobile map and route sheet stay usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#map.leaflet-container')).toBeVisible();
  await expect(page.locator('.mobile-map-sheet')).toBeVisible();
  await page.locator('.sheet-expand').click();
  await expect(page.locator('.mobile-map-sheet')).toHaveClass(/is-expanded/);
  const width = await page.evaluate(() => ({ body: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(width.body).toBeLessThanOrEqual(width.viewport);
});

test('home and Stories navigation render their own editorial pages', async ({ page }) => {
  await page.goto('/');
  await page.locator('#nav-home').click();
  await expect(page.locator('#home-title')).toContainText('Every place');
  await page.locator('#nav-stories').click();
  await expect(page.locator('.editorial-page h1')).toHaveText('Listen closer.');
});

test('mobile navigation, deep links, and browser history stay connected', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?view=about');
  await expect(page.locator('.editorial-page h1')).toHaveText('Explore. Listen. Connect.');
  await page.locator('.menu-toggle').click();
  await expect(page.locator('.primary-nav')).toBeVisible();
  await page.locator('#nav-explore').click();
  await expect(page.locator('#catalogue-count')).toHaveText('21 routes');
  await expect(page.locator('.primary-nav')).toBeHidden();
  await page.goBack();
  await expect(page.locator('.editorial-page h1')).toHaveText('Explore. Listen. Connect.');
});

test('map place search moves the map to a geocoded result', async ({ page }) => {
  await page.route('https://nominatim.openstreetmap.org/search?**', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{ lat: '15.335', lon: '76.462', display_name: 'Hampi, Karnataka' }]),
  }));
  await page.goto('/');
  await expect(page.locator('#map.leaflet-container')).toBeVisible();
  await page.locator('#map-search-input').fill('Hampi');
  await page.locator('#map-search-input').press('Enter');
  await expect(page.locator('#site-notice')).toContainText('Hampi, Karnataka');
});
