// End-to-end checks for the Naarad atlas: the desktop compositions, the phone
// compositions, the data the pages claim, the things that are honestly
// absent, and what search engines and link previews read: clean addresses,
// canonicals, structured data and the pre-rendered pages.
// Run with: cd e2e && npm install && npm test (after node scripts/build-site.mjs)
const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

/** Map tiles are stubbed so the suite does not depend on a tile server. */
test.beforeEach(async ({ page }) => {
  const tile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lQAAAABJRU5ErkJggg==', 'base64');
  await page.route(/tile\.openstreetmap\.org|server\.arcgisonline\.com/, (route) => route.fulfill({ body: tile, contentType: 'image/png' }));
});

async function noPageErrors(page, run) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await run();
  expect(errors, `console/page errors: ${errors.join(' | ')}`).toEqual([]);
}

// The journey lives in IndexedDB ('naarad' / 'kv'), written in the background: poll until the record is there.
const journey = (page) => page.evaluate(async () => {
  const read = () => new Promise((resolve) => {
    const open = indexedDB.open('naarad', 1);
    open.onsuccess = () => {
      const get = open.result.transaction('kv').objectStore('kv').get('naarad.journey.v1');
      get.onsuccess = () => { open.result.close(); resolve(get.result); };
    };
    open.onerror = () => resolve(undefined);
  });
  for (let i = 0; i < 20; i++) {
    const raw = await read();
    if (raw) return JSON.parse(raw);
    await new Promise((r) => setTimeout(r, 100));
  }
  return {};
});

test.describe('gsap motion', () => {
  const vendorRequests = (page) => {
    const seen = [];
    page.on('request', (request) => { if (/\/app\/vendor\/gsap\//.test(request.url())) seen.push(request.url()); });
    return seen;
  };

  test('reduced motion loads no GSAP', async ({ page }) => {
    const seen = vendorRequests(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('.route-card').first()).toBeVisible();
    await page.waitForTimeout(2200);   // past the idle-callback timeout: a load would have started
    expect(seen).toEqual([]);
  });

  test('Save-Data loads no GSAP', async ({ page }) => {
    const seen = vendorRequests(page);
    await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true }));
    await page.goto('/');
    await expect(page.locator('.route-card').first()).toBeVisible();
    await page.waitForTimeout(2200);
    expect(seen).toEqual([]);
  });

  test('with neither, GSAP loads once, settled content stays put, and a card scrolled in counts up to 5.2 km and 8 stops', async ({ page }) => {
    // Record every text the metrics ever show, so the count-up is observed rather than assumed.
    await page.addInitScript(() => {
      window.__metricTexts = new Set();
      new MutationObserver(() => document.querySelectorAll('.route-card-metrics').forEach((m) => window.__metricTexts.add(m.textContent.replace(/\s+/g, ' ').trim())))
        .observe(document, { subtree: true, childList: true, characterData: true });
    });
    const seen = vendorRequests(page);
    await page.goto('/');
    await expect.poll(() => seen.filter((url) => url.endsWith('gsap.min.js')).length, { timeout: 5000 }).toBe(1);
    // Already on screen at boot: not hidden and replayed.
    await expect(page.locator('.home-hero-copy')).toBeVisible();
    await expect(page.locator('.home-hero-copy')).not.toHaveAttribute('data-reveal', 'out');
    const hampi = page.locator('.route-card', { hasText: 'Hampi Heritage Trail' });
    await hampi.scrollIntoViewIfNeeded();
    await expect(hampi.locator('.route-card-metrics')).toContainText('5.2 km');
    await expect(hampi.locator('.route-card-metrics')).toContainText('8 stops');
    await expect(hampi).toHaveAttribute('data-reveal', 'in');
    // The count-up really ran: the metrics were shown starting from zero.
    expect(await page.evaluate(() => [...window.__metricTexts].some((t) => t.includes('0.0 km')))).toBe(true);
  });
});

test.describe('homepage', () => {
  test('renders the editorial hero and featured routes with real facts', async ({ page }) => {
    await noPageErrors(page, async () => {
      await page.goto('/');
      await expect(page.locator('#home-title')).toContainText('Walk a place.');
      await expect(page.locator('.route-card')).toHaveCount(4);

      const hampi = page.locator('.route-card', { hasText: 'Hampi Heritage Trail' });
      await expect(hampi.locator('.route-card-metrics')).toContainText('5.2 km');
      await expect(hampi.locator('.route-card-metrics')).toContainText('8 stops');
      // The card preview is drawn from the route's own geometry.
      await expect(hampi.locator('.route-preview .rp-pin')).toHaveCount(8);
    });
  });

  test('the hero and footer draw a dithered canvas, and reduced motion keeps it', async ({ page }) => {
    await noPageErrors(page, async () => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/');
      for (const band of ['.home-hero', '.site-footer']) {
        await expect(page.locator(band)).toHaveAttribute('data-dither-on', '1');   // mounted when the browser is idle
        const canvas = page.locator(`${band} .dither-canvas`);
        // No WebGL (headless without a GPU) is allowed: then the band is marked and shows its gradient.
        const drawn = await canvas.count();
        if (drawn) await expect(canvas).toHaveAttribute('aria-hidden', 'true');
        else await expect(page.locator(band)).toHaveAttribute('data-dither-fallback', '1');
      }
    });
  });

  test('the hero image is eager with responsive sources, the rest are lazy', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('.home-hero-photo img');
    await expect(hero).toHaveAttribute('fetchpriority', 'high');
    expect(await hero.getAttribute('loading')).not.toBe('lazy');
    await expect(page.locator('.home-hero-photo source[type="image/avif"]')).toHaveCount(1);
    // Wait for the cards to render before counting what they deferred.
    await expect(page.locator('.route-card').first()).toBeVisible();
    await expect(page.locator('.route-card img[loading="lazy"]').first()).toBeAttached();
  });

  test('no map engine is loaded on the homepage', async ({ page }) => {
    const requests = [];
    page.on('request', (request) => requests.push(request.url()));
    await page.goto('/', { waitUntil: 'networkidle' });
    expect(requests.filter((url) => /leaflet/i.test(url))).toEqual([]);
    expect(await page.evaluate(() => Boolean(window.L))).toBe(false);
  });

  test('every photograph carries its licence', async ({ page }) => {
    await page.goto('/');
    const credit = page.locator('.home-hero-media .photo-credit');
    await expect(credit).toContainText(/CC BY|CC0|Public Domain/);
  });
});

test.describe('route detail', () => {
  test('shows published facts, numbered stops and a real elevation profile', async ({ page }) => {
    await noPageErrors(page, async () => {
      await page.goto('/routes/hampi-heritage-trail/');
      await expect(page.locator('#route-title')).toHaveText('Hampi Heritage Trail');
      await expect(page.locator('.route-facts')).toContainText('5.2 km');
      await expect(page.locator('.stop-item')).toHaveCount(8);
      await expect(page.locator('.stop-title')).toHaveText('Virupaksha Temple');

      // The profile is drawn from sampled heights, with a marker per stop.
      await expect(page.locator('.glance-elevation .elevation-svg')).toBeVisible();
      await expect(page.locator('.glance-elevation .ep-pin')).toHaveCount(8);
      await expect(page.locator('.route-glance')).toContainText('SRTM');
    });
  });

  test('mounts one interactive map with the route line and numbered markers', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    await expect(page.locator('#map.leaflet-container')).toBeVisible();
    await expect(page.locator('#map .nr-map-stop-marker')).toHaveCount(8);
    expect(await page.locator('.leaflet-container').count()).toBe(1);
  });

  test('selecting a stop updates the story, the rail and the address', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    await page.locator('.stop-item', { hasText: 'Hampi Bazaar' }).click();
    await expect(page.locator('.stop-title')).toHaveText('Hampi Bazaar');
    await expect(page.locator('.stop-panel-head')).toContainText('Stop 3 of 8');
    await expect(page).toHaveURL(/stop=3/);
    await expect(page.locator('.stop-item.is-active')).toContainText('Hampi Bazaar');
  });

  test('a route without stops says so instead of inventing them', async ({ page }) => {
    await page.goto('/routes/');
    await expect(page.locator('.route-card').first()).toBeVisible();
    const plain = page.locator('.route-card', { hasText: 'Terrain not surveyed' }).first();
    await plain.click();
    await expect(page.locator('.stop-panel')).toContainText('Stops are not published');
  });

  test('saving a route puts it in My Journey', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    await page.locator('[data-action="save"]').click();
    await expect(page.locator('[data-action="save"]')).toHaveAttribute('aria-pressed', 'true');
    await page.goto('/journey/');
    await expect(page.locator('.journey-card').first()).toContainText('Hampi Heritage Trail');
  });
});

test.describe('story', () => {
  test('reads as a magazine spread with its route and credits', async ({ page }) => {
    await noPageErrors(page, async () => {
      await page.goto('/stories/stone-chariot-of-hampi/');
      await expect(page.locator('.story-hero h1')).toContainText('The Stone Chariot');
      await expect(page.locator('.story-section')).toHaveCount(6);
      await expect(page.locator('.story-toc a')).toHaveCount(6);
      await expect(page.locator('.story-route-card')).toContainText('Hampi Heritage Trail');
      await expect(page.locator('.story-figure figcaption').first()).toContainText(/CC BY|CC0|Public Domain/);
    });
  });

  test('the route card links back to the walk', async ({ page }) => {
    await page.goto('/stories/stone-chariot-of-hampi/');
    await page.locator('.story-route-cta').click();
    await expect(page.locator('#route-title')).toHaveText('Hampi Heritage Trail');
  });
});

test.describe('explore', () => {
  test('filters the catalogue without reloading', async ({ page }) => {
    await page.goto('/routes/');
    await expect(page.locator('.route-card').first()).toBeVisible();
    const total = await page.locator('.route-card').count();
    expect(total).toBeGreaterThan(3);
    await page.locator('#catalogue-query').fill('hampi');
    await expect(page.locator('.route-card')).toHaveCount(1);
    await page.locator('#catalogue-query').fill('');
    await page.locator('[data-filter-stories]').check();
    const withStories = await page.locator('.route-card').count();
    expect(withStories).toBeLessThan(total);
    expect(withStories).toBeGreaterThan(0);
  });
});

test.describe('creator studio', () => {
  test('walks the steps and keeps a draft, and is honest about publishing', async ({ page }) => {
    await noPageErrors(page, async () => {
      await page.goto('/creators/');
      await expect(page.locator('.studio-steps li')).toHaveCount(5);
      await expect(page.locator('[data-step="upload"]')).toBeVisible();
      await expect(page.locator('[data-step="transcript"]')).toBeHidden();

      await page.locator('[data-studio="next"]').click();
      await expect(page.locator('[data-step="transcript"]')).toBeVisible();
      await page.locator('[data-studio="transcript"]').fill('A test transcript for this stop.');
      await page.locator('[data-studio="save"]').click();
      await expect(page.locator('.studio-table')).toContainText('Draft');

      await page.locator('[data-studio-step="review"]').click();
      await expect(page.locator('[data-step="review"]')).toContainText('Publishing is not available');
    });
  });
});

test.describe('my journey', () => {
  test('starts empty and records a journal entry', async ({ page }) => {
    await page.goto('/journey/');
    await expect(page.locator('.journey-overview')).toContainText('No routes walked yet');
    await page.locator('[data-journey-tab="journal"]').click();
    await page.locator('[data-journal-form] input[name="title"]').fill('Evening at Matanga Hill');
    await page.locator('[data-journal-form] textarea[name="body"]').fill('The granite went the colour of the lamps.');
    await page.locator('[data-journal-form] button[type="submit"]').click();
    await expect(page.locator('.journal-note')).toContainText('Evening at Matanga Hill');
  });
});

