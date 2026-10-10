// F01 Find a hike near me. Cases are in replica/test-plan.md.
const { test, expect, root, statusOf, articles, placeField, isPhone, ready, openPanel, openFilters, openSport, openWithin, pickSport, goDiscover, axeViolations, installRoutes, watch, DESKTOP, PHONE } = require('./fixtures');

const chip = (page, name) => root(page).getByRole('button', { name, exact: true });
const sport = (page, name) => root(page).getByRole('radio', { name });
const slider = (page, name) => root(page).getByRole('slider', { name });
const title = (page, name) => root(page).getByRole('button', { name, exact: true });

/* ============================================================ both widths */

for (const vp of [DESKTOP, PHONE]) {
  test.describe(`F01 ${vp.name}`, () => {
    test.use({ viewport: vp.size });

    test(`F01-H1 find, select, open a route page, come back (${vp.name})`, async ({ page }) => {
      await goDiscover(page);
      await expect(statusOf(page)).toHaveText('21 routes');
      await expect(articles(page)).toHaveCount(21);

      const marina = articles(page).filter({ hasText: 'Marina Beach Trail' });
      await title(page, 'Marina Beach Trail').click();
      await expect(title(page, 'Marina Beach Trail')).toHaveAttribute('aria-current', 'true');
      await expect(marina).toHaveClass(/is-selected/);

      const hampi = articles(page).filter({ hasText: 'Hampi Vijayanagara Circuit' });
      await hampi.getByRole('button', { name: /Open the route page/ }).click();
      await expect(page.locator('#page-route-hampi')).toHaveClass(/active/);

      await page.locator('#page-route-hampi').getByRole('button', { name: /Back/ }).click();
      await expect(page.locator('#page-planner'), 'Back from a route page should return to the planner').toHaveClass(/active/);
      await expect(page.locator('#page-route-hampi')).not.toHaveClass(/active/);
      await expect(articles(page)).toHaveCount(21);
    });

    test(`F01-H2 filters narrow the list and the URL follows (${vp.name})`, async ({ page }) => {
      await goDiscover(page);

      await pickSport(page, 'Cycle');
      await expect(statusOf(page)).toHaveText('1 route');
      await pickSport(page, 'Any');
      await expect(statusOf(page)).toHaveText('21 routes');

      await openFilters(page);
      await chip(page, 'Easy').click();
      await expect(statusOf(page)).toHaveText('8 routes');
      await chip(page, 'Hard').click();
      await expect(statusOf(page)).toHaveText('9 routes');
      await chip(page, 'Hard').click();
      await chip(page, 'Easy').click();

      await chip(page, 'Temple trail').click();
      await expect(statusOf(page)).toHaveText('3 routes');
      await chip(page, 'Temple trail').click();

      await slider(page, 'Longest route').fill('10');
      await expect(statusOf(page)).not.toHaveText('21 routes');
      const lengths = await articles(page).evaluateAll((els) => els.map((e) => parseFloat((e.querySelector('[data-stat="distance"]') || {}).textContent)));
      expect(lengths.length).toBeGreaterThan(0);
      for (const km of lengths) expect(km).toBeLessThanOrEqual(10);
      expect(page.url()).toContain('max=10');
    });

    test(`F01-H3 a filtered URL restores the search (${vp.name})`, async ({ page }) => {
      await goDiscover(page, '&mode=discover&sport=hike&diff=hard&max=100');
      await expect(statusOf(page)).toHaveText('1 route');
      await openSport(page);
      await expect(sport(page, 'Hike')).toBeChecked();
      await openFilters(page);
      await expect(chip(page, 'Hard')).toHaveAttribute('aria-pressed', 'true');
      await expect(slider(page, 'Longest route')).toHaveValue('100');
    });

    test(`F01-E7 toggling chips quickly leaves exactly the last state (${vp.name})`, async ({ page }) => {
      await goDiscover(page);
      await openFilters(page);
      await chip(page, 'Easy').click();
      await chip(page, 'Moderate').click();
      await chip(page, 'Easy').click();
      await expect(chip(page, 'Easy')).toHaveAttribute('aria-pressed', 'false');
      await expect(chip(page, 'Moderate')).toHaveAttribute('aria-pressed', 'true');
      await expect(statusOf(page)).toHaveText('3 routes');
    });

    test(`F01-E17 a selected route that is filtered out leaves no highlight (${vp.name})`, async ({ page }) => {
      await goDiscover(page);
      await title(page, 'Marina Beach Trail').click();
      await expect(page.locator('#nd-map path.is-selected').first()).toBeAttached();
      await pickSport(page, 'Cycle');
      await expect(statusOf(page)).toHaveText('1 route');
      await expect(articles(page).filter({ hasText: 'Marina' })).toHaveCount(0);
      await expect(articles(page).locator('.is-selected, [aria-current="true"]')).toHaveCount(0);
      await expect(page.locator('#nd-map path.is-selected')).toHaveCount(0);
    });

    test(`F01-E18 clicking a marker selects its card and brings it into view (${vp.name})`, async ({ page }) => {
      await goDiscover(page);
      await page.locator('#nd-map path.nd-start').nth(15).dispatchEvent('click');
      await expect(root(page).locator('.nd-card.is-selected')).toHaveCount(1);
      await expect.poll(() => root(page).locator('.nd-card.is-selected').evaluate((card) => {   // it scrolls smoothly, so give it a moment
        const c = card.getBoundingClientRect(), l = document.getElementById('nd-list').getBoundingClientRect();
        return c.bottom > l.top && c.top < l.bottom;
      }), { message: 'the selected card should be scrolled into view', timeout: 3000 }).toBe(true);
    });

    test(`F01-N4 the data fails, an alert offers Try again, and it works (${vp.name})`, async ({ page, env }) => {
      env.seed = 'fail'; env.allow.push('seed-tours.json', '500');
      await page.goto('/?page=planner');
      const alert = root(page).getByRole('alert');
      await expect(alert).toContainText('We could not load routes');
      env.seed = 'ok';
      await alert.getByRole('button', { name: 'Try again' }).click();
      await expect(articles(page)).toHaveCount(21);
    });

    test(`F01-N6 nothing matches: the empty state says why and offers a way out (${vp.name})`, async ({ page }) => {
      await goDiscover(page);
      await pickSport(page, 'Run');
      await expect(root(page).getByRole('heading', { name: 'No routes match' })).toBeVisible();
      await expect(statusOf(page)).toHaveText('0 routes');
      await root(page).getByRole('button', { name: 'Clear filters' }).first().click();
      await expect(statusOf(page)).toHaveText('21 routes');
    });

    test(`F01-E14 no accessibility violations in any state (${vp.name})`, async ({ page, env }) => {
      const found = [];
      await goDiscover(page);
      found.push(...(await axeViolations(page, 'filled')));
      await title(page, 'Marina Beach Trail').click();
      found.push(...(await axeViolations(page, 'selected')));
      await openFilters(page);
      found.push(...(await axeViolations(page, 'filters open')));
      await openSport(page);
      found.push(...(await axeViolations(page, 'sport open')));
      await openWithin(page);
      found.push(...(await axeViolations(page, 'within open')));
      await pickSport(page, 'Run');
      await expect(root(page).getByRole('heading', { name: 'No routes match' })).toBeVisible();
      found.push(...(await axeViolations(page, 'empty')));
      await pickSport(page, 'Any');
      await placeField(page).fill('Chennai'); await placeField(page).press('Enter');
      await expect(statusOf(page)).toContainText('of Chennai, Tamil Nadu');
      found.push(...(await axeViolations(page, 'place set')));
      await placeField(page).fill('Zzxqv'); await placeField(page).press('Enter');
      await expect(page.getByText(/could not find that place/)).toBeVisible();
      found.push(...(await axeViolations(page, 'place error')));
      env.seed = 'fail'; env.allow.push('seed-tours.json', '500');
      await page.reload();
      await expect(root(page).getByRole('alert')).toBeVisible();
      found.push(...(await axeViolations(page, 'error')));
      expect(found).toEqual([]);
    });
  });
}

