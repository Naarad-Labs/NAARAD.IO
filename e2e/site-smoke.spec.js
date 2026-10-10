// Cross-cutting checks: every page loads cleanly, and what the Discover rebuild must not change is unchanged.
const { test, expect, ready, DESKTOP } = require('./fixtures');

test.use({ viewport: DESKTOP.size });

test('X-1 every page of the site opens without a console error or a 5xx', async ({ page }) => {
  await page.goto('/'); await page.waitForTimeout(500);
  for (const id of ['planner', 'features', 'updates', 'app', 'creator', 'privacy', 'terms', 'accessibility', 'home']) {
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

test('X-3 the landing headline says "Know a new world. Know it with Naarad." once and the old subline is gone', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#page-home h1.hero-title')).toHaveText(/^Know a new world\.\s*Know it with Naarad\.$/);
  await expect(page.locator('#page-home .hero-sub')).toHaveCount(0);
  // "once" means once on the whole page, whatever the letter case, and not in the page title or description either
  const hits = await page.evaluate(() => {
    const clone = document.body.cloneNode(true);   // every page counts, shown or hidden; code and styles do not
    clone.querySelectorAll('script, style, noscript').forEach((n) => n.remove());
    const text = clone.textContent.match(/know\s+it\s+with\s+naarad/gi) || [];
    const meta = [document.title, ...[...document.querySelectorAll('meta[content]')].map((m) => m.content)].filter((t) => /know\s+(a\s+new\s+world|it\s+with\s+naarad)/i.test(t));
    return { text: text.length, meta: meta.length };
  });
  expect(hits).toEqual({ text: 1, meta: 0 });
});

test('X-3b the landing headline stays on two lines from a small phone to a wide desktop', async ({ page }) => {
  for (const width of [320, 390, 768, 899, 901, 1024, 1440, 2200]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/'); await page.waitForTimeout(200);
    const { lines, over } = await page.evaluate(() => {
      const h = document.querySelector('#page-home .hero-title'); const cs = getComputedStyle(h);
      return { lines: Math.round(h.getBoundingClientRect().height / (parseFloat(cs.fontSize) * 0.97)), over: h.scrollWidth - h.clientWidth };
    });
    expect({ width, lines, over }).toEqual({ width, lines: 2, over: 0 });
  }
});

test('X-4 the About page is gone: no nav button, no sidebar button, no page, and old links land on home', async ({ page, env }) => {
  env.allow.push('404');   // /about is an unknown path now: the host answers 404 with 404.html, which sends the visitor home
  await page.goto('/');
  await expect(page.locator('#nb-about, #sb-about, #page-about')).toHaveCount(0);
  await expect(page.locator('nav, #sidebar, footer').getByText(/^About( Naarad)?$/)).toHaveCount(0);
  for (const url of ['/?page=about', '/about']) {
    await page.goto(url); await page.waitForTimeout(300);
    await expect(page.locator('#page-home')).toHaveClass(/active/);
    expect(await page.locator('.page.active').count()).toBe(1);
  }
});

test('X-5 the planner page opens the Discover module, not the old planner form', async ({ page }) => {
  await page.goto('/?page=planner');
  await expect(page.locator('#page-planner')).toHaveClass(/active/);
  await expect(page.locator('#nd-root')).toBeVisible();
  await expect(page.locator('#nd-root .nd-card').first()).toBeVisible();
});

test('X-6 the Routes page is gone, its links lead to the planner, and route pages still open', async ({ page, env }) => {
  env.allow.push('404');   // /routes is an unknown path now: 404.html answers and sends the visitor home
  await page.goto('/');
  await expect(page.locator('#nb-routes, #sb-routes, #page-routes')).toHaveCount(0);
  await expect(page.locator('nav').getByText(/^Routes$/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Browse all routes →' }).click();
  await expect(page.locator('#page-planner')).toHaveClass(/active/);
  await expect(page.locator('#nd-root')).toBeVisible();
  for (const url of ['/?page=routes', '/routes']) {
    await page.goto(url); await page.waitForTimeout(300);
    await expect(page.locator('#page-home')).toHaveClass(/active/);
    expect(await page.locator('.page.active').count()).toBe(1);
  }
  await page.goto('/?page=route-hampi');
  await expect(page.locator('#page-route-hampi')).toHaveClass(/active/);
});
