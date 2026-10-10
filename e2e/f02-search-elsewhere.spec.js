// F02 Search somewhere else. Cases are in replica/test-plan.md.
const { test, expect, root, statusOf, articles, placeField, ready, openFilters, goDiscover, DESKTOP } = require('./fixtures');

const slider = (page, name) => root(page).getByRole('slider', { name });
const search = async (page, text) => { await placeField(page).fill(text); await placeField(page).press('Enter'); };

test.describe('F02 search somewhere else', () => {
  test.use({ viewport: DESKTOP.size });

  test('F02-H1 one place, then another: results and status follow', async ({ page }) => {
    await goDiscover(page);
    await search(page, 'Chennai');
    await expect(statusOf(page)).toHaveText('10 routes within 30 km of Chennai, Tamil Nadu');
    await search(page, 'Mysuru');
    await expect(statusOf(page)).toContainText('of Mysuru, Karnataka');
    await expect(articles(page).filter({ hasText: 'Mysore Palace Heritage Walk' })).toHaveCount(1);
    await expect(articles(page).filter({ hasText: 'Marina Beach Trail' })).toHaveCount(0);
    expect(page.url()).toContain('lat=12.29');
  });

  test('F02-H2 changing the distance from the place changes what is found', async ({ page }) => {
    await goDiscover(page);
    await search(page, 'Chennai');
    const count = async () => parseInt((await statusOf(page).innerText()).split(' ')[0], 10);
    await expect(statusOf(page)).toContainText('within 30 km');
    const at30 = await count();
    await slider(page, 'Within').fill('100');
    await expect(statusOf(page)).toContainText('within 100 km');
    const at100 = await count();
    await slider(page, 'Within').fill('5');
    await expect(statusOf(page)).toContainText('within 5 km');
    const at5 = await count();
    expect(at100, 'a wider search finds more').toBeGreaterThan(at30);
    expect(at5, 'a narrower search finds fewer').toBeLessThan(at30);
  });

  test('F02-E1 searching the same place twice changes nothing', async ({ page }) => {
    await goDiscover(page);
    await search(page, 'Chennai');
    await expect(statusOf(page)).toContainText('of Chennai');
    await expect(articles(page)).toHaveCount(10);
    const first = await articles(page).allInnerTexts();
    await search(page, 'Chennai');
    await ready(page);
    await expect(articles(page)).toHaveCount(10);
    expect(await articles(page).allInnerTexts()).toEqual(first);
  });

  test('F02-E2 a not-found message goes away once a valid place is searched', async ({ page }) => {
    await goDiscover(page);
    await search(page, 'Zzxqv');
    await expect(page.getByText(/could not find that place/)).toBeVisible();
    await search(page, 'Chennai');
    await expect(statusOf(page)).toContainText('of Chennai');
    await expect(page.getByText(/could not find that place/)).toBeHidden();
    await expect(placeField(page)).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('F02-E3 a place with nothing near it: the empty state names the distance, and Show all of India recovers', async ({ page }) => {
    await goDiscover(page);
    await search(page, 'Delhi');
    await expect(root(page).getByRole('heading', { name: 'No routes match' })).toBeVisible();
    await expect(root(page).locator('.nd-empty').getByText(/within 30 km of Delhi, Delhi/)).toBeVisible();
    await root(page).getByRole('button', { name: 'Show all of India' }).click();
    await expect(statusOf(page)).toHaveText('21 routes');
    await expect(placeField(page)).toHaveValue('');
  });

  test('F02-E4 a place near the pole does not break the map', async ({ page }) => {
    await goDiscover(page, '&lat=89&lng=0&r=200');
    await expect(statusOf(page)).toHaveText('0 routes within 200 km of your place');
    await expect(root(page).getByRole('heading', { name: 'No routes match' })).toBeVisible();
    await goDiscover(page, '&lat=-89&lng=179&r=200');
    await expect(statusOf(page)).toHaveText('0 routes within 200 km of your place');
  });

  test('F02-E5 the smallest and largest distances both work', async ({ page }) => {
    await goDiscover(page, '&lat=13.0837&lng=80.2702&r=5');
    await expect(statusOf(page)).toContainText('within 5 km');
    await expect(slider(page, 'Within')).toHaveValue('5');
    await goDiscover(page, '&lat=13.0837&lng=80.2702&r=200');
    await expect(statusOf(page)).toContainText('within 200 km');
    expect(parseInt(await statusOf(page).innerText(), 10)).toBeGreaterThan(10);
  });

  test('F02-E6 case and spaces do not change the place', async ({ page }) => {
    await goDiscover(page);
    const results = [];
    for (const text of ['chennai', 'CHENNAI', ' Chennai ']) {
      await search(page, text);
      await expect(statusOf(page)).toContainText('of Chennai, Tamil Nadu');
      results.push(await statusOf(page).innerText());
    }
    expect(new Set(results).size).toBe(1);
  });

  test('F02-N1 a geocoder answer that is not coordinates counts as not found', async ({ page, env }) => {
    env.nominatim.answer = () => [{ lat: 'north', lon: 'east', display_name: 'Nowhere' }];
    await goDiscover(page);
    await search(page, 'anything');
    await expect(page.getByText(/could not find that place/)).toBeVisible();
    await expect(statusOf(page)).toHaveText('21 routes');
  });
});