/* ===================================================== single viewport */

test.describe('F01 happy paths', () => {
  test.use({ viewport: DESKTOP.size });

  test('F01-H4 use my location lists the nearest first, with how far away', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ geolocation: { latitude: 13.0827, longitude: 80.2707 }, permissions: ['geolocation'], viewport: DESKTOP.size, serviceWorkers: 'block' });
    const page = await context.newPage();
    const env = { seed: 'ok', problems: [], allow: [], nominatim: { urls: [], queries: [], delayMs: 0, answer: () => [] } };
    watch(page, env, baseURL); await installRoutes(page, env, baseURL);
    await goDiscover(page);
    await root(page).getByRole('button', { name: 'Use my location' }).click();
    await expect(statusOf(page)).toContainText('of My location');
    const away = await articles(page).evaluateAll((els) => els.map((e) => { const m = /([\d.]+) km away/.exec(e.textContent); return m ? parseFloat(m[1]) : null; }));
    expect(away.length).toBeGreaterThan(0);
    expect(away.every((x) => x !== null)).toBe(true);
    expect([...away].sort((a, b) => a - b)).toEqual(away);
    expect(env.problems).toEqual([]);
    await context.close();
  });

  test('F01-E1 an empty place goes back to all of India', async ({ page }) => {
    await goDiscover(page);
    await placeField(page).fill('Chennai'); await placeField(page).press('Enter');
    await expect(statusOf(page)).toContainText('of Chennai');
    await placeField(page).fill(''); await placeField(page).press('Enter');
    await expect(statusOf(page)).toHaveText('21 routes');
    expect(page.url()).not.toContain('lat=');
  });

  test('F01-E5 two tabs keep their own searches', async ({ page, context, baseURL, env }) => {
    await goDiscover(page, '&sport=cycle');
    const second = await context.newPage();
    const env2 = { seed: 'ok', problems: [], allow: [], nominatim: { urls: [], queries: [], delayMs: 0, answer: () => [] } };
    watch(second, env2, baseURL); await installRoutes(second, env2, baseURL);
    await goDiscover(second, '&sport=hike');
    await expect(statusOf(page)).toHaveText('1 route');
    await expect(statusOf(second)).toHaveText('4 routes');
    await expect(statusOf(page)).toHaveText('1 route');
    expect(env2.problems).toEqual([]);
  });

  test('F01-E8 the browser Back button returns to Discover with its filters', async ({ page }) => {
    await goDiscover(page, '&sport=hike');
    await expect(statusOf(page)).toHaveText('4 routes');
    await page.locator('#nb-routes').click();
    await expect(page.locator('#page-routes')).toHaveClass(/active/);
    await page.goBack();
    await expect(page.locator('#page-planner')).toHaveClass(/active/);
    await expect(sport(page, 'Hike')).toBeChecked();
    await expect(statusOf(page)).toHaveText('4 routes');
  });

  test('F01-E9 a refresh keeps the filters', async ({ page }) => {
    await goDiscover(page);
    await chip(page, 'Moderate').click();
    await sport(page, 'Walk').check();
    await expect(statusOf(page)).toHaveText('2 routes');          // Hampi and Udaipur
    await title(page, 'Udaipur Lake Palace Circuit').click();
    await page.reload(); await ready(page);
    await expect(statusOf(page)).toHaveText('2 routes');
    await expect(sport(page, 'Walk')).toBeChecked();
    await expect(chip(page, 'Moderate')).toHaveAttribute('aria-pressed', 'true');
  });

  test('F01-E10 a slow search that is overtaken by a newer one does not win', async ({ page }) => {
    await goDiscover(page);
    await page.evaluate(() => {   // the Cycle search answers after 800 ms, every other one after 20 ms
      const D = window.NaaradDiscoverData, real = D.searchTours;
      D.searchTours = (a) => real(a).then((rows) => new Promise((done) => setTimeout(() => done(rows), a && a.p_sport ? 800 : 20)));
    });
    await sport(page, 'Cycle').check();
    await sport(page, 'Any').check();
    await expect(statusOf(page)).toHaveText('21 routes');
    await page.waitForTimeout(1200);
    await expect(statusOf(page), 'the slow Cycle answer must not overwrite the newer one').toHaveText('21 routes');
    await expect(articles(page)).toHaveCount(21);
  });

  test('F01-E21 a slow geocoder shows that something is happening', async ({ page, env }) => {
    env.nominatim.delayMs = 1500;
    await goDiscover(page);
    await placeField(page).fill('Chennai'); await placeField(page).press('Enter');
    await expect(root(page).getByText(/Searching/), 'there should be a visible sign that the search is running').toBeVisible({ timeout: 1000 });
    await expect(statusOf(page)).toContainText('of Chennai', { timeout: 5000 });
    await expect(root(page).getByText(/Searching/)).toBeHidden();
  });

  test('F01-E22 a landscape phone (844x390) stays usable', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await goDiscover(page);
    const m = await page.evaluate(() => {
      const split = document.querySelector('.nd-split').getBoundingClientRect(), sheet = document.getElementById('nd-sheet').getBoundingClientRect();
      return { splitH: Math.round(split.height), sheetOver: Math.round(sheet.height - split.height), overflowX: document.documentElement.scrollWidth > innerWidth };
    });
    expect(m.overflowX, 'horizontal scroll').toBe(false);
    expect(m.sheetOver, 'the sheet should not be taller than the space it has').toBeLessThanOrEqual(1);
    expect(m.splitH, 'the map and results need some room').toBeGreaterThanOrEqual(120);
    await title(page, 'Marina Beach Trail').scrollIntoViewIfNeeded();
    await expect(title(page, 'Marina Beach Trail')).toBeInViewport();
  });

  test('F01-E15 a tampered URL falls back to sensible defaults', async ({ page }) => {
    const cases = [
      ['?page=planner&lat=abc&lng=80', async () => { await expect(statusOf(page)).toHaveText('21 routes'); }],
      ['?page=planner&lat=95&lng=80', async () => { await expect(statusOf(page)).toHaveText('21 routes'); }],
      ['?page=planner&lat=13&lng=80&r=99999', async () => { await expect(statusOf(page)).toContainText('within 200 km'); }],
      ['?page=planner&lat=13&lng=80&r=-5', async () => { await expect(statusOf(page)).toContainText('within 5 km'); }],
      ['?page=planner&lat=13&lng=80&r=abc', async () => { await expect(statusOf(page)).toContainText('within 30 km'); }],
      ['?page=planner&max=abc', async () => { await expect(statusOf(page)).toHaveText('21 routes'); }],
      ['?page=planner&max=0', async () => { await expect(slider(page, 'Longest route')).toHaveValue('5'); }],
      ['?page=planner&sport=skydive', async () => { await expect(statusOf(page)).toHaveText('21 routes'); }],
      ['?page=planner&theme=heritage-walk,bogus', async () => { await expect(chip(page, 'Heritage walk')).toHaveAttribute('aria-pressed', 'true'); await expect(chip(page, 'Temple trail')).toHaveAttribute('aria-pressed', 'false'); }],
      ['?page=planner&q=NoCoordinates', async () => { await expect(placeField(page)).toHaveValue(''); }],
    ];
    for (const [query, check] of cases) {
      await page.goto('/' + query); await ready(page);
      await check();
    }
  });

  test('F01-E16 crossing the 900px breakpoint switches the layout both ways', async ({ page }) => {
    await goDiscover(page);
    await expect(root(page).getByRole('separator', { name: 'Resize results panel' })).toBeHidden();
    await expect(page.locator('#nd-filters')).toHaveJSProperty('open', true);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(root(page).getByRole('separator', { name: 'Resize results panel' })).toBeVisible();
    await expect(page.locator('#nd-filters')).toHaveJSProperty('open', false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(articles(page)).toHaveCount(21);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(root(page).getByRole('separator', { name: 'Resize results panel' })).toBeHidden();
    await expect(page.locator('#nd-filters')).toHaveJSProperty('open', true);
    await expect(articles(page)).toHaveCount(21);
  });

  test('F01-E11 offline: the routes still list from the precached seed', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ viewport: DESKTOP.size, serviceWorkers: 'allow' });
    const page = await context.newPage();
    const env = { seed: 'ok', problems: [], allow: [], nominatim: { urls: [], queries: [], delayMs: 0, answer: () => [] } };
    watch(page, env, baseURL); await installRoutes(page, env, baseURL);
    await page.goto('/?page=planner'); await ready(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(async () => !!(await caches.match('/discover/seed-tours.json'))), { timeout: 10000, message: 'the service worker should have cached the seed' }).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(statusOf(page)).toHaveText('21 routes', { timeout: 10000 });
    await expect(articles(page)).toHaveCount(21);
    await context.close();
  });
});