test.describe('phone compositions', () => {
  test.use({ viewport: PHONE, isMobile: true, hasTouch: true });

  test('the route page leads with the map and keeps its action bar in reach', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    const map = page.locator('.map-frame');
    const hero = page.locator('.route-hero-copy');
    const mapBox = await map.boundingBox();
    const heroBox = await hero.boundingBox();
    expect(mapBox.y).toBeLessThan(heroBox.y);                 // map first, not a shrunken spread
    await expect(page.locator('.route-hero-media')).toBeHidden();

    const actions = page.locator('.route-bar-actions');
    await expect(actions).toBeVisible();
    expect(await actions.evaluate((node) => getComputedStyle(node).position)).toBe('fixed');
  });

  test('no horizontal overflow on any main page', async ({ page }) => {
    for (const path of ['/', '/routes/hampi-heritage-trail/', '/stories/stone-chariot-of-hampi/', '/routes/', '/creators/', '/journey/']) {
      await page.goto(path);
      const widths = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, view: window.innerWidth }));
      expect(widths.doc, `overflow at ${path}`).toBeLessThanOrEqual(widths.view);
    }
  });

  test('touch targets on the action bar are large enough', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    for (const button of await page.locator('.route-bar-actions .button').all()) {
      const box = await button.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('navigation and accessibility', () => {
  test.use({ viewport: DESKTOP });

  test('deep links and history work across views', async ({ page }) => {
    await page.goto('/about/');
    await expect(page.locator('.info-hero h1')).toContainText('Explore');
    await page.locator('#nav-stories').click();
    await expect(page).toHaveURL(/\/stories\/$/);
    await page.goBack();
    await expect(page.locator('.info-hero h1')).toContainText('Explore');
  });

  test('every page has one h1 and a skip link', async ({ page }) => {
    for (const path of ['/', '/routes/hampi-heritage-trail/', '/stories/stone-chariot-of-hampi/', '/routes/', '/journey/']) {
      await page.goto(path);
      await expect(page.locator('.skip-link')).toHaveCount(1);
      expect(await page.locator('h1').count(), `h1 count at ${path}`).toBe(1);
    }
  });

  test('images that carry meaning have alternative text', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    const missing = await page.locator('img:not([alt])').count();
    expect(missing).toBe(0);
  });
});

/* ── Addresses, canonicals and what crawlers read ─────────────────── */

const ORIGIN = 'https://naarad.io';

/** One of each kind of page, with what its own address must say about it. */
const PAGE_TYPES = [
  { path: '/', canonical: '/', h1: 'Walk a place.', text: 'Iconic journeys, deeper stories.', types: ['WebSite', 'Organization'] },
  { path: '/routes/', canonical: '/routes/', h1: 'Go where', text: 'Hampi Heritage Trail', types: ['BreadcrumbList'] },
  { path: '/explore/', canonical: '/explore/', h1: 'Find your', text: 'Hampi Heritage Trail', types: ['BreadcrumbList'] },
  { path: '/routes/hampi-heritage-trail/', canonical: '/routes/hampi-heritage-trail/', h1: 'Hampi Heritage Trail', text: 'Virupaksha Temple', types: ['BreadcrumbList', 'TouristTrip'] },
  // A route with no published stops is a stub: reachable, but out of search and describing no trip.
  { path: '/routes/marina-beach-trail/', canonical: '/routes/marina-beach-trail/', h1: 'Marina Beach Trail', text: 'Stops are not published', types: ['BreadcrumbList'], robots: 'noindex,follow' },
  { path: '/routes/mysore-palace-heritage-walk/', canonical: '/routes/mysore-palace-heritage-walk/', h1: 'Mysore Palace Heritage Walk', text: 'Stops are not published', types: ['BreadcrumbList'], robots: 'noindex,follow' },
  { path: '/stories/', canonical: '/stories/', h1: 'Listen closer.', text: 'The Stone Chariot of Hampi', types: ['BreadcrumbList'] },
  { path: '/stories/stone-chariot-of-hampi/', canonical: '/stories/stone-chariot-of-hampi/', h1: 'The Stone Chariot', text: 'Hampi Heritage Trail', types: ['BreadcrumbList', 'Article'] },
  { path: '/creators/', canonical: '/creators/', h1: 'Real places.', text: 'Choose a route and stop', types: ['BreadcrumbList'] },
  { path: '/journey/', canonical: '/journey/', h1: 'My Journey', text: 'No routes walked yet', types: ['BreadcrumbList'], robots: 'noindex' },
  { path: '/about/', canonical: '/about/', h1: 'Explore.', text: 'Where the data comes from', types: ['BreadcrumbList'] },
];

/** The JSON-LD graphs in a document, parsed. */
function structuredData(html) {
  return [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
}

const graphTypes = (blocks) => blocks.flatMap((block) => block['@graph'].map((node) => node['@type']));

async function head(page) {
  return page.evaluate(() => ({
    canonicals: [...document.querySelectorAll('link[rel="canonical"]')].map((link) => link.getAttribute('href')),
    ogUrl: document.querySelector('meta[property="og:url"]')?.content || null,
    ogImage: document.querySelector('meta[property="og:image"]')?.content || null,
    robots: document.querySelector('meta[name="robots"]')?.content || null,
    descriptions: document.querySelectorAll('meta[name="description"]').length,
    title: document.title,
    jsonld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => JSON.parse(node.textContent)),
  }));
}

test.describe('addresses and canonicals', () => {
  test('every page type carries exactly one correct canonical', async ({ page }) => {
    for (const type of PAGE_TYPES) {
      await page.goto(type.path);
      await expect(page.locator('h1')).toContainText(type.h1);
      const tags = await head(page);
      expect(tags.canonicals, `canonical at ${type.path}`).toEqual([ORIGIN + type.canonical]);
      expect(tags.ogUrl, `og:url at ${type.path}`).toBe(ORIGIN + type.canonical);
      expect(tags.descriptions, `description tags at ${type.path}`).toBe(1);
      expect(tags.robots, `robots at ${type.path}`).toBe(type.robots || null);
      expect(tags.jsonld).toHaveLength(1);
      for (const kind of type.types) expect(graphTypes(tags.jsonld), `JSON-LD at ${type.path}`).toContain(kind);
      expect(tags.ogImage, `og:image at ${type.path}`).toMatch(/^https:\/\/naarad\.io\/Images\/og\/[a-z0-9-]+\.jpg$/);
    }
  });

  test('the selected stop is a query, and the canonical ignores it', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/?stop=3');
    await expect(page.locator('.stop-title')).toHaveText('Hampi Bazaar');
    expect((await head(page)).canonicals).toEqual([`${ORIGIN}/routes/hampi-heritage-trail/`]);
    await page.locator('.stop-item', { hasText: 'Virupaksha Temple' }).click();
    await expect(page).toHaveURL(/\/routes\/hampi-heritage-trail\/$/);
  });

  test('the head follows client-side navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#home-title')).toBeVisible();

    await page.locator('#nav-stories').click();
    await expect(page).toHaveURL(/\/stories\/$/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${ORIGIN}/stories/`);
    await expect(page).toHaveTitle('Stories · Naarad');

    await page.locator('.story-lead').click();
    await expect(page).toHaveURL(/\/stories\/stone-chariot-of-hampi\/$/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${ORIGIN}/stories/stone-chariot-of-hampi/`);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');

    await page.locator('.story-route-cta').click();
    await expect(page).toHaveURL(/\/routes\/hampi-heritage-trail\/$/);
    const tags = await head(page);
    expect(tags.canonicals).toEqual([`${ORIGIN}/routes/hampi-heritage-trail/`]);
    expect(tags.ogUrl).toBe(`${ORIGIN}/routes/hampi-heritage-trail/`);
    expect(tags.ogImage).toBe(`${ORIGIN}/Images/og/route-hampi-heritage-trail.jpg`);
    expect(tags.descriptions).toBe(1);
    expect(tags.jsonld).toHaveLength(1);
    expect(graphTypes(tags.jsonld)).toContain('TouristTrip');
    expect(graphTypes(tags.jsonld)).not.toContain('Article');
    expect(await page.locator('head [data-page]').evaluateAll((nodes) => new Set(nodes.map((node) => node.outerHTML)).size === nodes.length)).toBe(true);

    await page.locator('#nav-journey').click();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    await page.goBack();
    await expect(page.locator('#route-title')).toHaveText('Hampi Heritage Trail');
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });

  test('the header search opens the catalogue with the query in its address', async ({ page }) => {
    await page.goto('/');
    await page.locator('#route-search').fill('hampi');
    await page.locator('#route-search').press('Enter');
    await expect(page).toHaveURL(/\/routes\/\?q=hampi$/);
    await expect(page.locator('.route-card')).toHaveCount(1);
    await expect(page.locator('#catalogue-query')).toHaveValue('hampi');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${ORIGIN}/routes/`);
  });

  test('old addresses land on the clean ones', async ({ page }) => {
    const cases = [
      ['/?route=hampi-heritage-trail', /\/routes\/hampi-heritage-trail\/$/, '#route-title', 'Hampi Heritage Trail'],
      ['/?route=hampi-heritage-trail&stop=3', /\/routes\/hampi-heritage-trail\/\?stop=3$/, '.stop-title', 'Hampi Bazaar'],
      ['/?story=stone-chariot-of-hampi', /\/stories\/stone-chariot-of-hampi\/$/, '.story-hero h1', 'The Stone Chariot'],
      ['/?view=routes', /\/routes\/$/, '.catalogue-hero h1', 'Go where'],
      ['/?view=about', /\/about\/$/, '.info-hero h1', 'Explore'],
      ['/?view=journey', /\/journey\/$/, '.journey-hero h1', 'My Journey'],
      ['/route/hampi-heritage-trail', /\/routes\/hampi-heritage-trail\/$/, '#route-title', 'Hampi Heritage Trail'],
      ['/story/stone-chariot-of-hampi', /\/stories\/stone-chariot-of-hampi\/$/, '.story-hero h1', 'The Stone Chariot'],
      ['/about', /\/about\/$/, '.info-hero h1', 'Explore'],
    ];
    for (const [from, to, selector, text] of cases) {
      await page.goto(from);
      await expect(page, `from ${from}`).toHaveURL(to);
      await expect(page.locator(selector), `from ${from}`).toContainText(text);
      expect(await page.locator('h1').count(), `h1 count from ${from}`).toBe(1);
    }
  });

  test('an unknown address is a real 404 that leads back to routes and stories', async ({ page, request }) => {
    const response = await request.get('/no-such-place/');
    expect(response.status()).toBe(404);
    const html = await response.text();
    expect(html).toContain('<meta name="robots" content="noindex"');
    expect(html).not.toContain('rel="canonical"');

    await page.goto('/no-such-place/');
    await expect(page.locator('h1')).toContainText('not');
    await expect(page.locator('#app-content a[href="/routes/"]')).toBeVisible();
    await expect(page.locator('#app-content a[href="/stories/"]')).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');

    // A route that does not exist is not quietly replaced by another one.
    await page.goto('/routes/no-such-route/');
    await expect(page.locator('h1')).toContainText('not');
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  });

  test('My Journey stays out of search', async ({ page, request }) => {
    const html = await (await request.get('/journey/')).text();
    expect(html).toContain('<meta name="robots" content="noindex"');
    await page.goto('/journey/');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).not.toContain('/journey/');
  });
});

test.describe('pre-rendered pages', () => {
  test('the HTML of every page type holds its heading, content and structured data', async ({ request }) => {
    for (const type of PAGE_TYPES) {
      const response = await request.get(type.path);
      expect(response.status(), type.path).toBe(200);
      const html = await response.text();
      expect(html, `prerender marker at ${type.path}`).toContain(`data-prerendered="${type.path}"`);
      const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/g) || [];
      expect(h1, `h1 at ${type.path}`).toHaveLength(1);
      expect(h1[0].replace(/<[^>]+>/g, ''), `h1 at ${type.path}`).toContain(type.h1);
      expect(html, `content at ${type.path}`).toContain(type.text);
      expect(html.match(/rel="canonical"/g), `canonical at ${type.path}`).toHaveLength(1);
      expect(html).toContain(`<link rel="canonical" href="${ORIGIN}${type.canonical}"`);
      expect(html.match(/<meta name="robots" content="([^"]*)"/)?.[1] || null, `robots at ${type.path}`).toBe(type.robots || null);
      // Nothing is hidden waiting for an animation that only script can start.
      expect(html).not.toMatch(/data-reveal|data-motion|leaflet-container/);
      const blocks = structuredData(html);
      expect(blocks, `JSON-LD at ${type.path}`).toHaveLength(1);
      expect(blocks[0]['@context']).toBe('https://schema.org');
      for (const kind of type.types) expect(graphTypes(blocks), `JSON-LD at ${type.path}`).toContain(kind);
    }
  });

  test('structured data describes routes and stories from their real data', async ({ request }) => {
    const route = structuredData(await (await request.get('/routes/hampi-heritage-trail/')).text())[0]['@graph'];
    const trip = route.find((node) => node['@type'] === 'TouristTrip');
    expect(trip.itinerary.numberOfItems).toBe(8);
    expect(trip.itinerary.itemListElement[0].item).toMatchObject({ '@type': 'TouristAttraction', name: 'Virupaksha Temple' });
    expect(trip.itinerary.itemListElement[0].item.geo).toMatchObject({ '@type': 'GeoCoordinates' });
    expect(trip.potentialAction).toEqual({ '@type': 'TravelAction', distance: '5.2 km' });
    const crumbs = route.find((node) => node['@type'] === 'BreadcrumbList').itemListElement;
    expect(crumbs.map((crumb) => crumb.item)).toEqual([`${ORIGIN}/`, `${ORIGIN}/routes/`, `${ORIGIN}/routes/hampi-heritage-trail/`]);

    // A route with no published stops describes no trip at all.
    for (const slug of ['mysore-palace-heritage-walk', 'marina-beach-trail']) {
      const plain = structuredData(await (await request.get(`/routes/${slug}/`)).text())[0]['@graph'];
      expect(plain.map((node) => node['@type']), slug).toEqual(['BreadcrumbList', 'Organization']);
    }

    const story = structuredData(await (await request.get('/stories/bazaar-that-sold-the-world/')).text())[0]['@graph'];
    const article = story.find((node) => node['@type'] === 'Article');
    expect(article.author).toMatchObject({ '@type': 'Organization', name: 'Naarad editorial' });
    expect(article.about).toMatchObject({ '@type': 'TouristTrip', url: `${ORIGIN}/routes/hampi-heritage-trail/` });
    expect(article.mentions[0]).toMatchObject({ '@type': 'TouristAttraction', name: 'Hampi Bazaar' });

    const home = structuredData(await (await request.get('/')).text())[0]['@graph'];
    const site = home.find((node) => node['@type'] === 'WebSite');
    expect(site.potentialAction.target.urlTemplate).toBe(`${ORIGIN}/routes/?q={search_term_string}`);
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('a route and a story read in full', async ({ page }) => {
      await page.goto('/routes/hampi-heritage-trail/');
      await expect(page.locator('#route-title')).toHaveText('Hampi Heritage Trail');
      await expect(page.locator('.stop-title')).toHaveText('Virupaksha Temple');
      await expect(page.locator('.stop-item')).toHaveCount(8);
      await expect(page.locator('#map .route-preview')).toBeVisible();

      await page.goto('/stories/stone-chariot-of-hampi/');
      await expect(page.locator('.story-hero h1')).toContainText('The Stone Chariot');
      await expect(page.locator('.story-section')).toHaveCount(6);
      await expect(page.locator('.story-section').first()).toBeVisible();
    });
  });

  test('booting on a pre-rendered page keeps it: no layout shift, one h1', async ({ page }) => {
    await page.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value;
      }).observe({ type: 'layout-shift', buffered: true });
      // The heading as parsed from the HTML, before any script runs.
      document.addEventListener('readystatechange', () => {
        if (document.readyState === 'interactive') window.__parsedH1 = document.querySelector('h1');
      });
    });
    for (const path of ['/', '/routes/', '/routes/hampi-heritage-trail/', '/stories/stone-chariot-of-hampi/', '/about/']) {
      await page.goto(path, { waitUntil: 'networkidle' });
      if (path === '/routes/hampi-heritage-trail/') await expect(page.locator('#map.leaflet-container')).toBeVisible();
      await page.waitForTimeout(400);
      const result = await page.evaluate(() => ({
        cls: window.__cls,
        h1: document.querySelectorAll('h1').length,
        kept: document.querySelector('h1') === window.__parsedH1,
      }));
      expect(result.cls, `CLS at ${path}`).toBeLessThan(0.02);
      expect(result.h1, `h1 count at ${path}`).toBe(1);
      expect(result.kept, `pre-rendered markup kept at ${path}`).toBe(true);
    }
  });
});

test.describe('sitemap, robots and links', () => {
  test('the sitemap lists only clean addresses, and each one answers 200', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    expect(locs.length).toBeGreaterThan(10);
    expect(locs).toContain(`${ORIGIN}/`);
    expect(locs).toContain(`${ORIGIN}/routes/hampi-heritage-trail/`);
    expect(locs).toContain(`${ORIGIN}/stories/stone-chariot-of-hampi/`);
    expect(locs).toContain(`${ORIGIN}/explore/`);           // its own page now, not an alias of /routes/
    expect(locs).toContain(`${ORIGIN}/routes/`);
    // Routes with no stops are reachable but not offered to search engines.
    expect(locs).not.toContain(`${ORIGIN}/routes/mysore-palace-heritage-walk/`);
    expect(locs).not.toContain(`${ORIGIN}/routes/marina-beach-trail/`);
    expect(xml).not.toMatch(/changefreq|priority/);
    for (const loc of locs) {
      expect(loc).toMatch(/^https:\/\/naarad\.io\/([a-z0-9-]+\/)*$/);
      const response = await request.get(loc.replace(ORIGIN, ''));
      expect(response.status(), loc).toBe(200);
      const html = await response.text();
      expect(html, `canonical of ${loc}`).toContain(`<link rel="canonical" href="${loc}"`);
      expect(html, `robots of ${loc}`).not.toMatch(/<meta name="robots"/);
      expect(html, `links in ${loc}`).not.toMatch(/href="[^"]*[?&](route|story|view)=/);
    }
    for (const lastmod of xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) expect(lastmod[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('robots.txt names the sitemap, and the verification file is served', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Sitemap: https://naarad.io/sitemap.xml');
    expect(robots).not.toMatch(/Crawl-delay/i);
    expect((await request.get('/googlecc72b0f2c9685bc7.html')).status()).toBe(200);
  });

  test('no internal link in a rendered page uses the old query addresses', async ({ page }) => {
    for (const path of ['/', '/routes/', '/routes/hampi-heritage-trail/', '/stories/', '/stories/stone-chariot-of-hampi/', '/creators/', '/journey/', '/about/']) {
      await page.goto(path);
      await expect(page.locator('h1')).toHaveCount(1);
      const old = await page.locator('a[href]').evaluateAll((links) => links
        .map((link) => link.href).filter((href) => href.startsWith(location.origin) && /[?&](route|story|view)=/.test(href)));
      expect(old, `old links at ${path}`).toEqual([]);
    }
  });

  test('every share card exists and credits a photograph whose licence allows adaptation', async ({ request }) => {
    const manifest = await (await request.get('/Images/og/manifest.json')).json();
    expect(manifest.cards.length).toBeGreaterThan(20);
    for (const card of manifest.cards) {
      const image = await request.get(`/Images/og/${card.file}`);
      expect(image.status(), card.file).toBe(200);
      expect((await image.body()).length, card.file).toBeLessThanOrEqual(200 * 1024);
      if (card.photo) {
        expect(card.photo.licence, card.file).toMatch(/^(CC0|Public Domain Mark|PDM|CC BY \d\.\d|CC BY-SA \d\.\d)/);
        expect(card.photo.author, card.file).toBeTruthy();
        expect(card.photo.sourcePage, card.file).toMatch(/^https:\/\//);
      }
    }
  });
});

test.describe('offline route bundles (behind a flag)', () => {
  const SLUG = 'hampi-heritage-trail';
  const FLAG = 'naarad.flag.offline-bundles';

  test('flag off: the route page still says offline bundles are not available', async ({ page }) => {
    await page.goto(`/routes/${SLUG}/`);
    await expect(page.locator('.route-facts')).toContainText('Not yet available');
    await expect(page.locator('[data-action="offline"]')).toHaveCount(0);
    await page.goto('/journey/');
    await page.getByRole('tab', { name: /Downloads/ }).click();
    await expect(page.locator('[data-journey-panel="downloads"]')).toContainText('not available yet');
  });

  test.describe('flag on', () => {
    test.use({ serviceWorkers: 'allow' });

    test('keeps a route on the device, opens it with no network, and removes it', async ({ page, context }) => {
      await page.addInitScript((key) => { try { localStorage.setItem(key, 'on'); } catch { /* ignore */ } }, FLAG);
      await page.goto(`/routes/${SLUG}/`);
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.reload();
      const name = (await page.locator('h1').first().textContent()).trim();
      const button = page.locator('[data-action="offline"]');
      await expect(button).toContainText('Download for offline');
      await expect(button).toContainText('No map tiles or audio');

      await button.click();
      await expect(button).toContainText('Saved offline', { timeout: 30000 });
      await expect(button).toContainText(/\d+(\.\d)? (KB|MB)/);

      // The bundle must stand on its own: drop every other cache, then lose the network.
      await page.evaluate(async () => {
        for (const key of await caches.keys()) if (key !== 'naarad-bundles') await caches.delete(key);
      });
      await context.setOffline(true);
      await page.goto(`/routes/${SLUG}/`);
      await expect(page.locator('h1').first()).toContainText(name);
      expect(await page.locator('[data-select-stop]').count()).toBeGreaterThan(0);
      await expect(page.locator('[data-action="offline"]')).toContainText('Saved offline');
      await context.setOffline(false);

      // My Journey lists it, and removing it deletes the files.
      await page.goto('/journey/');
      await page.getByRole('tab', { name: /Downloads/ }).click();
      const panel = page.locator('[data-journey-panel="downloads"]');
      await expect(panel).toContainText(name);
      await expect(panel).toContainText('no map tiles or audio');
      await panel.locator('[data-download-remove]').click();
      await page.getByRole('tab', { name: /Downloads/ }).click();
      await expect(page.locator('[data-journey-panel="downloads"]')).toContainText('No offline routes yet');
      expect(await page.evaluate(async () => (await (await caches.open('naarad-bundles')).keys()).length)).toBe(0);
    });

    test('a failed download keeps nothing and says so', async ({ page }) => {
      await page.addInitScript((key) => { try { localStorage.setItem(key, 'on'); } catch { /* ignore */ } }, FLAG);
      await page.goto(`/routes/${SLUG}/`);
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.reload();
      // page.route cannot see the service worker's fetches, so fail the page's own fetch.
      await page.evaluate(() => {
        const real = window.fetch.bind(window);
        window.fetch = (url, init) => (String(url).includes('/content/routes.json')
          ? Promise.resolve(new Response('down', { status: 503 }))
          : real(url, init));
      });
      await page.locator('[data-action="offline"]').click();
      await expect(page.locator('[data-action="offline"]')).toContainText('Download for offline', { timeout: 30000 });
      expect(await page.evaluate(async () => (await (await caches.open('naarad-bundles')).keys()).length)).toBe(0);
      expect(((await journey(page)).downloads || []).length).toBe(0);
    });
  });
});

test.describe('accounts: the sign-in panel (behind a flag)', () => {
  const FLAG = 'naarad.flag.accounts';
  const SUPABASE = /^https:\/\/efpkaptocxhevywfqhyt\.supabase\.co\//;
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

  /* A stand-in for Supabase: no real account is ever made. Records every request. */
  async function mockSupabase(page, { signupSession = false } = {}) {
    const seen = [];
    await page.route(SUPABASE, async (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      const url = new URL(request.url());
      const body = request.postDataJSON ? request.postDataJSON() : null;
      seen.push({ method: request.method(), url: request.url(), headers: request.headers(), body });
      const json = (status, data) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(data) });
      const user = { id: 'u-1', email: 'person@example.com' };
      if (url.pathname === '/auth/v1/signup') return json(200, signupSession ? { access_token: 'at', refresh_token: 'rt', expires_in: 3600, user } : user);
      if (url.pathname === '/auth/v1/token') {
        if (body.password === 'wrong-password') return json(400, { error_description: 'Invalid login credentials' });
        if (body.password === 'xss-password') return json(400, { error_description: '<img src=x onerror="window.__xss=1">' });
        return json(200, { access_token: 'at', refresh_token: 'rt', expires_in: 3600, user });
      }
      if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: CORS });
      if (url.pathname === '/rest/v1/creator_submissions') return json(201, [{ id: 's-1', status: 'submitted' }]);
      if (url.pathname === '/rest/v1/rpc/delete_my_account') return route.fulfill({ status: 204, headers: CORS });
      return json(404, { message: 'not mocked' });
    });
    return seen;
  }
  const flagOn = (page) => page.addInitScript((key) => { try { localStorage.setItem(key, 'on'); } catch { /* ignore */ } }, FLAG);
  const panel = (page) => page.locator('.account-panel');

  test('flag off: no panel, and the pre-rendered Studio page has none either', async ({ page, request }) => {
    await page.goto('/creators/');
    await expect(page.locator('.studio')).toBeVisible();
    await expect(panel(page)).toHaveCount(0);
    expect(await (await request.get('/creators/')).text()).not.toContain('account-panel');
  });

  test('flag on: the panel shows a labelled sign-in form', async ({ page }) => {
    await mockSupabase(page);
    await flagOn(page);
    await page.goto('/creators/');
    await expect(panel(page)).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toHaveAttribute('type', 'password');
  });

  test('sign-up needs the 18-or-older box and sends nothing without it', async ({ page }) => {
    const seen = await mockSupabase(page);
    await flagOn(page);
    await page.goto('/creators/');
    await page.getByRole('button', { name: 'Create an account' }).click();
    await expect(panel(page)).toContainText('delete');
    await page.getByLabel('Email').fill('person@example.com');
    await page.getByLabel('Password').fill('long-enough-password');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.locator('[data-account-error]')).toContainText('18 or over');
    expect(seen.length).toBe(0);
  });

  test('sign-up with the box records it in the account, then asks the person to confirm their email', async ({ page }) => {
    const seen = await mockSupabase(page);
    await flagOn(page);
    await page.goto('/creators/');
    await page.getByRole('button', { name: 'Create an account' }).click();
    await page.getByLabel('Email').fill('person@example.com');
    await page.getByLabel('Password').fill('long-enough-password');
    await page.getByLabel('I am 18 or older').check();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(panel(page)).toContainText(/check your (inbox|email)/i);
    const signup = seen.find((entry) => entry.url.endsWith('/auth/v1/signup'));
    expect(signup.body.data).toEqual({ over_18: true });
    expect(signup.body.email).toBe('person@example.com');
    expect(signup.headers.apikey).toMatch(/^eyJ/);
    expect(await page.evaluate(() => localStorage.getItem('naarad.auth.v1'))).toBeNull();
  });

  test('a wrong password is shown plainly and keeps no session', async ({ page }) => {
    await mockSupabase(page);
    await flagOn(page);
    await page.goto('/creators/');
    await page.getByLabel('Email').fill('person@example.com');
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('[data-account-error]')).toContainText('Invalid login credentials');
    expect(await page.evaluate(() => localStorage.getItem('naarad.auth.v1'))).toBeNull();
  });

  test('signing in shows who, never keeps the password anywhere, and signing out clears the session', async ({ page }) => {
    const seen = await mockSupabase(page);
    await flagOn(page);
    await page.goto('/creators/');
    await page.getByLabel('Email').fill('person@example.com');
    await page.getByLabel('Password').fill('correct-horse-battery');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(panel(page)).toContainText('Signed in as person@example.com');
    await expect(page.getByLabel('Password')).toHaveCount(0);

    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    expect(stored).toContain('naarad.auth.v1');
    expect(stored).not.toContain('correct-horse-battery');
    expect(await page.content()).not.toContain('correct-horse-battery');
    expect(seen.every((entry) => !entry.url.includes('correct-horse-battery'))).toBe(true);

    await page.reload();
    await expect(panel(page)).toContainText('Signed in as person@example.com');
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page.getByLabel('Password')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('naarad.auth.v1'))).toBeNull();
    expect(seen.some((entry) => entry.url.endsWith('/auth/v1/logout'))).toBe(true);
  });

  async function signedInStudio(page) {
    const seen = await mockSupabase(page);
    await flagOn(page);
    await page.goto('/creators/');
    await page.getByLabel('Email').fill('person@example.com');
    await page.getByLabel('Password').fill('correct-horse-battery');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(panel(page)).toContainText('Signed in as person@example.com');
    return seen;
  }

  test('signed in, a draft goes for review as "submitted" and the Studio says so', async ({ page }) => {
    const seen = await signedInStudio(page);
    await page.locator('[data-studio-step="metadata"]').click();
    await page.locator('[data-studio="title"]').fill('Dawn at the temple');
    await page.locator('[data-studio-step="review"]').click();
    await page.locator('[data-studio="submit"]').click();
    await expect(page.locator('.studio-table')).toContainText('Sent for review');
    const sent = seen.find((entry) => entry.url.includes('/rest/v1/creator_submissions'));
    expect(sent.method).toBe('POST');
    expect(sent.body.status).toBe('submitted');
    expect(sent.body.title).toBe('Dawn at the temple');
  });

  test('deleting the account asks twice, then erases it and signs out', async ({ page }) => {
    const seen = await signedInStudio(page);
    await page.getByRole('button', { name: 'Delete my account' }).click();
    await expect(panel(page)).toContainText('erases your account');
    expect(seen.some((entry) => entry.url.includes('delete_my_account'))).toBe(false);
    await page.getByRole('button', { name: 'Keep my account' }).click();
    await expect(panel(page)).toContainText('Signed in as person@example.com');
    await page.getByRole('button', { name: 'Delete my account' }).click();
    await page.getByRole('button', { name: 'Delete everything' }).click();
    await expect(page.getByLabel('Password')).toBeVisible();
    expect(seen.some((entry) => entry.url.includes('delete_my_account') && entry.method === 'POST')).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('naarad.auth.v1'))).toBeNull();
  });

  test('markup in a server error is shown as text and never runs', async ({ page }) => {
    await mockSupabase(page);
    await flagOn(page);
    await page.goto('/creators/');
    await page.getByLabel('Email').fill('person@example.com');
    await page.getByLabel('Password').fill('xss-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('[data-account-error]')).toContainText('<img src=x');
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });

  test('on a phone the controls are large enough to touch and nothing overflows', async ({ page }) => {
    await mockSupabase(page);
    await flagOn(page);
    await page.setViewportSize(PHONE);
    await page.goto('/creators/');
    await page.getByRole('button', { name: 'Create an account' }).click();
    for (const target of [page.getByRole('button', { name: 'Create account' }), page.getByLabel('I am 18 or older'), page.getByLabel('Email')]) {
      const box = await target.boundingBox();
      expect(box.height, 'touch target height').toBeGreaterThanOrEqual(22);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
});

test.describe('offline route bundles v2, part A: the kit and the space check', () => {
  test.use({ serviceWorkers: 'allow' });
  const SLUG = 'hampi-heritage-trail';
  const FLAG = 'naarad.flag.offline-bundles';

  async function openRoute(page) {
    await page.addInitScript((key) => { try { localStorage.setItem(key, 'on'); } catch { /* ignore */ } }, FLAG);
    await page.goto(`/routes/${SLUG}/`);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    return (await page.locator('h1').first().textContent()).trim();
  }

  test('My Journey opens with no network once a route is saved, and lists it', async ({ page, context }) => {
    const name = await openRoute(page);
    await page.locator('[data-action="offline"]').click();
    await expect(page.locator('[data-action="offline"]')).toContainText('Saved offline', { timeout: 30000 });

    // Drop every cache but the bundles, so nothing but the bundle can answer.
    await page.evaluate(async () => {
      for (const key of await caches.keys()) if (key !== 'naarad-bundles') await caches.delete(key);
    });
    await context.setOffline(true);
    await page.goto('/journey/');
    await expect(page.locator('h1').first()).toBeVisible();
    await page.getByRole('tab', { name: /Downloads/ }).click();
    await expect(page.locator('[data-journey-panel="downloads"]')).toContainText(name);
    await context.setOffline(false);
  });

  test('a download that will not fit says so in words about space, and keeps nothing', async ({ page }) => {
    await openRoute(page);
    await page.evaluate(() => {
      Object.defineProperty(navigator.storage, 'estimate', { value: async () => ({ usage: 4_500_000, quota: 5_000_000 }), configurable: true });
    });
    await page.locator('[data-action="offline"]').click();
    await expect(page.locator('#site-notice')).toContainText(/space/i, { timeout: 30000 });
    await expect(page.locator('[data-action="offline"]')).toContainText('Download for offline');
    expect(await page.evaluate(async () => (await (await caches.open('naarad-bundles')).keys()).length)).toBe(0);
    expect(((await journey(page)).downloads || []).length).toBe(0);
  });

  test('after a download the browser is asked to keep it, and the notice says honestly what it answered', async ({ page }) => {
    await openRoute(page);
    await page.evaluate(() => {
      Object.defineProperty(navigator.storage, 'persisted', { value: async () => false, configurable: true });
      Object.defineProperty(navigator.storage, 'persist', { value: async () => false, configurable: true });
    });
    await page.locator('[data-action="offline"]').click();
    await expect(page.locator('#site-notice')).toContainText('may remove this if space runs low', { timeout: 30000 });
  });
});

test.describe('offline route bundles v2, part B: the offline bar and unsaved routes', () => {
  test.use({ serviceWorkers: 'allow' });
  const SLUG = 'hampi-heritage-trail';
  const FLAG = 'naarad.flag.offline-bundles';

  async function ready(page, { flag = true } = {}) {
    if (flag) await page.addInitScript((key) => { try { localStorage.setItem(key, 'on'); } catch { /* ignore */ } }, FLAG);
    await page.goto(`/routes/${SLUG}/`);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
  }
  async function saveThisRoute(page) {
    await page.locator('[data-action="offline"]').click();
    await expect(page.locator('[data-action="offline"]')).toContainText('Saved offline', { timeout: 30000 });
  }
  const dropOtherCaches = (page) => page.evaluate(async () => {
    for (const key of await caches.keys()) if (key !== 'naarad-bundles') await caches.delete(key);
  });

  test('flag off: no bar, even with no network', async ({ page, context }) => {
    await ready(page, { flag: false });
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.locator('#offline-bar')).toHaveCount(0);
    await context.setOffline(false);
  });

  test('the bar appears when the network goes and disappears when it returns', async ({ page, context }) => {
    await ready(page);
    await expect(page.locator('#offline-bar')).toHaveCount(0);
    await context.setOffline(true);
    await expect(page.locator('#offline-bar')).toContainText('You are offline', { timeout: 10000 });
    await expect(page.locator('#offline-bar')).toContainText('No routes are saved on this device yet');
    await context.setOffline(false);
    await expect(page.locator('#offline-bar')).toHaveCount(0, { timeout: 10000 });
  });

  test('with a route saved, the bar says so, the catalogue opens offline, and unsaved routes are marked and do not open', async ({ page, context }) => {
    await ready(page);
    await saveThisRoute(page);
    await dropOtherCaches(page);
    await context.setOffline(true);

    await page.goto('/routes/');
    await expect(page.locator('#offline-bar')).toContainText('Showing routes saved on this device', { timeout: 10000 });
    const saved = page.locator(`a[href="/routes/${SLUG}/"]`).first();
    const other = page.locator(`a.route-card[href^="/routes/"]:not([href="/routes/${SLUG}/"])`).first();
    await expect(saved).toBeVisible();
    await expect(saved).not.toHaveAttribute('data-unsaved-offline', /.*/);
    await expect(other).toHaveAttribute('data-unsaved-offline', '', { timeout: 10000 });
    await expect(other).toContainText('Not saved for offline');

    // A visitor can still tap it (aria-disabled only tells assistive tech), so force the click.
    await other.click({ force: true });
    await expect(page.locator('#site-notice')).toContainText('not saved');
    expect(new URL(page.url()).pathname).toBe('/routes/');

    await saved.click();
    await expect(page).toHaveURL(new RegExp(`/routes/${SLUG}/`));
    await expect(page.locator('h1').first()).toBeVisible();

    // Back online, the marks go and every card is an ordinary link again.
    await context.setOffline(false);
    await page.goto('/routes/');
    await expect(page.locator('[data-unsaved-offline]')).toHaveCount(0, { timeout: 10000 });
    await expect(page.locator('.unsaved-note')).toHaveCount(0);
    await expect(page.locator('#offline-bar')).toHaveCount(0);
  });

  test('on a route page, links to routes that are not saved are marked too', async ({ page, context }) => {
    await ready(page);
    await saveThis(page);
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.locator('.route-page a[data-unsaved-offline]').first()).toBeVisible({ timeout: 10000 });
    for (const link of await page.locator('.route-page a[data-unsaved-offline]').all()) {
      expect(await link.getAttribute('href')).toMatch(/^\/routes\/[a-z0-9-]+\/?$/);
      expect(await link.getAttribute('href')).not.toContain(SLUG);
    }
    await context.setOffline(false);

    async function saveThis(p) { await saveThisRoute(p); }
  });
});

/* ── A stub route is reachable but not offered to search ──────────── */

test.describe('routes without stops', () => {
  test('every route page that is not in the sitemap is noindex,follow and describes no trip', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();
    const listed = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
    const catalogue = await (await request.get('/routes/')).text();
    const slugs = [...new Set([...catalogue.matchAll(/href="\/routes\/([a-z0-9-]+)\/"/g)].map((match) => match[1]))];
    expect(slugs.length).toBeGreaterThan(15);

    let stubs = 0;
    for (const slug of slugs) {
      const response = await request.get(`/routes/${slug}/`);
      expect(response.status(), slug).toBe(200);                    // still reachable
      const html = await response.text();
      const types = structuredData(html)[0]['@graph'].map((node) => node['@type']);
      if (listed.has(`${ORIGIN}/routes/${slug}/`)) {
        expect(html, slug).not.toContain('name="robots"');
        expect(types, slug).toContain('TouristTrip');
        expect(html, slug).toMatch(/class="stop-item/);               // only a route with stops is listed
      } else {
        stubs += 1;
        expect(html, slug).toContain('<meta name="robots" content="noindex,follow"');
        expect(types, slug).not.toContain('TouristTrip');
        expect(html, slug).toContain(`<link rel="canonical" href="${ORIGIN}/routes/${slug}/"`);
      }
    }
    expect(stubs).toBeGreaterThan(10);
  });

  test('a catalogue row states no distance in its snippet or card, and a recorded track keeps its own', async ({ request }) => {
    const row = await (await request.get('/routes/mysore-palace-heritage-walk/')).text();
    expect(row.match(/<meta name="description" content="([^"]*)"/)[1]).not.toMatch(/\d\s?km/);
    const track = await (await request.get('/routes/marina-beach-trail/')).text();
    expect(track.match(/<meta name="description" content="([^"]*)"/)[1]).toMatch(/\d km/);
  });
});

/* ── A catalogue row has not been measured, and says so ───────────── */

test.describe('routes nobody has measured', () => {
  const ROWS = {
    'mysore-palace-heritage-walk': 'Mysore Palace Heritage Walk', 'varanasi-ghats-dawn-walk': 'Varanasi Ghats Dawn Walk',
    'jaipur-pink-city-cycling': 'Jaipur Pink City Cycling', 'konark-sun-temple-circuit': 'Konark Sun Temple Circuit',
    'mahabalipuram-shore-temple': 'Mahabalipuram Shore Temple', 'khajuraho-temple-corridor': 'Khajuraho Temple Corridor',
    'pondicherry-french-quarter': 'Pondicherry French Quarter', 'coorg-plantation-hike': 'Coorg Plantation Hike',
    'udaipur-lake-palace-circuit': 'Udaipur Lake Palace Circuit',
  };
  const FIGURE = /\d+(\.\d+)?\s?(km|m|min|hrs?)\b|\d–\d hrs/;

  test('the catalogue cards say "Not yet measured" for a row, and keep the length of a recorded track', async ({ page }) => {
    await page.goto('/routes/');
    await expect(page.locator('.route-card').first()).toBeVisible();
    for (const name of Object.values(ROWS)) {
      const card = page.locator('.route-card', { hasText: name });
      await expect(card.locator('.route-card-metrics'), name).toHaveText('Not yet measured');
      await expect(card, name).toContainText('Terrain not surveyed');
    }
    const track = page.locator('.route-card', { hasText: 'Marina Beach Trail' }).locator('.route-card-metrics');
    await expect(track).toContainText('15 km');
    await expect(track).not.toContainText('Not yet measured');
    await expect(page.locator('.route-card', { hasText: 'Hampi Heritage Trail' }).locator('.route-card-metrics')).toContainText('5.2 km');
  });

  test('a row\'s page says so in its facts and at a glance, in the HTML a crawler gets and in the page a visitor gets', async ({ page, request }) => {
    for (const slug of Object.keys(ROWS)) {
      const html = await (await request.get(`/routes/${slug}/`)).text();
      const main = html.slice(html.indexOf('<main id="app-content"'), html.indexOf('<section class="route-related">'));
      expect(main.match(/<b>Not yet measured<\/b>/g), `${slug}: the prerendered page`).toHaveLength(5);
      expect(main.replace(/<[^>]+>/g, ' '), `${slug}: the prerendered page`).not.toMatch(FIGURE);

      await page.goto(`/routes/${slug}/`);
      await expect(page.locator('.route-facts .is-muted', { hasText: 'Not yet measured' })).toHaveCount(2);
      await expect(page.locator('.route-facts')).toContainText('Duration');
      await expect(page.locator('.route-facts')).toContainText('Distance');
      await expect(page.locator('.route-glance .is-muted', { hasText: 'Not yet measured' })).toHaveCount(3);
      await expect(page.locator('.route-glance')).toContainText('No elevation profile yet');
      const body = await page.locator('.route-hero, .route-facts, .route-glance, .stop-panel, .route-overview').allInnerTexts();
      expect(body.join(' '), slug).not.toMatch(FIGURE);
      await expect(page.locator('.stop-panel')).toContainText('Stops are not published');
      await expect(page.locator('.stop-panel')).not.toContainText('with its distance and duration');
    }
  });

  test('a saved card does not keep a figure the route never had', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('naarad.journey.v1', JSON.stringify({
      saved: [{ slug: 'mysore-palace-heritage-walk', name: 'Mysore Palace Heritage Walk', location: 'Mysore, Karnataka', distanceM: 3100, durationMin: 60, savedAt: '2026-10-01T00:00:00Z' }],
      walks: [{ slug: 'mysore-palace-heritage-walk', name: 'Mysore Palace Heritage Walk', location: 'Mysore, Karnataka', distanceM: 3100, completedAt: '2026-10-02T00:00:00Z' }],
    })));
    await page.goto('/journey/', { waitUntil: 'networkidle' });
    await expect(page.locator('.journey-card').first()).toContainText('Mysore Palace Heritage Walk');
    for (const card of await page.locator('.journey-card').all()) await expect(card).not.toContainText(/3\.1 km|1 hrs/);
  });
});

/* ── Nothing is dated, described or promised without a source ─────── */

test.describe('what the pages claim', () => {
  test('a story carries no publication date anywhere unless the content records a real one', async ({ request, page }) => {
    for (const slug of ['stone-chariot-of-hampi', 'bazaar-that-sold-the-world', 'water-that-built-a-capital']) {
      const html = await (await request.get(`/stories/${slug}/`)).text();
      expect(html, slug).not.toMatch(/datePublished|article:published_time/);
      expect(html.replace(/<script[\s\S]*?<\/script>/g, ''), slug).not.toMatch(/published \d{4}/i);
      await page.goto(`/stories/${slug}/`);
      await expect(page.locator('.story-footer')).not.toContainText(/published \d/i);
      await expect(page.locator('meta[property="article:published_time"]')).toHaveCount(0);
    }
  });

  test('descriptions say what the page has', async ({ request }) => {
    const description = async (path) => (await (await request.get(path)).text()).match(/<meta name="description" content="([^"]*)"/)[1];
    // The studio keeps drafts in the browser; it takes no narration and publishes nothing.
    expect(await description('/creators/')).not.toMatch(/narration|audio|transcript|prepare/i);
    expect(await description('/creators/')).toMatch(/publishing is not open/i);
    // Only three routes have stops and terrain; the catalogue does not say all of them do.
    expect(await description('/routes/')).not.toMatch(/every published route|terrain/i);
    expect(await description('/explore/')).not.toBe(await description('/routes/'));   // two different pages
    expect(await description('/stories/')).not.toMatch(/long-form/i);
  });
});

/* ── A failed fetch is not "not found" ────────────────────────────── */

test.describe('when something fails to load', () => {
  const stillThere = async (page, { path, h1, canonical, robots }) => {
    await expect(page.locator('h1')).toContainText(h1);
    await expect(page.locator('link[rel="canonical"]'), path).toHaveAttribute('href', ORIGIN + canonical);
    // Its own robots rule, and no other: nothing is added because a fetch failed.
    if (robots) await expect(page.locator('meta[name="robots"]'), path).toHaveAttribute('content', robots);
    else await expect(page.locator('meta[name="robots"]'), path).toHaveCount(0);
    await expect(page.locator('script[type="application/ld+json"]'), path).toHaveCount(1);
    await expect(page.locator('#app-content[data-prerendered]'), path).toHaveCount(1);
    expect(await page.title(), path).not.toMatch(/not found/i);
  };

  test('a blocked content file leaves the pre-rendered page, its head and its data as they were', async ({ page }) => {
    const cases = [
      { block: '**/content/routes.json', path: '/routes/hampi-heritage-trail/', h1: 'Hampi Heritage Trail', canonical: '/routes/hampi-heritage-trail/' },
      { block: '**/content/stories.json', path: '/stories/stone-chariot-of-hampi/', h1: 'The Stone Chariot', canonical: '/stories/stone-chariot-of-hampi/' },
      { block: '**/content/stories.json', path: '/stories/', h1: 'Listen closer.', canonical: '/stories/' },
      { block: '**/content/photo-sources.json', path: '/routes/hampi-heritage-trail/', h1: 'Hampi Heritage Trail', canonical: '/routes/hampi-heritage-trail/' },
      { block: '**/discover/seed-tours.json', path: '/routes/mysore-palace-heritage-walk/', h1: 'Mysore Palace Heritage Walk', canonical: '/routes/mysore-palace-heritage-walk/', robots: 'noindex,follow' },
      { block: '**/app/views/route.js', path: '/routes/hampi-heritage-trail/', h1: 'Hampi Heritage Trail', canonical: '/routes/hampi-heritage-trail/' },
    ];
    for (const item of cases) {
      await page.route(item.block, (route) => route.abort());
      const failed = page.waitForEvent('console', (message) => /could not start/.test(message.text()));
      await page.goto(item.path);
      await failed;
      await stillThere(page, item);
      await expect(page.locator('.load-error'), item.path).toHaveCount(0);
      await page.unroute(item.block);
    }
  });

  test('an error response is treated the same as a blocked one', async ({ page }) => {
    await page.route('**/content/routes.json', (route) => route.fulfill({ status: 500, body: 'oops' }));
    const failed = page.waitForEvent('console', (message) => /could not start/.test(message.text()));
    await page.goto('/routes/hampi-heritage-trail/');
    await failed;
    await stillThere(page, { path: '/routes/hampi-heritage-trail/', h1: 'Hampi Heritage Trail', canonical: '/routes/hampi-heritage-trail/' });
  });

  test('a failed load is not remembered: the next navigation reads the data again', async ({ page }) => {
    let reads = 0;
    await page.route('**/content/routes.json', (route) => (reads++ === 0 ? route.abort() : route.continue()));
    const failed = page.waitForEvent('console', (message) => /could not start/.test(message.text()));
    await page.goto('/routes/hampi-heritage-trail/');
    await failed;
    await page.evaluate(() => { window.__sameDocument = true; });
    await page.locator('#nav-stories').click();
    await expect(page.locator('h1')).toContainText('Listen closer.');
    expect(await page.evaluate(() => window.__sameDocument)).toBe(true);     // drawn in place, not reloaded
    await page.locator('.story-lead').click();
    await expect(page.locator('h1')).toContainText('The Stone Chariot');
    expect(reads).toBeGreaterThan(1);
  });

  test('a route that really is not there is still not found, with a noindex', async ({ page }) => {
    await page.goto('/routes/no-such-route/');
    await expect(page.locator('h1')).toContainText('not');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  });

  test('a link whose view cannot load opens the address as a page, and a failed draw leaves the map alone', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    await expect(page.locator('#map .leaflet-pane').first()).toBeAttached();
    await page.route('**/app/views/studio.js', (route) => route.abort());

    // The draw itself fails without touching the page: the map is still there.
    const outcome = await page.evaluate(async () => {
      const { show } = await import('/app/main.js');
      try { await show(new URL('/creators/', location.origin)); return 'drawn'; } catch { return 'rejected'; }
    });
    expect(outcome).toBe('rejected');
    expect(new URL(page.url()).pathname).toBe('/routes/hampi-heritage-trail/');
    expect(await page.locator('#map .leaflet-pane').count()).toBeGreaterThan(0);

    // And a click is never left dead: the browser loads the address itself.
    await page.evaluate(() => { window.__sameDocument = true; });
    await page.locator('#nav-creators').click();
    await expect(page).toHaveURL(/\/creators\/$/);
    await expect(page.locator('h1')).toContainText('Real places.');
    expect(await page.evaluate(() => window.__sameDocument)).toBeUndefined();   // a new document
  });
});

/* ── Navigation details ───────────────────────────────────────────── */

test.describe('navigation details', () => {
  test('content files are always revalidated, never served from a stale copy', async ({ page }) => {
    await page.addInitScript(() => {
      window.__fetches = [];
      const original = window.fetch;
      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input.url;
        window.__fetches.push({ url, cache: init?.cache || 'default' });
        return original.call(window, input, init);
      };
    });
    for (const path of ['/routes/hampi-heritage-trail/', '/stories/stone-chariot-of-hampi/']) {
      await page.goto(path);
      await expect(page.locator('h1')).toHaveCount(1);
      const fetches = await page.evaluate(() => window.__fetches);
      const content = fetches.filter(({ url }) => /\/(content|discover)\/|geo-tracks/.test(url));
      expect(content.length, `content fetches at ${path}`).toBeGreaterThanOrEqual(4);
      for (const { url, cache } of content) expect(['no-cache', 'reload', 'no-store'], `${url} at ${path}`).toContain(cache);
    }
  });

  test('a malformed # in the address does not stop the page being drawn', async ({ page }) => {
    await noPageErrors(page, async () => {
      await page.goto('/routes/hampi-heritage-trail/#100%');
      await expect(page.locator('#map .leaflet-pane').first()).toBeAttached();
      await page.locator('#nav-stories').click();
      await expect(page.locator('h1')).toContainText('Listen closer.');
      await page.goBack();
      await expect(page.locator('#route-title')).toHaveText('Hampi Heritage Trail');
      await expect(page.locator('#map .leaflet-pane').first()).toBeAttached();
    });
  });

  test('a link to the page you are on adds no history entry', async ({ page }) => {
    await page.goto('/routes/');
    await expect(page.locator('.route-card').first()).toBeVisible();
    const before = await page.evaluate(() => history.length);
    await page.locator('#nav-routes').click();
    await page.locator('#nav-routes').click();
    await expect(page.locator('h1')).toContainText('Go where');
    expect(await page.evaluate(() => history.length)).toBe(before);
    expect(new URL(page.url()).pathname).toBe('/routes/');
  });

  test('an in-page anchor scrolls the page, it does not redraw it', async ({ page }) => {
    await page.goto('/stories/stone-chariot-of-hampi/');
    await expect(page.locator('.story-toc a').nth(2)).toBeVisible();
    await page.evaluate(() => {
      window.__h1 = document.querySelector('h1');
      window.__content = document.querySelector('.story-content');
    });
    const target = await page.locator('.story-toc a').nth(2).getAttribute('href');
    await page.locator('.story-toc a').nth(2).click();
    await expect(page).toHaveURL(new RegExp(`${target}$`));
    await page.goBack();
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`${target}$`));
    expect(await page.evaluate(() => document.querySelector('h1') === window.__h1 && document.querySelector('.story-content') === window.__content)).toBe(true);
  });
});

/* ── Layout stability at tablet widths, where heroes stack ────────── */

test.describe('layout shift', () => {
  for (const size of [{ width: 600, height: 900 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1240, height: 900 }]) {
    test(`pre-rendered pages hold still at ${size.width} px`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.addInitScript(() => {
        window.__cls = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value;
        }).observe({ type: 'layout-shift', buffered: true });
      });
      for (const path of ['/creators/', '/journey/', '/about/', '/routes/hampi-heritage-trail/']) {
        await page.goto(path, { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);
        expect(await page.evaluate(() => window.__cls), `CLS at ${path}`).toBeLessThan(0.02);
      }
    });
  }
});

/* ── Navigation draws the latest page, and puts focus where it belongs ── */

/** A speech synthesis that never finishes, so the listening bar can be driven without a voice. */
const withSpeech = () => {
  const synth = {
    speaking: false, pause() {}, resume() {}, cancel() {},
    speak(utterance) { window.__spoken = utterance; setTimeout(() => utterance.onend && utterance.onend(), 100000); },
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = function (text) { this.text = text; };
};

/** What has the keyboard, in a few words. */
const focused = (page) => page.evaluate(() => {
  const node = document.activeElement;
  if (!node || node === document.body) return 'body';
  return `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}${node.className && typeof node.className === 'string' ? `.${node.className.trim().split(/\s+/)[0]}` : ''}`;
});

/** Wait for a scroll (smooth or not) to come to rest: still for 300 ms running. */
const settled = (page) => page.waitForFunction(() => new Promise((resolve) => {
  let last = window.scrollY;
  let still = 0;
  const timer = setInterval(() => {
    still = Math.abs(window.scrollY - last) < 1 ? still + 1 : 0;
    last = window.scrollY;
    if (still >= 3) { clearInterval(timer); resolve(true); }
  }, 100);
}));

test.describe('a slow navigation does not paint over the one after it', () => {
  test('a first-visit stylesheet that arrives late is not drawn over the page the visitor moved on to', async ({ page }) => {
    await page.route('**/app/route.css', async (route) => { await new Promise((resolve) => setTimeout(resolve, 1500)); await route.continue(); });
    await page.goto('/');
    await expect(page.locator('.route-card').first()).toBeVisible();
    await page.locator('.route-card').first().click();          // a route page, whose stylesheet is slow
    await page.locator('#nav-about').click();                   // and the visitor moves on at once
    await expect(page.locator('h1')).toContainText('Explore.');
    await page.waitForTimeout(2200);                            // the slow stylesheet has arrived by now
    await expect(page.locator('h1')).toContainText('Explore.');
    expect(new URL(page.url()).pathname).toBe('/about/');
    await expect(page).toHaveTitle('About · Naarad');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${ORIGIN}/about/`);
    await expect(page.locator('#app-content')).toHaveClass('view-about');
    await expect(page.locator('body')).toHaveAttribute('data-view', 'about');
    await expect(page.locator('#nav-about')).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('focus after a page is drawn in place', () => {
  test('the first page takes no focus; a page reached by keyboard puts it on the new heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#home-title')).toBeVisible();
    expect(await focused(page)).toBe('body');

    await page.locator('.route-card').first().focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#route-title')).toBeFocused();

    await page.locator('#nav-stories').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('h1')).toContainText('Listen closer.');
    await expect(page.locator('h1')).toBeFocused();

    await page.goBack();
    await expect(page.locator('#route-title')).toBeFocused();
  });

  test('a heading that takes focus is not ringed, and the focus is on no scroll', async ({ page }) => {
    await page.goto('/about/');
    await page.locator('#nav-stories').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('h1')).toBeFocused();
    expect(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle)).toBe('none');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('the keyboard follows a re-render of the same page: related stops, studio steps, journey lists', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/', { waitUntil: 'networkidle' });
    await page.locator('[data-stop-tab="related"]').click();
    await expect(page.locator('[data-stop-panel="related"]')).toBeVisible();
    await page.locator('[data-stop-panel="related"] button').first().focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/stop=\d/);
    await expect(page.locator('.stop-title')).toBeFocused();

    await page.goto('/creators/', { waitUntil: 'networkidle' });
    await page.locator('[data-studio="next"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-step="transcript"]')).toBeVisible();
    await expect(page.locator('[data-studio="next"]')).toBeFocused();
  });

  test('removing a saved route keeps the visitor where they were: same tab, same scroll, keyboard on the next one', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('naarad.journey.v1', JSON.stringify({
      saved: ['hampi-heritage-trail', 'thanjavur-living-heritage', 'auroville-explorer'].map((slug, index) => ({
        slug, name: slug.replace(/-/g, ' '), location: 'India', stops: 8, savedAt: `2026-10-0${index + 1}T00:00:00Z`,
      })),
    })));
    await page.setViewportSize({ width: 1440, height: 500 });
    await page.goto('/journey/', { waitUntil: 'networkidle' });
    await page.locator('[data-journey-tab="saved"]').click();
    const unsave = page.locator('[data-journey-panel="saved"] [data-journey-unsave]');
    await expect(unsave).toHaveCount(3);
    await unsave.first().scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'instant' }));
    const top = await page.evaluate(() => window.scrollY);
    expect(top).toBeGreaterThan(100);

    await unsave.first().focus();
    await page.keyboard.press('Enter');
    await expect(unsave).toHaveCount(2);
    await expect(page.locator('[data-journey-tab="saved"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-journey-panel="saved"]')).toBeVisible();
    expect(await page.evaluate(() => document.activeElement.matches('[data-journey-panel="saved"] [data-journey-unsave]'))).toBe(true);
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - top)).toBeLessThan(2);
  });

  test('a journal entry is saved without losing the tab, and the title field is ready for the next one', async ({ page }) => {
    await page.goto('/journey/', { waitUntil: 'networkidle' });
    await page.locator('[data-journey-tab="journal"]').click();
    await page.locator('[data-journal-form] input[name="title"]').fill('Dusk at the river');
    await page.locator('[data-journal-form] button[type="submit"]').click();
    await expect(page.locator('.journal-note')).toContainText('Dusk at the river');
    await expect(page.locator('[data-journey-tab="journal"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-journey-tab="journal"]')).toHaveAttribute('tabindex', '0');
    await expect(page.locator('[data-journal-form] input[name="title"]')).toBeFocused();
  });

  test('the journey tabs are one stop in the tab order, and the arrow keys move along them', async ({ page }) => {
    await page.goto('/journey/', { waitUntil: 'networkidle' });
    const tabs = page.locator('[data-journey-tab]');
    await tabs.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-journey-panel="saved"]')).toBeVisible();
    await page.keyboard.press('End');
    await expect(tabs.last()).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.first()).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(tabs.last()).toBeFocused();
  });
});

