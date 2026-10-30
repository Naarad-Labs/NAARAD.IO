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
    expect(locs).not.toContain(`${ORIGIN}/explore/`);       // canonical to /routes/
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
    expect(await description('/explore/')).toBe(await description('/routes/'));
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
        expect(top, `${tab}: top of the section`).toBeGreaterThanOrEqual(Math.max(header, bar) - 1);
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
      '.listen-skip', '.listen-play', '.listen-close',
    ])).toEqual([]);
  });

  test('on the catalogue, a story, the journey and the studio', async ({ page }) => {
    await page.goto('/routes/');
    expect(await small(page, ['.filter-chips button', '.catalogue-filters select', '.catalogue-filters .filter-check', '.route-card', '.site-footer nav a'])).toEqual([]);
    await page.goto('/stories/stone-chariot-of-hampi/');
    expect(await small(page, ['.story-actions button', '.story-actions a', '.story-toc a', '.breadcrumb a', '.story-route-cta'])).toEqual([]);
    await page.goto('/journey/');
    expect(await small(page, ['.journey-tabs button', '.breadcrumb a', '.button-sm'])).toEqual([]);
    await page.goto('/creators/');
    expect(await small(page, ['.studio-nav button', '.studio-stop-list button', '.studio-actions .button', '.button-sm'])).toEqual([]);
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
