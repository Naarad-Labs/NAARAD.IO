// End-to-end checks for the Naarad atlas: the desktop compositions, the phone
// compositions, the data the pages claim, the things that are honestly
// absent, and what search engines and link previews read: clean addresses,
// canonicals, structured data and the pre-rendered pages.
// Run with: cd e2e && npm install && npm test (after node scripts/build-site.mjs)
const { test, expect } = require('@playwright/test');

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

  test('the route page leads with the map and keeps Start Walk in reach', async ({ page }) => {
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
  { path: '/explore/', canonical: '/routes/', h1: 'Go where', text: 'Hampi Heritage Trail', types: ['BreadcrumbList'] },
  { path: '/routes/hampi-heritage-trail/', canonical: '/routes/hampi-heritage-trail/', h1: 'Hampi Heritage Trail', text: 'Virupaksha Temple', types: ['BreadcrumbList', 'TouristTrip'] },
  { path: '/routes/marina-beach-trail/', canonical: '/routes/marina-beach-trail/', h1: 'Marina Beach Trail', text: 'Stops are not published', types: ['BreadcrumbList', 'TouristTrip'] },
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

    // A route with no published stops claims none.
    const plain = structuredData(await (await request.get('/routes/mysore-palace-heritage-walk/')).text())[0]['@graph'];
    expect(plain.find((node) => node['@type'] === 'TouristTrip').itinerary).toBeUndefined();

    const story = structuredData(await (await request.get('/stories/bazaar-that-sold-the-world/')).text())[0]['@graph'];
    const article = story.find((node) => node['@type'] === 'Article');
    expect(article.author).toMatchObject({ '@type': 'Organization', name: 'Naarad editorial' });
    expect(article.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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
    expect(locs.length).toBeGreaterThan(20);
    expect(locs).toContain(`${ORIGIN}/`);
    expect(locs).toContain(`${ORIGIN}/routes/hampi-heritage-trail/`);
    expect(locs).toContain(`${ORIGIN}/stories/stone-chariot-of-hampi/`);
    expect(locs).not.toContain(`${ORIGIN}/explore/`);       // canonical to /routes/
    expect(xml).not.toMatch(/changefreq|priority/);
    for (const loc of locs) {
      expect(loc).toMatch(/^https:\/\/naarad\.io\/([a-z0-9-]+\/)*$/);
      const response = await request.get(loc.replace(ORIGIN, ''));
      expect(response.status(), loc).toBe(200);
      const html = await response.text();
      expect(html, `canonical of ${loc}`).toContain(`<link rel="canonical" href="${loc}"`);
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
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('naarad.journey.v1') || '{"downloads":[]}').downloads.length)).toBe(0);
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
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('naarad.journey.v1') || '{"downloads":[]}').downloads.length)).toBe(0);
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