/* ── The route page works from the keyboard ───────────────────────── */

test.describe('the route page by keyboard', () => {
  test.beforeEach(async ({ page }) => { await page.addInitScript(withSpeech); });

  test('the section links are plain links in the tab order; following one goes there and marks it', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    const links = page.locator('nav[aria-label="Route sections"] a');
    await expect(links).toHaveCount(5);
    expect(await page.locator('.route-bar [role="tab"], .route-bar [role="tablist"], .route-bar [aria-controls]').count()).toBe(0);
    await links.first().focus();
    for (let index = 1; index < 5; index += 1) {
      await page.keyboard.press('Tab');
      await expect(links.nth(index)).toBeFocused();
    }
    await links.nth(3).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#section-terrain$/);
    await expect(links.nth(3)).toHaveAttribute('aria-current', 'location');
    await expect(page.locator('nav[aria-label="Route sections"] [aria-current]')).toHaveCount(1);
    await expect(page.locator('#section-terrain')).toBeInViewport();
  });

  test('a route with no stops has no link to a list of them', async ({ page }) => {
    await page.goto('/routes/mysore-palace-heritage-walk/');
    await expect(page.locator('nav[aria-label="Route sections"] a')).toHaveCount(4);
    for (const href of await page.locator('nav[aria-label="Route sections"] a').evaluateAll((links) => links.map((link) => link.getAttribute('href')))) {
      expect(await page.locator(href).count(), href).toBe(1);
    }
  });

  test('Enter on a stop\'s play button starts the audio and does not select the stop', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    await expect(page.locator('.stop-item.is-active')).toContainText('Virupaksha Temple');
    await page.locator('.stop-item-play[data-stop="2"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.listen-bar')).toContainText('Sasivekalu Ganesha');
    await expect(page.locator('.stop-item.is-active')).toContainText('Virupaksha Temple');
    await page.locator('.listen-close').click();
    await page.locator('.stop-item-play[data-stop="3"]').focus();
    await page.keyboard.press('Space');
    await expect(page.locator('.listen-bar')).toContainText('Hampi Bazaar');
  });

  test('the play button and the stop button are siblings, each its own control', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    expect(await page.locator('.stop-item button, .stop-item [role="button"], .stop-item [tabindex]').count()).toBe(0);
    await expect(page.locator('.stop-row')).toHaveCount(8);
    await page.locator('.stop-item[data-select-stop="4"]').focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('.stop-item-play[data-stop="4"]')).toBeFocused();
  });

  test('the keyboard stays on the listening bar\'s controls, and the bar is not rebuilt as the words go by', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    await page.locator('.stop-play').focus();
    await page.keyboard.press('Enter');
    const toggle = page.locator('.listen-bar [data-audio="toggle"]');
    await expect(toggle).toHaveAttribute('aria-label', 'Pause');

    await toggle.focus();
    await page.evaluate(() => {
      window.__bar = [...document.querySelector('.listen-bar').querySelectorAll('button, input, .listen-art, .listen-meta, .listen-meta *, .listen-controls, .listen-progress, .listen-time, .listen-aside')];
      window.__toggle = document.activeElement;
    });
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-label', 'Play');
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-label', 'Pause');
    await expect(toggle).toBeFocused();

    const rate = page.locator('.listen-bar [data-audio="rate"]');
    await rate.focus();
    await page.keyboard.press('Enter');
    await expect(rate).toHaveText('1.25x');
    await expect(rate).toBeFocused();

    await page.locator('[data-audio="forward"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-audio="forward"]')).toBeFocused();

    // Words being spoken move the progress and the clock, and replace nothing.
    const before = await page.locator('.listen-time').textContent();
    await page.evaluate(() => window.__spoken.onboundary({ charIndex: 600 }));
    await expect(page.locator('.listen-time')).not.toHaveText(before);
    expect(await page.evaluate(() => window.__bar.every((node) => node.isConnected) && window.__toggle === document.querySelector('[data-audio="toggle"]'))).toBe(true);
  });

  test('closing the bar from the keyboard returns to the button that opened it', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    await page.locator('.stop-play').focus();
    await page.keyboard.press('Enter');
    await page.locator('.listen-close').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.listen-bar')).toHaveCount(0);
    await expect(page.locator('.stop-play')).toBeFocused();
  });

  test('no focusable thing is nested in another, no ARIA points at nothing (axe)', async ({ page }) => {
    const rules = ['nested-interactive', 'aria-valid-attr-value', 'aria-valid-attr', 'aria-allowed-role', 'aria-allowed-attr', 'aria-required-children', 'aria-required-parent', 'landmark-unique', 'aria-roles'];
    const check = async (label) => {
      const { violations } = await new AxeBuilder({ page }).withRules(rules).analyze();
      expect(violations.map((item) => `${item.id}: ${item.nodes.map((node) => node.target.join(' ')).join(', ')}`), label).toEqual([]);
    };
    for (const path of ['/', '/routes/', '/routes/hampi-heritage-trail/', '/stories/stone-chariot-of-hampi/', '/creators/', '/journey/', '/about/']) {
      await page.goto(path);
      await expect(page.locator('h1')).toHaveCount(1);
      await check(path);
    }
    await page.goto('/routes/hampi-heritage-trail/');
    await page.locator('nav[aria-label="Route sections"] a').nth(2).click();
    await page.locator('.stop-play').click();
    await page.locator('[data-stop-tab="related"]').click();
    await check('a route page after using its links, its audio and its tabs');
  });
});