/* =============================================================== input */

test.describe('F01 text input', () => {
  test.use({ viewport: DESKTOP.size });

  test('F01-E2 a 5,000 character place is capped before it reaches the geocoder', async ({ page, env }) => {
    await goDiscover(page);
    await placeField(page).fill('x'.repeat(5000));
    await placeField(page).press('Enter');
    await page.waitForTimeout(400);
    expect((await placeField(page).inputValue()).length, 'the field should limit its length').toBeLessThanOrEqual(200);
    for (const url of env.nominatim.urls) expect(url.length, 'the geocoder request should stay short').toBeLessThan(1000);
  });

  test('F01-E3 accents and emoji survive the search and a reload', async ({ page, env }) => {
    env.nominatim.answer = () => [{ lat: '11.9416', lon: '79.8083', display_name: 'Pondichéry, Puducherry district, Puducherry, India' }];
    await goDiscover(page);
    await placeField(page).fill('Pondichéry 🏔️'); await placeField(page).press('Enter');
    await expect(statusOf(page)).toContainText('of Pondichéry, Puducherry');
    expect(env.nominatim.queries[0]).toBe('Pondichéry 🏔️');
    expect(new URL(page.url()).searchParams.get('q')).toBe('Pondichéry, Puducherry');
    await page.reload(); await ready(page);
    await expect(placeField(page)).toHaveValue('Pondichéry, Puducherry');
    await expect(statusOf(page)).toContainText('of Pondichéry, Puducherry');
  });

  test('F01-E4 markup in the place field or the URL is shown as text and never runs', async ({ page }) => {
    const bad = '<img src=x onerror="window.__xss=1">';
    await goDiscover(page);
    await placeField(page).fill(bad); await placeField(page).press('Enter');
    await page.waitForTimeout(300);
    await page.goto('/?page=planner&lat=13&lng=80&q=' + encodeURIComponent(bad)); await ready(page);
    await expect(placeField(page)).toHaveValue(bad);
    await expect(root(page).locator('img[src="x"]')).toHaveCount(0);   // (Leaflet's own tile <img>s are fine)
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });

  test('F01-E6 pressing Enter twice asks the geocoder once (its policy is 1 request a second)', async ({ page, env }) => {
    env.nominatim.delayMs = 700;
    await goDiscover(page);
    await placeField(page).fill('Chennai');
    await placeField(page).press('Enter');
    await placeField(page).press('Enter');
    await expect(statusOf(page)).toContainText('of Chennai', { timeout: 5000 });
    expect(env.nominatim.urls.length).toBe(1);
  });

  test('F01-N2 the geocoder is down: a message, and the routes stay', async ({ page, env }) => {
    env.nominatim.answer = () => 'down'; env.allow.push('500');
    await goDiscover(page);
    await placeField(page).fill('Chennai'); await placeField(page).press('Enter');
    await expect(page.getByText(/Place search is not available/)).toBeVisible();
    await expect(statusOf(page)).toHaveText('21 routes');
  });

  test('F01-N3 a place that does not exist: a message, and the old results stay', async ({ page }) => {
    await goDiscover(page);
    await placeField(page).fill('Chennai'); await placeField(page).press('Enter');
    await expect(statusOf(page)).toContainText('of Chennai');
    await placeField(page).fill('Zzxqv'); await placeField(page).press('Enter');
    await expect(page.getByText(/could not find that place/)).toBeVisible();
    await expect(placeField(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(statusOf(page)).toContainText('of Chennai');
  });

  test('F01-N5 without the map library the list still works and says so', async ({ page, env }) => {
    env.noLeaflet = true;
    await goDiscover(page);
    await expect(articles(page)).toHaveCount(21);
    await expect(root(page).getByText(/map could not load/i)).toBeVisible();
  });

  test('F01-N1 location denied: says what to do', async ({ page }) => {
    await goDiscover(page);
    await root(page).getByRole('button', { name: 'Use my location' }).click();
    await expect(page.getByText(/Location is blocked/)).toBeVisible();
  });
});

/* ====================================================== phone specifics */

test.describe('F01 phone', () => {
  test.use({ viewport: PHONE.size });

  // Every control, in every panel, must be on screen and not under the sheet or the chips.
  const reach = (page, selector) => page.evaluate((sel) => {
    const sheet = document.getElementById('nd-sheet'), blocked = [];
    document.querySelectorAll(sel).forEach((t) => {
      t.scrollIntoView({ block: 'center' });
      const r = t.getBoundingClientRect(), top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      if (!top || !(t === top || t.contains(top) || top.contains(t)) || sheet.contains(top) || r.right > innerWidth + 1 || r.left < -1) blocked.push((t.id || t.textContent).trim().slice(0, 24));
    });
    return blocked;
  }, selector);

  for (const width of [390, 320]) {
    test(`F01-E12 ${width}px: no horizontal scroll and every control reachable`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      await goDiscover(page);
      const blocked = [...(await reach(page, '#nd-place, #nd-locate, .nd-pillbtn'))];
      for (const [panel, targets] of [['nd-sport-pop', '#nd-sport label'], ['nd-within-pop', '#nd-radius'], ['nd-filters', '#nd-themes .nd-chip, #nd-longest, #nd-diffs .nd-chip']]) {
        await openPanel(page, panel);
        blocked.push(...(await reach(page, targets)));
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), 'horizontal scroll').toBe(false);
      expect(blocked, 'controls covered or off screen').toEqual([]);
    });
  }

  test('F01-E23 a place search does not widen the page', async ({ page }) => {
    // Found while rebuilding the phone layout: with an auto-sized grid column the chips, once one said "Within 30 km",
    // were wider than the screen, and the pill, the chips and every card went with them.
    await goDiscover(page);
    await placeField(page).fill('Chennai'); await placeField(page).press('Enter');
    await expect(statusOf(page)).toContainText('of Chennai');
    const m = await page.evaluate(() => {
      const bar = document.getElementById('nd-filterbar').getBoundingClientRect(), card = document.querySelector('#nd-list .nd-card').getBoundingClientRect();
      return { barRight: Math.round(bar.right), cardRight: Math.round(card.right), W: innerWidth, sw: document.documentElement.scrollWidth };
    });
    expect(m.barRight, 'the control bar should fit the screen').toBeLessThanOrEqual(m.W);
    expect(m.cardRight, 'cards should fit the screen').toBeLessThanOrEqual(m.W);
    expect(m.sw).toBeLessThanOrEqual(m.W);
  });

  test('F01-E19 dragging the sheet handle moves it, within its limits', async ({ page }) => {
    await goDiscover(page);
    const handle = root(page).getByRole('separator', { name: 'Resize results panel' });
    const sheet = page.locator('#nd-sheet');
    const box = await handle.boundingBox();
    const before = (await sheet.boundingBox()).height;
    await page.mouse.move(box.x + box.width / 2, box.y + 6); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y - 150, { steps: 6 }); await page.mouse.up();
    await page.waitForTimeout(350);
    const grown = (await sheet.boundingBox()).height;
    expect(grown, 'dragging up should grow the sheet').toBeGreaterThan(before + 60);
    const box2 = await handle.boundingBox();
    await page.mouse.move(box2.x + box2.width / 2, box2.y + 6); await page.mouse.down();
    await page.mouse.move(box2.x + box2.width / 2, box2.y + 900, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(350);
    expect((await sheet.boundingBox()).height, 'dragging far down should stop at the peek height').toBeGreaterThanOrEqual(79);
    expect(+(await handle.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(80);
  });
});

/* ================================================================ keyboard */

for (const vp of [DESKTOP, PHONE]) {
  test.describe(`F01 keyboard ${vp.name}`, () => {
    test.use({ viewport: vp.size });

    test(`F01-E13 the whole flow works from the keyboard, in order, with a visible focus (${vp.name})`, async ({ page }) => {
      await goDiscover(page);
      await placeField(page).focus();
      await page.keyboard.type('Chennai'); await page.keyboard.press('Enter');
      await expect(statusOf(page)).toContainText('of Chennai');

      // walk the Tab order from the place field through Discover and record what receives focus
      const walk = async () => {
        await placeField(page).focus();
        const visited = [];
        for (let i = 0; i < 90; i++) {
          await page.keyboard.press('Tab');
          const info = await page.evaluate(() => {
            const e = document.activeElement, inside = !!e.closest('#nd-root');
            if (!inside) return { inside: false };
            const cs = getComputedStyle(e), after = getComputedStyle(e, '::after'), pill = e.closest('.nd-search__pill');
            const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none' || (after.outlineStyle !== 'none' && parseFloat(after.outlineWidth) > 0)
              || (!!pill && getComputedStyle(pill).outlineStyle !== 'none');   // the pill shows the ring for the field inside it
            const name = e.getAttribute('aria-label') || (e.labels && e.labels[0] && e.labels[0].textContent) || e.textContent || e.id || e.className;
            return { inside: true, tag: e.tagName, type: e.type || '', name: String(name).trim().slice(0, 32), ring };
          });
          if (!info.inside) break;
          visited.push(info);
        }
        return visited;
      };
      const check = (visited, label) => {
        const names = visited.map((v) => `${v.tag}:${v.name}`);
        expect(names.length, label + ': focus should leave Discover (no keyboard trap)').toBeLessThan(90);
        expect(new Set(names).size, label + ': no control should be visited twice').toBe(names.length);
        expect(visited.some((v) => v.name.includes('Use my location')), label + ': Use my location in the order').toBe(true);
        expect(visited.some((v) => /East Coast Beach Route/.test(v.name)), label + ': a result card title is reachable').toBe(true);
        expect(visited.filter((v) => !v.ring).map((v) => v.name), label + ': every focused control should show a focus indicator').toEqual([]);
      };

      if (!isPhone(page)) {
        const visited = await walk();
        check(visited, 'desktop');
        expect(visited.filter((v) => v.type === 'radio').length, 'the sport radios are one tab stop').toBe(1);
        expect(visited.filter((v) => v.type === 'range').length, 'both sliders').toBe(2);
        for (const name of ['Heritage walk', 'Easy', 'Moderate', 'Hard']) expect(visited.some((v) => v.name.toLowerCase() === name.toLowerCase()), name + ' reachable').toBe(true);
      } else {
        // Each chip opens from the keyboard (Enter on the focused chip), and its controls follow it in the Tab order.
        const seen = [];
        for (const [id, label] of [['nd-sport-pop', 'sport'], ['nd-within-pop', 'within'], ['nd-filters', 'filters']]) {
          await page.locator('#' + id + ' summary').focus();
          await page.keyboard.press('Enter');
          await expect(page.locator('#' + id)).toHaveJSProperty('open', true);
          const visited = await walk();
          check(visited, label);
          seen.push({ id, visited });
        }
        expect(seen[0].visited.filter((v) => v.type === 'radio').length, 'the sport radios are one tab stop').toBe(1);
        expect(seen[1].visited.filter((v) => v.type === 'range').length, 'the Within slider').toBe(1);
        expect(seen[2].visited.filter((v) => v.type === 'range').length, 'the Longest route slider').toBe(1);
        for (const name of ['Heritage walk', 'Easy', 'Moderate', 'Hard']) expect(seen[2].visited.some((v) => v.name.toLowerCase() === name.toLowerCase()), name + ' reachable').toBe(true);
      }
    });

    test(`F01-E20 focus stays inside Discover after an action (${vp.name})`, async ({ page, env }) => {
      await goDiscover(page);
      await pickSport(page, 'Run');
      await expect(root(page).getByRole('heading', { name: 'No routes match' })).toBeVisible();
      const clear = root(page).getByRole('button', { name: 'Clear filters' }).first();
      await clear.focus(); await page.keyboard.press('Enter');
      await expect(statusOf(page)).toHaveText('21 routes');
      const active = await page.evaluate(() => (document.activeElement.closest('#nd-root') ? document.activeElement.tagName + ':' + (document.activeElement.textContent || '').trim().slice(0, 20) : 'OUTSIDE:' + document.activeElement.tagName));
      expect(active, 'after Clear filters focus should stay in Discover, not drop to the page').not.toMatch(/^OUTSIDE/);

      env.seed = 'fail'; env.allow.push('seed-tours.json', '500');
      await page.reload();
      const retry = root(page).getByRole('button', { name: 'Try again' });
      await expect(retry).toBeVisible();
      env.seed = 'ok';
      await retry.focus(); await page.keyboard.press('Enter');
      await expect(articles(page)).toHaveCount(21);
      const after = await page.evaluate(() => (document.activeElement.closest('#nd-root') ? 'INSIDE' : 'OUTSIDE:' + document.activeElement.tagName));
      expect(after, 'after Try again focus should stay in Discover, not drop to the page').toBe('INSIDE');
    });
  });
}
