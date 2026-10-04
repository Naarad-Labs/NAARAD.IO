// Cross-cutting checks: every page loads cleanly, and what the Discover rebuild must not change is unchanged.
const { test, expect, ready, DESKTOP } = require('./fixtures');

test.use({ viewport: DESKTOP.size });

test('X-1 every page of the site opens without a console error or a 5xx', async ({ page }) => {
  await page.goto('/'); await page.waitForTimeout(500);
  for (const id of ['routes', 'planner', 'features', 'updates', 'about', 'app', 'creator', 'privacy', 'terms', 'accessibility', 'home']) {
    await page.evaluate((i) => showPage(i), id);
    await expect(page.locator('#page-' + id)).toHaveClass(/active/);
    await page.waitForTimeout(150);
  }
  for (const rid of ['hampi', 'thanjavur', 'iitmadras', 'mysore', 'varanasi', 'jaipur']) {
    await page.evaluate((i) => showRoutePage(i), rid);
    await expect(page.locator('#page-route-' + rid)).toHaveClass(/active/);
    await page.waitForTimeout(150);
  }
});

test('X-2 the home page difficulty pills keep their colours', async ({ page }) => {
  await page.goto('/');
  const pill = page.locator('.swipe-card .diff-easy').first();
  await expect(pill).toBeVisible();
  await expect(pill).toHaveCSS('color', 'rgb(74, 222, 128)');
  await expect(page.locator('.swipe-card .diff-moderate').first()).toHaveCSS('color', 'rgb(251, 146, 60)');
});

test('X-1b a missing route page id does not throw', async ({ page }) => {
  await page.goto('/'); await page.waitForTimeout(300);
  await page.evaluate(() => { try { showRoutePage('nope'); } catch (e) { window.__threw = String(e); } });
  expect(await page.evaluate(() => window.__threw)).toBeUndefined();
});