test.describe('the player\'s marks', () => {
  test.use({ deviceScaleFactor: 2 });
  test.beforeEach(async ({ page }) => { await page.addInitScript(withSpeech); });

  test('the pause mark is drawn: the player shows a mark whether it is playing or paused', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    await page.locator('.stop-play').click();
    const toggle = page.locator('.listen-bar [data-audio="toggle"]');
    // White pixels on the orange disc: a disc with no mark in it has none.
    const marks = async () => {
      const png = (await toggle.screenshot()).toString('base64');
      return page.evaluate(async (data) => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        const { data: pixels } = context.getImageData(0, 0, canvas.width, canvas.height);
        let white = 0;
        for (let at = 0; at < pixels.length; at += 4) if (pixels[at] > 235 && pixels[at + 1] > 235 && pixels[at + 2] > 235) white += 1;
        return white;
      }, png);
    };
    await expect(toggle).toHaveAttribute('aria-label', 'Pause');
    expect(await marks(), 'pause mark').toBeGreaterThan(60);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-label', 'Play');
    expect(await marks(), 'play mark').toBeGreaterThan(60);
  });
});

test.describe('sections and anchors clear what sticks to the top of the window', () => {
  const clears = (page) => page.evaluate(() => {
    const bottom = (node) => (node ? node.getBoundingClientRect().bottom : 0);
    const bar = document.querySelector('.route-bar');
    const tabs = document.querySelector('.route-tabs');
    const sticky = getComputedStyle(bar).display === 'contents' ? tabs : bar;
    const header = bottom(document.querySelector('.site-header'));
    // The bar only covers the page once it has stuck under the header.
    const stuck = sticky.getBoundingClientRect().top <= header + 1;
    return { header, bar: stuck ? bottom(sticky) : 0 };
  });

  for (const size of [{ width: 1440, height: 900 }, { width: 1024, height: 800 }, { width: 768, height: 1000 }, { width: 390, height: 844 }]) {
    test(`a route's section links land below the header and the bar at ${size.width} px`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto('/routes/hampi-heritage-trail/');
      await expect(page.locator('nav[aria-label="Route sections"] a')).toHaveCount(5);
      for (const tab of ['overview', 'stops', 'stories', 'terrain', 'map']) {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await page.locator(`[data-tab="${tab}"]`).click();
        await settled(page);
        const { header, bar } = await clears(page);
        const top = await page.locator(`#section-${tab}`).evaluate((node) => node.getBoundingClientRect().top);
        expect(top, `${tab}: top of the section`).toBeGreaterThanOrEqual(Math.max(header, bar) - 5);
      }
    });
  }

  for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`a story's contents link lands its heading below the header at ${size.width} px`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto('/stories/stone-chariot-of-hampi/');
      await page.locator('[data-toc="belief-and-symbolism"]').click();
      await settled(page);
      const { header, top } = await page.evaluate(() => ({
        header: document.querySelector('.site-header').getBoundingClientRect().bottom,
        top: document.querySelector('#belief-and-symbolism h2').getBoundingClientRect().top,
      }));
      expect(top).toBeGreaterThanOrEqual(header);
    });
  }

  test('a link in the sticky header takes the keyboard without the page moving', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    await page.evaluate(() => window.scrollTo({ top: 1500, behavior: 'instant' }));
    await page.locator('#nav-stories').focus();
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.scrollY)).toBe(1500);
    await page.locator('nav[aria-label="Route sections"] a').nth(2).focus();
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.scrollY)).toBe(1500);
  });

  test('with reduced motion asked for, a section link jumps rather than glides', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/routes/hampi-heritage-trail/');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
    await page.locator('[data-tab="terrain"]').click();
    const at = await page.evaluate(() => window.scrollY);
    expect(at).toBeGreaterThan(500);
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => window.scrollY)).toBe(at);
  });

  test('and with no such request, it glides', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('smooth');
  });
});

test.describe('history keeps where the visitor was', () => {
  test('Back from a route to the catalogue lands on the card that was opened', async ({ page }) => {
    await page.goto('/routes/');
    await expect(page.locator('.route-card').nth(8)).toBeAttached();
    const card = page.locator('.route-card').nth(8);
    // By keyboard: a mouse click makes the test driver scroll the page itself first.
    await card.focus();
    await settled(page);
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(500);
    await page.keyboard.press('Enter');
    await expect(page.locator('h1')).not.toContainText('Go where');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.goBack();
    await expect(page.locator('h1')).toContainText('Go where');
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThan(2);
    await page.goForward();
    await expect(page.locator('.route-card').first()).toBeAttached();
    await expect(page.locator('h1')).not.toContainText('Go where');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('Back from a story to a long route page returns to where it was read', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    await page.evaluate(() => window.scrollTo({ top: 1500, behavior: 'instant' }));
    await page.waitForTimeout(350);          // longer than the debounce that writes the position down while scrolling
    await page.locator('#nav-stories').focus();
    await settled(page);
    expect(await page.evaluate(() => window.scrollY)).toBe(1500);
    await page.keyboard.press('Enter');
    await expect(page.locator('h1')).toContainText('Listen closer.');
    await page.goBack();
    await expect(page.locator('#route-title')).toBeAttached();
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - 1500)).toBeLessThan(2);
  });

  test('a reload returns to where the page was', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' }));
    await page.waitForTimeout(350);
    await page.reload();
    await expect(page.locator('#map .leaflet-pane').first()).toBeAttached();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1200);
  });

  test('Back over an in-page jump returns to where the page was before it', async ({ page }) => {
    await page.goto('/stories/stone-chariot-of-hampi/', { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'instant' }));
    await page.waitForTimeout(350);
    await page.locator('.story-toc a').nth(3).click();
    await expect(page).toHaveURL(/#[a-z-]+$/);
    await settled(page);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(600);
    await page.goBack();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(400);
    expect(new URL(page.url()).hash).toBe('');
  });
});

/* ── Search, menu and landmarks ───────────────────────────────────── */

test.describe('search, menu and landmarks', () => {
  test('both search boxes show a ring when the keyboard is in them', async ({ page }) => {
    await page.goto('/routes/');
    for (const [input, wrapper] of [['#route-search', '.header-search'], ['#catalogue-query', '.catalogue-search']]) {
      await page.locator(input).focus();
      const ring = await page.locator(wrapper).evaluate((node) => { const style = getComputedStyle(node); return [style.outlineStyle, style.outlineWidth]; });
      expect(ring, wrapper).toEqual(['solid', '3px']);
    }
  });

  test('two search landmarks have two names', async ({ page }) => {
    await page.goto('/routes/');
    const names = await page.locator('[role="search"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
    expect(names).toEqual(['Site search', 'Search routes']);
  });

  test('only the count is announced while typing, and the list redraws once typing pauses', async ({ page }) => {
    await page.goto('/routes/');
    await expect(page.locator('.route-card').first()).toBeVisible();
    expect(await page.locator('.catalogue-results[aria-live], .catalogue-results [aria-live]').count()).toBe(0);
    await expect(page.locator('#catalogue-count')).toHaveAttribute('role', 'status');
    await page.evaluate(() => {
      window.__redraws = 0;
      new MutationObserver((records) => { window.__redraws += records.length; }).observe(document.querySelector('#catalogue-grid'), { childList: true });
    });
    await page.locator('#catalogue-query').pressSequentially('hampi', { delay: 20 });
    await expect(page.locator('.route-card')).toHaveCount(1);
    await expect(page.locator('#catalogue-count')).toHaveText('1 route');
    expect(await page.evaluate(() => window.__redraws)).toBeLessThanOrEqual(2);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: PHONE, isMobile: true, hasTouch: true });

    test('the menu button keeps one name, says what it opens, and Escape shuts it', async ({ page }) => {
      await page.goto('/about/');
      const toggle = page.locator('.menu-toggle');
      await expect(toggle).toHaveAttribute('aria-label', 'Menu');
      await expect(toggle).toHaveAttribute('aria-controls', 'primary-nav');
      await expect(page.locator('#primary-nav')).toBeHidden();
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(toggle).toHaveAttribute('aria-label', 'Menu');
      await expect(page.locator('#primary-nav')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('#primary-nav')).toBeHidden();
      await expect(toggle).toBeFocused();
      // And Escape with the menu shut does nothing to it.
      await page.keyboard.press('Escape');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });
  });
});

/* ── Layout ───────────────────────────────────────────────────────── */

test.describe('layout', () => {
  test('no element reaches past the window on any kind of page, measured by its own edge', async ({ page }) => {
    const paths = [...PAGE_TYPES.map((type) => type.path), '/no-such-place/'];
    for (const width of [360, 390, 768]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of paths) {
        await page.goto(path);
        await expect(page.locator('h1')).toHaveCount(1);
        // The shell clips overflow, so scrollWidth never shows it: ask each element where its edge is.
        // Something inside a box that scrolls or clips on purpose (the map, a row of filters) is meant to.
        const past = await page.evaluate(() => {
          const limit = window.innerWidth + 0.5;
          const clipped = (node) => {
            for (let parent = node.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
              if (parent.classList.contains('site-shell')) return false;
              if (getComputedStyle(parent).overflowX !== 'visible') return true;
            }
            return false;
          };
          return [...document.querySelectorAll('body *')].filter((node) => {
            const box = node.getBoundingClientRect();
            return box.width > 0 && box.height > 0 && box.right > limit && getComputedStyle(node).visibility !== 'hidden'
              && !node.closest('.skip-link, .sr-only') && !clipped(node);
          }).map((node) => `${node.tagName.toLowerCase()}.${String(node.className).split(' ')[0]} right=${Math.round(node.getBoundingClientRect().right)}`);
        });
        expect(past, `${path} at ${width} px`).toEqual([]);
      }
    }
  });

  for (const width of [1024, 1280, 1440, 1920]) {
    test(`the route photograph's credit and place are not under the facts card at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      for (const path of ['/routes/hampi-heritage-trail/', '/routes/thanjavur-living-heritage/', '/routes/marina-beach-trail/']) {
        await page.goto(path);
        await expect(page.locator('.route-hero-media .photo-credit')).toBeVisible();
        const covered = await page.evaluate(() => {
          const box = (selector) => document.querySelector(selector).getBoundingClientRect();
          const facts = box('.route-facts');
          const meets = (a) => a.left < facts.right && a.right > facts.left && a.top < facts.bottom && a.bottom > facts.top;
          const hero = box('.route-hero-media');
          const inside = (a) => a.top >= hero.top && a.bottom <= hero.bottom && a.left >= hero.left && a.right <= hero.right;
          return {
            credit: meets(box('.route-hero-media .photo-credit')), chip: meets(box('.route-hero-place')),
            creditInHero: inside(box('.route-hero-media .photo-credit')), chipInHero: inside(box('.route-hero-place')),
          };
        });
        expect(covered, `${path} at ${width} px`).toEqual({ credit: false, chip: false, creditInHero: true, chipInHero: true });
      }
    });
  }

  for (const size of [{ width: 1440, height: 844 }, { width: 390, height: 844 }]) {
    test(`the footer is at the bottom of the page, even a short one (${size.width} px)`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto('/no-such-place/');
      await expect(page.locator('h1')).toContainText('not');
      const { footer, view, height } = await page.evaluate(() => ({
        footer: document.querySelector('.site-footer').getBoundingClientRect().bottom + window.scrollY,
        view: window.innerHeight,
        height: document.documentElement.scrollHeight,
      }));
      expect(Math.round(footer), 'the footer ends where the page does, with no bare paper beneath it').toBe(height);
      if (size.width > 1000) expect(height, 'and a page this short does not scroll').toBe(view);
    });
  }

  test('the journal form is styled the same on a fresh load as after the studio has been visited', async ({ page }) => {
    const styles = () => page.evaluate(() => {
      const label = getComputedStyle(document.querySelector('.journal-form .field > span'));
      const input = getComputedStyle(document.querySelector('.journal-form .field input'));
      return { weight: label.fontWeight, size: label.fontSize, display: getComputedStyle(document.querySelector('.journal-form .field')).display, padding: input.paddingTop, radius: input.borderRadius };
    });
    await page.goto('/journey/');
    await page.locator('[data-journey-tab="journal"]').click();
    const fresh = await styles();
    expect(fresh.weight).toBe('600');
    expect(fresh.display).toBe('grid');
    await page.goto('/creators/');
    await page.locator('#nav-journey').click();
    await expect(page.locator('h1')).toContainText('My Journey');
    await page.locator('[data-journey-tab="journal"]').click();
    expect(await styles()).toEqual(fresh);
  });

  test('the note over the journey photograph reads against even a white sky', async ({ page }) => {
    await page.goto('/journey/');
    const { alpha, contrast } = await page.locator('.journey-hero-note').evaluate((node) => {
      const style = getComputedStyle(node);
      const [r, g, b, a = 1] = style.backgroundColor.match(/[\d.]+/g).map(Number);
      const text = style.color.match(/[\d.]+/g).map(Number);
      const light = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      const luminance = (rgb) => 0.2126 * light(rgb[0]) + 0.7152 * light(rgb[1]) + 0.0722 * light(rgb[2]);
      // The lightest ground there could be under it is white.
      const ground = [r, g, b].map((c) => 255 * (1 - a) + c * a);
      const [high, low] = [luminance(text), luminance(ground)].sort((x, y) => y - x);
      return { alpha: a, contrast: (high + 0.05) / (low + 0.05) };
    });
    expect(alpha).toBeGreaterThan(0.65);
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  });
});

/* ── Touch targets on a phone ─────────────────────────────────────── */

test.describe('touch targets on a phone', () => {
  test.use({ viewport: PHONE, isMobile: true, hasTouch: true });
  test.beforeEach(async ({ page }) => { await page.addInitScript(withSpeech); });

  /** Every shown element matching one of the selectors that is under 44 px either way. */
  const small = (page, selectors) => page.evaluate((list) => list.flatMap((selector) => [...document.querySelectorAll(selector)]
    .filter((node) => node.offsetParent !== null || getComputedStyle(node).position === 'fixed')
    .map((node) => ({ selector, box: node.getBoundingClientRect() }))
    .filter(({ box }) => box.width > 0 && (box.width < 43.5 || box.height < 43.5))
    .map(({ selector: name, box }) => `${name} ${Math.round(box.width)}x${Math.round(box.height)}`)), selectors);

  test('on a route page', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    await page.locator('.stop-play').click();
    expect(await small(page, [
      '.menu-toggle', '.site-footer nav a', '.site-footer .footer-brand', '.breadcrumb a', '.route-tabs a', '.stop-item', '.stop-item-play',
      '.stop-tabs button', '.stop-related button', '.map-control', '.route-bar-actions .button', '.route-card',
      '.listen-skip', '.listen-play', '.listen-close', '.listen-rate', '.icon-button', 'a.text-link', '.button',
    ])).toEqual([]);
  });

  /* Thumb reach: the primary actions sit below 55% of the viewport height (the lower, easy-to-reach part of the screen). */
  test('the primary actions on a route page are in thumb reach', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    const line = PHONE.height * 0.55;
    const tooHigh = async (selector) => {
      const tops = await page.evaluate((sel) => [...document.querySelectorAll(sel)]
        .filter((node) => node.offsetParent !== null || getComputedStyle(node).position === 'fixed')
        .map((node) => Math.round(node.getBoundingClientRect().top)), selector);
      expect(tops.length, `${selector} was found on the page`).toBeGreaterThan(0);
      return tops.filter((top) => top < line).map((top) => `${selector} at ${top}px`);
    };
    expect(await tooHigh('.route-bar-actions .button'), 'the walk actions bar').toEqual([]);
    await page.locator('.stop-play').click();
    expect(await tooHigh('.listen-play'), 'the listen toggle').toEqual([]);
    expect(await tooHigh('.listen-skip'), 'the listen skip buttons').toEqual([]);
  });

  test('on the catalogue, a story, the journey and the studio', async ({ page }) => {
    await page.goto('/routes/');
    expect(await small(page, ['.filter-chips button', '.catalogue-filters select', '.catalogue-filters .filter-check', '.route-card', '.site-footer nav a', '.icon-button', 'a.text-link', '.button'])).toEqual([]);
    await page.goto('/stories/stone-chariot-of-hampi/');
    expect(await small(page, ['.story-actions button', '.story-actions a', '.story-toc a', '.breadcrumb a', '.story-route-cta', '.icon-button', 'a.text-link', '.button'])).toEqual([]);
    await page.goto('/journey/');
    expect(await small(page, ['.journey-tabs button', '.breadcrumb a', '.button-sm', '.icon-button', 'a.text-link', '.button'])).toEqual([]);
    await page.goto('/creators/');
    expect(await small(page, ['.studio-nav button', '.studio-stop-list button', '.studio-actions .button', '.button-sm', '.icon-button', 'a.text-link', '.button'])).toEqual([]);
  });
});

/* ── What the UI says is true (UI strategy W0) ─────────────────────── */

test.describe('honest walk, listening and labels', () => {
  test.beforeEach(async ({ page }) => { await page.addInitScript(withSpeech); });

  test('listening from stop 1 plays the stop and records no walk and no listening at the tap', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    const start = page.locator('[data-action="start"]');
    await expect(start).toHaveAttribute('aria-label', 'Listen from stop 1');
    await expect(start).toContainText('Listen');
    await expect(page.locator('body')).not.toContainText('Start Walk');
    await start.click();
    await expect(page.locator('#site-notice')).toContainText('Playing stop 1 of 8');
    await expect(page.locator('.listen-bar')).toBeVisible();
    const stored = await journey(page);
    expect(stored.walks ?? [], 'no walk is recorded by listening').toEqual([]);
    expect(Object.keys(stored.listened ?? {}), 'no listening time is credited at the tap').toEqual([]);
  });

  test('listening time counts seconds that played, not the tap', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    await page.locator('[data-action="start"]').click();
    await page.waitForTimeout(2300);
    await page.evaluate(() => dispatchEvent(new Event('pagehide')));
    const listened = (await journey(page)).listened ?? {};
    const seconds = Object.values(listened).reduce((sum, value) => sum + value, 0);
    expect(seconds, 'a couple of seconds really played').toBeGreaterThanOrEqual(2);
    expect(seconds, 'and not the whole story at once').toBeLessThan(10);
  });

  test('Mark as walked is the only way a walk is recorded, shows in My Journey, and can be undone', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    const walked = page.locator('[data-action="walked"]');
    await expect(walked).toHaveAttribute('aria-pressed', 'false');
    await walked.click();
    await expect(walked).toHaveAttribute('aria-pressed', 'true');
    await expect(walked).toContainText('undo');
    expect((await journey(page)).walks).toHaveLength(1);

    await page.goto('/journey/');
    await expect(page.locator('.journey-stats')).toContainText('Routes completed');
    await expect(page.locator('.journey-stats li', { hasText: 'Routes completed' })).toContainText('1');

    await page.goto('/routes/hampi-heritage-trail/');
    await expect(page.locator('[data-action="walked"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-action="walked"]').click();
    await expect(page.locator('[data-action="walked"]')).toHaveAttribute('aria-pressed', 'false');
    expect((await journey(page)).walks).toEqual([]);
  });

  test('a route page names the language that exists and says the rest are planned', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    const facts = page.locator('.route-facts');
    await expect(facts).toContainText('English');
    await expect(facts).toContainText('Other languages are planned');
    await expect(facts).not.toContainText('5 languages');
  });

  test('the player says what is speaking, also on a phone, and My Journey counts minutes', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    await page.locator('[data-action="start"]').click();
    await expect(page.locator('.listen-source')).toHaveText('Read aloud by your device');
    await page.setViewportSize(PHONE);
    await expect(page.locator('.listen-source-inline')).toBeVisible();
    await expect(page.locator('.listen-source-inline')).toHaveText('Read by your device');
    await page.goto('/journey/');
    await expect(page.locator('.journey-stats')).toContainText('Minutes listened');
    await expect(page.locator('.journey-stats')).not.toContainText('Hours listened');
  });

  test('Creator Studio sections that are not built are disabled and say so', async ({ page }) => {
    await page.goto('/creators/');
    const nav = page.locator('.studio-nav');
    await expect(nav.locator('[aria-current="page"]')).toBeEnabled();
    for (const id of ['stories', 'routes', 'settings']) {
      await expect(nav.locator(`[data-studio-nav="${id}"]`)).toBeDisabled();
    }
    await expect(nav.locator('[data-studio-nav="stories"]')).toContainText('Coming later');
  });

  test('Creator Studio Profile section is enabled after sign-in', async ({ page }) => {
    await page.goto('/creators/?profile=1');
    const nav = page.locator('.studio-nav');
    await expect(nav.locator('[data-studio-nav="profile"]')).toBeEnabled();
    await expect(nav.locator('[data-studio-nav="profile"]')).toHaveText('Profile');
  });
});

/* ── The player while walking (UI strategy W1, first slice) ────────── */

test.describe('the player while walking', () => {
  test.beforeEach(async ({ page }) => { await page.addInitScript(withSpeech); });

  test('on a phone the player is one row, keeps the stop number in view and is not taller than it needs to be', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/routes/hampi-heritage-trail/');
    await page.locator('[data-action="start"]').click();
    const bar = page.locator('.listen-bar');
    await expect(bar).toBeVisible();
    const height = (await bar.boundingBox()).height;
    expect(height, 'player bar height (it was 118px when the close button wrapped)').toBeLessThanOrEqual(84);
    await expect(bar.locator('.listen-meta span').first()).toHaveText(/^Stop 1 of 8/);
    for (const control of ['[data-audio="back"]', '[data-audio="toggle"]', '[data-audio="forward"]', '[data-audio="close"]']) {
      const box = await bar.locator(control).boundingBox();
      expect(box.y, `${control} is on the bar's single row`).toBeLessThan((await bar.boundingBox()).y + height - 20);
    }
  });

  test('the player announces the stop and its playing state', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    await page.locator('[data-action="start"]').click();
    const status = page.locator('.listen-bar [role="status"]');
    await expect(status).toHaveText(/^Playing .+, stop 1 of 8\.$/);
    await page.locator('.listen-bar [data-audio="toggle"]').click();
    await expect(status).toHaveText(/^Paused: .+, stop 1 of 8\.$/);
  });

  test('the playing stop says Playing in words, its Listen button says Pause, and pressing it pauses', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    const first = page.locator('.stop-row').first();
    const listen = first.locator('[data-action="listen"]');
    await expect(listen).toHaveAttribute('aria-label', /^Listen to /);
    await expect(first.locator('.stop-playing-tag')).toBeHidden();

    await listen.click();
    await expect(listen).toHaveAttribute('aria-label', /^Pause /);
    await expect(first.locator('.stop-playing-tag')).toBeVisible();
    await expect(first.locator('.stop-playing-tag')).toHaveText('Playing');
    // Only the playing stop is marked.
    await expect(page.locator('.stop-playing-tag:visible')).toHaveCount(1);

    await listen.click();
    await expect(listen).toHaveAttribute('aria-label', /^Listen to /);
    await expect(first.locator('.stop-playing-tag')).toBeHidden();
    await expect(page.locator('.listen-bar [role="status"]')).toHaveText(/^Paused:/);
  });
});

/* ── Reachable and announced without a mouse (UI strategy W3) ──────── */

test.describe('keyboard and screen reader basics', () => {
  test.beforeEach(async ({ page }) => { await page.addInitScript(withSpeech); });

  test('Creator Studio: the audio file input can be reached with the keyboard and opens the file chooser', async ({ page }) => {
    await page.goto('/creators/');
    await page.locator('[data-studio-step="upload"]').click();
    const input = page.locator('#studio-audio');
    await input.focus();
    expect(await page.evaluate(() => document.activeElement?.id), 'the input takes focus').toBe('studio-audio');
    const ring = await page.locator('.studio-drop').evaluate((node) => getComputedStyle(node).outlineStyle);
    expect(ring, 'the drop zone shows a focus ring').not.toBe('none');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Space')]);
    expect(chooser.isMultiple()).toBe(false);
  });

  test('the edges of the catalogue search, filter select and filter chips, and the search placeholder, meet WCAG contrast', async ({ page }) => {
    await page.goto('/routes/');
    const result = await page.evaluate(() => {
      const parse = (css) => css.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const ratio = (a, b) => { const [hi, lo] = [lum(parse(a)), lum(parse(b))].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
      const ground = getComputedStyle(document.body).backgroundColor;
      const edge = (node) => ratio(getComputedStyle(node).borderTopColor, ground);
      const search = document.querySelector('.catalogue-search');
      const input = search.querySelector('input');
      return {
        search: edge(search),
        select: edge(document.querySelector('.catalogue-filters select')),
        chip: edge(document.querySelector('.filter-chips button:not(.is-active)')),
        placeholder: ratio(getComputedStyle(input, '::placeholder').color, getComputedStyle(search).backgroundColor),
      };
    });
    expect(result.search, 'search box edge, non-text contrast').toBeGreaterThanOrEqual(3);
    expect(result.select, 'filter select edge').toBeGreaterThanOrEqual(3);
    expect(result.chip, 'inactive filter chip edge').toBeGreaterThanOrEqual(3);
    expect(result.placeholder, 'search placeholder text').toBeGreaterThanOrEqual(4.5);
  });

  test('changing the stop updates one short status line instead of re-reading the story', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    const status = page.locator('[data-stop-status]');
    await expect(status).toHaveAttribute('role', 'status');
    await expect(page.locator('.stop-panel')).not.toHaveAttribute('aria-live', /./);
    await page.locator('.stop-item').nth(2).click();
    await expect(status).toHaveText(/^Stop 3 of 8: .+/);
    await page.locator('.stop-item').nth(4).click();
    await expect(status).toHaveText(/^Stop 5 of 8: .+/);
  });

  test('the player sits before the footer in the page, and Escape closes it and returns focus to the Listen button', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    const listen = page.locator('.stop-row').first().locator('[data-action="listen"]');
    await listen.focus();
    await page.keyboard.press('Enter');
    const bar = page.locator('.listen-bar');
    await expect(bar).toBeVisible();
    const before = await page.evaluate(() => {
      const player = document.querySelector('.listen-bar');
      const footer = document.querySelector('.site-footer');
      return Boolean(player.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(before, 'the player comes before the footer in document order').toBe(true);

    await bar.locator('[data-audio="toggle"]').focus();
    await page.keyboard.press('Escape');
    await expect(bar).toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-action')), 'focus returns to the Listen button').toBe('listen');
  });

  test('map markers: each stop marker is named with its number and is selected by the keyboard', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    const markers = page.locator('.leaflet-marker-icon:has(.nr-map-stop-marker)');
    await expect(markers).toHaveCount(8);
    await expect(markers.nth(2)).toHaveAttribute('aria-label', /^Stop 3: /);
    const name = ((await markers.nth(2).getAttribute('aria-label')) || '').replace(/^Stop 3: /, '');

    await markers.nth(2).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.stop-item.is-active')).toContainText(name);
    await expect(markers.nth(2)).toHaveAttribute('aria-pressed', 'true');
    await expect(markers.nth(0)).toHaveAttribute('aria-pressed', 'false');

    await markers.nth(4).focus();
    await page.keyboard.press('Space');
    await expect(markers.nth(4)).toHaveAttribute('aria-pressed', 'true');
    await expect(markers.nth(2)).toHaveAttribute('aria-pressed', 'false');
  });
});

/* ── The phone's screen is not eaten by bars (UI strategy W2) ───────── */

test.describe('phone chrome budget', () => {
  test.use({ viewport: PHONE, isMobile: true, hasTouch: true });
  test.beforeEach(async ({ page }) => { await page.addInitScript(withSpeech); });

  /* Height taken by everything that stays on screen while scrolling: sticky and fixed elements, measured where they sit. */
  const stuck = (page) => page.evaluate(() => {
    const out = [];
    for (const node of document.querySelectorAll('body *')) {
      const style = getComputedStyle(node);
      if (!['sticky', 'fixed'].includes(style.position) || style.display === 'none' || style.visibility === 'hidden') continue;
      const box = node.getBoundingClientRect();
      // Only bars that span the screen count; map controls and the toast do not.
      if (box.width < innerWidth * 0.9 || box.height < 20 || box.height > innerHeight * 0.5) continue;
      if (box.bottom < 0 || box.top > innerHeight) continue;
      out.push({ name: `${node.tagName.toLowerCase()}.${String(node.className).split(' ')[0]}`, height: Math.round(box.height) });
    }
    return out;
  });

  test('the route section tabs are one row, not two', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    const tabs = page.locator('.route-tabs');
    const box = await tabs.boundingBox();
    expect(box.height, 'tab row height (it wrapped to 106px)').toBeLessThanOrEqual(60);
    const row = await tabs.evaluate((node) => ({ scrolls: node.scrollWidth > node.clientWidth, wraps: getComputedStyle(node).flexWrap }));
    expect(row.wraps).toBe('nowrap');
    // The links still all exist and the row can be scrolled to reach the last one.
    await tabs.locator('a').last().scrollIntoViewIfNeeded();
    await expect(tabs.locator('a').last()).toBeVisible();
  });

  test('with the player open, the action bar steps aside and the bars use a quarter of the screen or less', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    await page.evaluate(() => scrollTo(0, 700));
    const before = await stuck(page);
    expect(before.some((bar) => bar.name.includes('route-bar-actions')), 'the action bar is there before playing').toBe(true);

    await page.locator('[data-action="start"]').click();
    await expect(page.locator('.listen-bar')).toBeVisible();
    await expect(page.locator('.route-bar-actions')).toBeHidden();
    const bars = await stuck(page);
    const total = bars.reduce((sum, bar) => sum + bar.height, 0);
    expect(total, `sticky and fixed bars (${JSON.stringify(bars)}) against ${PHONE.height}px`).toBeLessThanOrEqual(PHONE.height * 0.25);

    // Closing the player brings the actions back.
    await page.locator('.listen-bar [data-audio="close"]').click();
    await expect(page.locator('.route-bar-actions')).toBeVisible();
  });

  test('the home page headline and main button are on the first screen of a small phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    const heading = await page.locator('.home-hero-copy h1').boundingBox();
    const cta = await page.locator('.home-hero-cta').boundingBox();
    expect(heading.y, 'headline starts on the first screen').toBeLessThan(667 * 0.75);
    expect(cta.y + cta.height, 'the main button ends within the first screen').toBeLessThanOrEqual(667);
  });
});

/* ── Tabs, headings and language marks (UI strategy W3) ──────────────── */

test.describe('tabs, heading names and language marks', () => {
  test('the stop detail tabs are a real tab list: one tab stop, arrows, Home and End, linked panels', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    const tabs = page.locator('.stop-tabs [role="tab"]');
    await expect(tabs).toHaveCount(3);
    for (let i = 0; i < 3; i += 1) {
      const id = await tabs.nth(i).getAttribute('aria-controls');
      const panel = page.locator(`#${id}`);
      await expect(panel).toHaveAttribute('role', 'tabpanel');
      await expect(panel).toHaveAttribute('aria-labelledby', (await tabs.nth(i).getAttribute('id')) || '');
    }
    // Only the selected tab is in the tab order.
    expect(await tabs.evaluateAll((nodes) => nodes.map((node) => node.tabIndex))).toEqual([0, -1, -1]);

    await tabs.nth(0).focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.nth(1)).toBeFocused();
    await expect(page.locator('#stop-panel-place')).toBeVisible();
    await expect(page.locator('#stop-panel-transcript')).toBeHidden();
    expect(await tabs.evaluateAll((nodes) => nodes.map((node) => node.tabIndex))).toEqual([-1, 0, -1]);

    await page.keyboard.press('End');
    await expect(tabs.nth(2)).toBeFocused();
    await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowRight');                 // wraps to the first
    await expect(tabs.nth(0)).toBeFocused();
    await page.keyboard.press('ArrowLeft');                  // and back to the last
    await expect(tabs.nth(2)).toBeFocused();
    await page.keyboard.press('Home');
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#stop-panel-transcript')).toBeVisible();
  });

  test('the Journey tabs are linked to their panels', async ({ page }) => {
    await page.goto('/journey/');
    const tabs = page.locator('.journey-tabs [role="tab"]');
    const count = await tabs.count();
    expect(count).toBe(5);
    for (let i = 0; i < count; i += 1) {
      const id = await tabs.nth(i).getAttribute('aria-controls');
      const panel = page.locator(`#${id}`);
      await expect(panel).toHaveAttribute('role', 'tabpanel');
      await expect(panel).toHaveAttribute('aria-labelledby', (await tabs.nth(i).getAttribute('id')) || '');
    }
  });

  test('a heading broken over two lines reads as separate sentences, not run together', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('Walk a place. Hear its story.');
    await page.goto('/journey/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('My Journey More than places.');
  });

  test('Creator Studio language names carry their language, so a screen reader pronounces them', async ({ page }) => {
    await page.goto('/creators/');
    const hindi = page.locator('select option[value="hi"]').first();
    await expect(hindi).toHaveAttribute('lang', 'hi');
    await expect(page.locator('select option[value="ta"]').first()).toHaveAttribute('lang', 'ta');
    await expect(page.locator('[data-studio-language="kn"] + span')).toHaveAttribute('lang', 'kn');
  });
});

/* ── A phone held sideways (roadmap 201) ──────────────────────────── */

test.describe('phone in landscape', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  test('the route map fits one screen, its controls are inside it, the header scrolls away and nothing overflows', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    await expect(page.locator('#map .leaflet-container, #map.leaflet-container').first()).toBeVisible();
    const found = await page.evaluate(() => {
      const frame = document.querySelector('.map-frame').getBoundingClientRect();
      const controls = document.querySelector('.map-controls').getBoundingClientRect();
      return {
        frameHeight: Math.round(frame.height), viewport: innerHeight,
        controlsInside: controls.top >= frame.top && controls.bottom <= frame.bottom,
        header: getComputedStyle(document.querySelector('.site-header')).position,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(found.frameHeight, 'map height against a 390px-tall screen').toBeLessThanOrEqual(found.viewport);
    expect(found.controlsInside, 'map controls inside the map').toBe(true);
    expect(found.header).toBe('static');
    expect(found.overflow, 'horizontal overflow').toBe(false);
  });
});

/* ── The map layer is remembered; a blocked tile host is told plainly ─ */

test.describe('map layer and tiles', () => {
  const layersButton = (page) => page.locator('[data-map="layers"]');

  test('satellite is the first-visit layer and the chosen layer survives a reload', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    await expect(page.locator('#map')).toHaveAttribute('data-map-layer', 'satellite');
    await layersButton(page).click();
    await expect(page.locator('#map')).toHaveAttribute('data-map-layer', 'street');
    await expect(layersButton(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(layersButton(page)).toContainText('Street');

    await page.reload();
    await expect(page.locator('#map')).toHaveAttribute('data-map-layer', 'street');
    await expect(layersButton(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(layersButton(page)).toContainText('Street');

    await layersButton(page).click();
    await page.reload();
    await expect(page.locator('#map')).toHaveAttribute('data-map-layer', 'satellite');
    await expect(layersButton(page)).toHaveAttribute('aria-pressed', 'true');
  });

  test('with storage blocked the map still renders the default and the layer still switches for the visit', async ({ page }) => {
    await page.addInitScript(() => {
      const blocked = () => { throw new DOMException('blocked', 'SecurityError'); };
      Object.defineProperty(window, 'localStorage', { get: blocked });
    });
    await page.goto('/routes/hampi-heritage-trail/');
    await expect(page.locator('#map')).toHaveAttribute('data-map-layer', 'satellite');
    await layersButton(page).click();
    await expect(page.locator('#map')).toHaveAttribute('data-map-layer', 'street');
  });

  test('with the tile host blocked, the map says so and the stop list still works', async ({ page }) => {
    await page.route(/tile\.openstreetmap\.org|server\.arcgisonline\.com/, (route) => route.abort());
    await page.goto('/routes/hampi-heritage-trail/');
    await expect(page.locator('.nr-map-status')).toContainText('Map imagery could not be loaded');
    await expect(page.locator('.nr-map-status button')).toHaveText('Retry');
    await expect(page.locator('.stop-item').first()).toBeVisible();
    await page.locator('.stop-item').nth(1).click();
    await expect(page).toHaveURL(/\/routes\/hampi-heritage-trail\/.*stop=2|\/routes\/hampi-heritage-trail\/2\/?/);
  });
});

/* ── What the browser's storage holds is not trusted ──────────────── */

test.describe('storage of the wrong shape', () => {
  const cases = [
    ['naarad.journey.v1', '{"saved":"x"}'],
    ['naarad.journey.v1', '{"journal":null,"walks":5,"listened":[1]}'],
    ['naarad.journey.v1', 'null'],
    ['naarad.studio.v1', 'null'],
    ['naarad.studio.v1', '{"drafts":"x","currentId":4}'],
    ['naarad.studio.v1', '{"drafts":[null,{"id":"d1","targetLanguages":"en","stopOrder":"x"}],"currentId":"d1"}'],
  ];
  for (const [key, value] of cases) {
    test(`${key} = ${value} does not stop a page being drawn`, async ({ page }) => {
      await page.addInitScript(([name, text]) => localStorage.setItem(name, text), [key, value]);
      await noPageErrors(page, async () => {
        for (const path of ['/routes/hampi-heritage-trail/', '/journey/', '/creators/']) {
          await page.goto(path, { waitUntil: 'networkidle' });
          await expect(page.locator('h1')).toHaveCount(1);
          await expect(page.locator('.load-error')).toHaveCount(0);
        }
        await page.locator('#nav-journey').click();
        await expect(page.locator('.journey-hero h1')).toBeVisible();
        await page.locator('#nav-creators').click();
        await expect(page.locator('.studio-steps li')).toHaveCount(5);
      });
    });
  }
});

test.describe('journey on the persisted store', () => {
  test('a journey saved in localStorage is moved to the device store and survives a reload', async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('naarad.journey.v1', JSON.stringify({ saved: [{ slug: 'hampi-heritage-trail', name: 'Moved Trail', location: 'Hampi' }] }));
    });
    await page.goto('/journey/', { waitUntil: 'networkidle' });
    await expect(page.locator('.journey-panel[data-journey-panel="journey"]')).toContainText('Moved Trail');
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('.journey-panel[data-journey-panel="journey"]')).toContainText('Moved Trail');
    expect(await page.evaluate(() => localStorage.getItem('naarad.journey.v1'))).toBeNull();
    await expect(page.locator('.journey-unsaved')).toHaveCount(0);
  });

  test('when no storage opens, the journey says it is not being saved', async ({ page }) => {
    await page.addInitScript(() => {
      indexedDB.open = () => { throw new Error('blocked'); };
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
    });
    await page.goto('/journey/', { waitUntil: 'networkidle' });
    await expect(page.locator('.journey-unsaved')).toHaveText('Your journey is not being saved on this device. It will be kept until you close this tab.');
  });
});

/* ── The service worker ───────────────────────────────────────────── */

test.describe('service worker', () => {
  test.use({ serviceWorkers: 'allow' });

  test('a visited page reloads offline, and the shell draws one that was never visited', async ({ page, context }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await page.goto('/stories/');
    await page.goto('/routes/hampi-heritage-trail/');
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#route-title')).toHaveText('Hampi Heritage Trail');
    await page.goto('/about/');
    await expect(page.locator('h1')).toContainText('Explore.');
    await context.setOffline(false);
  });

  test('a page reloads once when a new worker takes over, but not for the first worker it gets', async ({ page }) => {
    await page.goto('/about/');
    await page.evaluate(() => { window.__sameDocument = true; });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));      // the first claim
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__sameDocument)).toBe(true);

    await page.reload();                                                                // now controlled at load
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await page.evaluate(() => { window.__sameDocument = true; });
    const reloaded = page.waitForEvent('load');
    await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange')));
    await reloaded;
    expect(await page.evaluate(() => window.__sameDocument)).toBeUndefined();
    await expect(page.locator('h1')).toContainText('Explore.');
  });

  test('what the old worker left behind is cleared once, and the page loads again', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.evaluate(async () => {
      await (await caches.open('naarad-shell-v10')).put('/app/main.js', new Response('old code'));
      await (await caches.open('naarad-content-v10')).put('/content/routes.json', new Response('{}'));
      window.__sameDocument = true;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(async () => (await caches.keys()).filter((name) => /-v1[01]$/.test(name)))).toEqual([]);
    await expect(page.locator('#route-title')).toHaveText('Hampi Heritage Trail');
    expect(await page.evaluate(() => window.__sameDocument)).toBeUndefined();
  });
});

 test.describe("route workspace release", () => {
  test('fullscreen map moves the same map and stop list, then restores focus and scroll', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    const open = page.locator('[data-map="fullscreen"]');
    await open.scrollIntoViewIfNeeded();
    await expect(open).toBeEnabled();
    const smallControls = await page.locator('.map-control').evaluateAll((buttons) => buttons
      .filter((button) => { const bounds = button.getBoundingClientRect(); return bounds.width < 44 || bounds.height < 44; })
      .map((button) => button.dataset.map));
    expect(smallControls, 'route map controls meet the 44px target at desktop').toEqual([]);
    await open.focus();
    const before = await page.evaluate(() => window.scrollY);
    await page.evaluate((scrollY) => { window.__routeWorkspaceScroll = scrollY; }, before);
    await open.press('Enter');
    const dialog = page.locator('[data-route-map-dialog]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-map-dialog-close]')).toBeFocused();
    await expect(dialog.locator('[data-map="fullscreen"]')).toBeHidden();
    const closeBounds = await dialog.locator('[data-map-dialog-close]').boundingBox();
    expect(closeBounds.width).toBeGreaterThanOrEqual(44);
    expect(closeBounds.height).toBeGreaterThanOrEqual(44);
    await expect(dialog.locator('.stop-item')).toHaveCount(8);
    await expect(dialog.locator('[data-map="fit"]')).toBeVisible();
    await dialog.locator('[data-map="fit"]').click();
    const layers = dialog.locator('[data-map="layers"]');
    await layers.click();
    await expect(layers).toContainText('Street');
    expect(await page.locator('.leaflet-container').count()).toBe(1);
    await dialog.locator('.stop-item', { hasText: 'Hampi Bazaar' }).click();
    await expect(page.locator('.stop-title')).toHaveText('Hampi Bazaar');
    await expect(dialog.locator('.stop-item.is-active')).toContainText('Hampi Bazaar');
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(open).toBeFocused();
    await expect(page.locator('.stop-item.is-active')).toContainText('Hampi Bazaar');
    expect(await page.evaluate(() => Math.abs(window.scrollY - window.__routeWorkspaceScroll))).toBeLessThan(3);
    expect(await page.locator('.leaflet-container').count()).toBe(1);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(before - 2);
    for (let cycle = 0; cycle < 2; cycle += 1) {
      await open.press('Enter');
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('[data-map-dialog-close]')).toBeFocused();
      expect(await page.locator('.leaflet-container').count()).toBe(1);
      await dialog.locator('[data-map-dialog-close]').click();
      await expect(dialog).not.toBeVisible();
      await expect(open).toBeFocused();
    }
  });

  for (const size of [{ width: 390, height: 844 }, { width: 430, height: 932 }, { width: 768, height: 1024 }, DESKTOP]) {
    test(`route map workspace fits and opens at ${size.width}px`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto('/routes/hampi-heritage-trail/');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (size.width > 1240) {
        await expect(page.locator('.map-panel')).toHaveCSS('position', 'sticky');
        const bounds = await page.locator('.map-frame').boundingBox();
        expect(bounds.height).toBeLessThanOrEqual(size.height);
      }
      await page.locator('[data-map="fullscreen"]').click();
      const dialog = page.locator('[data-route-map-dialog]');
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('.stop-item')).toHaveCount(8);
      expect(await page.locator('.leaflet-container').count()).toBe(1);
      await dialog.locator('[data-map-dialog-close]').click();
      await expect(dialog).not.toBeVisible();
    });
  }


});

 test.describe("linked elevation release", () => {
  test('the elevation range and profile pointer place a cursor on the published route', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    const range = page.locator('[data-elevation-range]');
    const output = page.locator('[data-elevation-output]');
    await expect(range).toBeVisible();
    await expect(output).toContainText('km ·');
    await range.focus();
    await range.press('End');
    await expect(output).toContainText(/5\.2 km · \d+ m/);
    await expect.poll(async () => {
      const fraction = Number(await page.locator('.elevation-wrap').getAttribute('data-cursor'));
      return Math.abs(fraction * Number(await range.getAttribute('max')) - Number(await range.inputValue()));
    }).toBeLessThanOrEqual(1);
    await expect(page.locator('.elevation-readout')).toContainText('5.2 km');
    await expect(page.locator('.elevation-cursor')).toBeVisible();
    await expect(page.locator('#map .nr-map-elevation-cursor')).toHaveCount(1);
    await expect(page.locator('.leaflet-container')).toHaveCount(1);

    const profile = page.locator('.glance-elevation .elevation-svg');
    const box = await profile.boundingBox();
    await page.mouse.click(box.x + box.width, box.y + box.height / 2);
    const max = Number(await range.getAttribute('max'));
    const value = Number(await range.inputValue());
    expect(max - value).toBeLessThanOrEqual(Number(await range.getAttribute('step')));
    await expect(output).toContainText(/5\.2 km · \d+ m/);
    await expect(page.locator('#map .nr-map-elevation-cursor')).toHaveCount(1);
  });


});

test('linked elevation retains the inspected distance after pointer exit and keyboard refocus', async ({ page }) => {
  await page.goto('/routes/hampi-heritage-trail/');
  await expect(page.locator('[data-elevation-output]')).toContainText('km ·');
  const profile = page.locator('.glance-elevation .elevation-svg');
  await profile.hover();
  const wrap = page.locator('.elevation-wrap');
  const selected = await wrap.getAttribute('data-cursor');
  expect(Number(selected)).toBeGreaterThan(0);
  await page.mouse.move(0, 0);
  await expect(wrap).toHaveAttribute('data-cursor', selected);
  await wrap.focus();
  await expect(wrap).toHaveAttribute('data-cursor', selected);
  await expect(page.locator('.elevation-cursor')).toBeVisible();
});

test.describe('the stop-photo scrubber on a route page', () => {
  for (const size of [{ width: 1440, height: 900 }, { width: 768, height: 1000 }, { width: 390, height: 844 }]) {
    test(`the arrow keys move the photograph, the stop and the status line together at ${size.width} px`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto('/routes/hampi-heritage-trail/');
      const range = page.locator('[data-scrubber]');
      await expect(range).toHaveCount(1);
      const frames = page.locator('.scrubber-frame');
      expect(await frames.count()).toBeGreaterThan(1);
      await expect(page.locator('.scrubber-frame:not([hidden])')).toHaveCount(1);
      const before = await page.locator('.stop-title').first().textContent();
      await range.focus();
      await page.keyboard.press('ArrowRight');
      await expect(range).toHaveJSProperty('value', '2');
      await expect(page.locator('[data-stop-status]')).toContainText(/^Stop 2 of/);
      await expect(page.locator('.stop-title').first()).not.toHaveText(before.trim());
      await expect(page.locator('.scrubber-frame:not([hidden])')).toHaveCount(1);
      await expect(range).toHaveAttribute('aria-valuetext', /^Stop 2 of \d+: /);
      // Choosing a stop in the rail moves the scrubber back.
      await page.locator('.stop-item[data-select-stop="1"]').first().click();
      await expect(range).toHaveJSProperty('value', '1');
    });
  }
});

test.describe('the photo mosaic on a route page', () => {
  test('a tile opens the lightbox on its own set of photographs', async ({ page }) => {
    await page.goto('/routes/hampi-heritage-trail/');
    const tiles = page.locator('.route-mosaic .mosaic-tile');
    expect(await tiles.count()).toBeGreaterThan(0);
    await tiles.first().click();
    await expect(page.locator('html.has-lightbox')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('html.has-lightbox')).toHaveCount(0);
  });
});

test.describe('the routes page opens on the map', () => {
  for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`the map fills the first screen and the route cards take no more than 15% of it at ${size.width} px`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto('/routes/');
      await expect(page.locator('.leaflet-container')).toHaveCount(1);
      const header = await page.locator('.site-header').evaluate((node) => node.getBoundingClientRect().bottom);
      const atlas = await page.locator('.atlas').boundingBox();
      const map = await page.locator('.atlas-map').boundingBox();
      const strip = await page.locator('.atlas-slider').boundingBox();
      expect(atlas.y).toBeLessThanOrEqual(header + 2);
      expect(atlas.height, 'the stage fills the screen under the header').toBeGreaterThanOrEqual(size.height - header - 4);
      expect(map.width, 'the map is the background').toBeGreaterThanOrEqual(atlas.width - 2);
      expect(map.height).toBeGreaterThanOrEqual(atlas.height - 2);
      expect(strip.height, 'the cards').toBeLessThanOrEqual(atlas.height * 0.15 + 1);
      expect(strip.y + strip.height).toBeLessThanOrEqual(atlas.y + atlas.height + 1);
    });
  }

  test('swiping the cards zooms the map to the route on the centred card', async ({ page }) => {
    await page.goto('/routes/');
    await expect(page.locator('.leaflet-tile').first()).toBeAttached();
    const zoom = () => page.evaluate(() => {
      const tile = [...document.querySelectorAll('.leaflet-tile-container img.leaflet-tile')].find((img) => /\/(\d+)\/\d+\/\d+\.png/.test(img.src));
      return tile ? Number(tile.src.match(/\/(\d+)\/\d+\/\d+\.png/)[1]) : 0;
    });
    const before = await zoom();
    const slug = await page.evaluate(() => {
      const strip = document.querySelector('.atlas-slider');
      const slide = strip.querySelectorAll('.atlas-slide')[2];
      strip.scrollTo({ left: slide.offsetLeft - (strip.clientWidth - slide.offsetWidth) / 2, behavior: 'instant' });
      return slide.querySelector('.atlas-card').dataset.slug;
    });
    await expect(page.locator('.atlas-card.is-current')).toHaveAttribute('data-slug', slug);
    await expect.poll(zoom, { timeout: 8000 }).toBeGreaterThan(before + 2);
    // Swiping on to the next card moves the highlight and the map with it.
    const next = await page.evaluate(() => {
      const strip = document.querySelector('.atlas-slider');
      const slide = strip.querySelectorAll('.atlas-slide')[3];
      strip.scrollTo({ left: slide.offsetLeft - (strip.clientWidth - slide.offsetWidth) / 2, behavior: 'instant' });
      return slide.querySelector('.atlas-card').dataset.slug;
    });
    await expect(page.locator('.atlas-card.is-current')).toHaveAttribute('data-slug', next);
    await expect(page.locator('.atlas-card.is-current')).toHaveCount(1);
  });

  test('a card opens its route', async ({ page }) => {
    await page.goto('/routes/');
    await page.locator('.atlas-card').first().click();
    await expect(page).toHaveURL(/\/routes\/[a-z0-9-]+\/$/);
  });
});

test.describe('the maps start from a keyless tile source', () => {
  for (const path of ['/routes/', '/routes/hampi-heritage-trail/']) {
    test(`${path} asks OpenStreetMap for its street tiles and nothing that needs an API key`, async ({ page }) => {
      const hosts = new Set();
      page.on('request', (request) => { const host = new URL(request.url()).host; if (/tile\.openstreetmap\.org|arcgisonline\.com|cartocdn\.com/.test(host)) hosts.add(host); });
      await page.goto(path);
      await expect(page.locator('.leaflet-tile').first()).toBeAttached();
      expect([...hosts].some((host) => /(^|\.)tile\.openstreetmap\.org$|server\.arcgisonline\.com$/.test(host))).toBe(true);
      expect([...hosts].some((host) => /cartocdn/.test(host))).toBe(false);
    });
  }
});
