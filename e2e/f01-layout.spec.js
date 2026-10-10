// F01 layout: the phone layout that follows replica/screens-notes.md (floating pill and chips, bottom sheet,
// Map button), the card, the desktop bar, and the brand tokens reaching the screen. Cases are in replica/test-plan.md.
const { test, expect, root, statusOf, articles, placeField, goDiscover, DESKTOP, PHONE } = require('./fixtures');

const chip = (page, name) => root(page).getByRole('button', { name, exact: true });
const pop = (page, id) => page.locator('#' + id);
const summary = (page, id) => page.locator('#' + id + ' summary');
const handleOf = (page) => root(page).getByRole('separator', { name: 'Resize results panel' });
const mapButton = (page) => root(page).getByRole('button', { name: 'Map', exact: true });

test.describe('F01 phone layout', () => {
  test.use({ viewport: PHONE.size });

  test('F01-E24 three chips on one row say what is set, and open one panel at a time', async ({ page }) => {
    await goDiscover(page);
    const row = await page.evaluate(() => [...document.querySelectorAll('.nd-chiprow > details > summary')].map((s) => Math.round(s.getBoundingClientRect().top)));
    expect(row.length).toBe(3);
    expect(new Set(row).size, 'the three chips should share one row at 390px').toBe(1);

    await expect(summary(page, 'nd-sport-pop')).toHaveText('Sport');
    await expect(summary(page, 'nd-within-pop')).toHaveText('All of India');
    await expect(summary(page, 'nd-filters')).toHaveText('Filters');

    await summary(page, 'nd-sport-pop').click();
    await expect(pop(page, 'nd-sport-pop')).toHaveJSProperty('open', true);
    await summary(page, 'nd-filters').click();
    await expect(pop(page, 'nd-filters')).toHaveJSProperty('open', true);
    await expect(pop(page, 'nd-sport-pop'), 'opening one panel closes the other').toHaveJSProperty('open', false);

    await chip(page, 'Easy').click(); await chip(page, 'Hard').click();
    await expect(summary(page, 'nd-filters')).toHaveText('Filters (1)');   // one kind of filter set: difficulty
    await expect(summary(page, 'nd-filters')).toHaveClass(/is-active/);

    await placeField(page).fill('Chennai'); await placeField(page).press('Enter');
    await expect(summary(page, 'nd-within-pop')).toHaveText('Within 30 km');
    await expect(summary(page, 'nd-within-pop')).toHaveClass(/is-active/);
  });

  test('F01-E25 Escape, a tap outside, and picking a sport close the open panel', async ({ page }) => {
    await goDiscover(page);
    await summary(page, 'nd-within-pop').focus(); await page.keyboard.press('Enter');
    await expect(pop(page, 'nd-within-pop')).toHaveJSProperty('open', true);
    await page.keyboard.press('Escape');
    await expect(pop(page, 'nd-within-pop')).toHaveJSProperty('open', false);
    await expect(summary(page, 'nd-within-pop'), 'Escape returns focus to the chip').toBeFocused();

    await summary(page, 'nd-filters').click();
    await expect(pop(page, 'nd-filters')).toHaveJSProperty('open', true);
    await root(page).locator('#nd-status').click();   // anywhere outside the panels
    await expect(pop(page, 'nd-filters'), 'a tap outside closes the panel').toHaveJSProperty('open', false);

    await summary(page, 'nd-sport-pop').click();
    await root(page).getByRole('radio', { name: 'Hike' }).focus();
    await page.keyboard.press('ArrowRight');   // an arrow key moves the choice and keeps the list open
    await expect(root(page).getByRole('radio', { name: 'Cycle' })).toBeChecked();
    await expect(pop(page, 'nd-sport-pop')).toHaveJSProperty('open', true);
    await root(page).getByRole('radio', { name: 'Walk' }).click();   // a tap picks and closes
    await expect(pop(page, 'nd-sport-pop')).toHaveJSProperty('open', false);
    await expect(summary(page, 'nd-sport-pop')).toHaveText('Walk');
  });

  test('F01-E26 the Map button appears in the full-height list and takes you back to the map', async ({ page }) => {
    await goDiscover(page);
    await expect(mapButton(page), 'no Map button over the map view').toBeHidden();
    await handleOf(page).click();   // a tap on the handle opens the list
    await expect(mapButton(page)).toBeVisible();
    const topOfSheet = await page.evaluate(() => Math.round(document.getElementById('nd-sheet').getBoundingClientRect().top - document.getElementById('nd-filterbar').getBoundingClientRect().bottom));
    expect(topOfSheet, 'the list stops below the chips, so they stay usable').toBeGreaterThanOrEqual(0);
    await expect(page.locator('#nd-discover .leaflet-control-zoom'), 'the map controls would sit on the chips, so they step aside').toBeHidden();
    await mapButton(page).click();
    await expect(mapButton(page)).toBeHidden();
    await expect(handleOf(page), 'focus goes to the handle, not the page').toBeFocused();
    await expect(page.locator('#nd-discover .leaflet-control-zoom')).toBeVisible();

    await handleOf(page).focus(); await page.keyboard.press('End');
    await expect(mapButton(page)).toBeVisible();
    await page.keyboard.press('Home');
    await expect(mapButton(page)).toBeHidden();
  });

  test('F01-E27 the map controls and attribution stay above the sheet', async ({ page }) => {
    await goDiscover(page);
    const m = await page.evaluate(() => {
      const sheet = document.getElementById('nd-sheet').getBoundingClientRect(), attr = document.querySelector('.leaflet-control-attribution').getBoundingClientRect(), zoom = document.querySelector('.leaflet-control-zoom').getBoundingClientRect();
      return { sheetTop: Math.round(sheet.top), attrBottom: Math.round(attr.bottom), zoomBottom: Math.round(zoom.bottom) };
    });
    expect(m.attrBottom, 'the OpenStreetMap credit must stay visible').toBeLessThanOrEqual(m.sheetTop + 1);
    expect(m.zoomBottom).toBeLessThanOrEqual(m.sheetTop + 1);
  });

  test('F01-E28 the pill: a clear button, and a hint that shows only while you type', async ({ page }) => {
    await goDiscover(page);
    const clear = root(page).getByRole('button', { name: 'Clear search' });
    const hint = page.locator('#nd-place-hint');
    await expect(clear, 'nothing to clear in an empty field').toBeHidden();
    await expect(hint).toBeHidden();
    await placeField(page).focus();
    await expect(hint, 'the hint shows while the field is in use').toBeVisible();
    await page.keyboard.type('Chennai');
    await expect(clear).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(statusOf(page)).toContainText('of Chennai');
    await expect(hint, 'after Enter the hint steps aside so it does not cover the chips').toBeHidden();
    await clear.click();
    await expect(statusOf(page)).toHaveText('21 routes');
    await expect(placeField(page)).toHaveValue('');
    await expect(placeField(page), 'focus stays in the field').toBeFocused();
    await expect(clear).toBeHidden();
  });
});

test.describe('F01 card and brand', () => {
  test.use({ viewport: DESKTOP.size });

  test('F01-E29 a card: badge over the media, then rating, title, place and the stats in the original\'s order', async ({ page }) => {
    await goDiscover(page);
    const card = articles(page).filter({ hasText: 'Udaipur Lake Palace Circuit' });
    const m = await card.evaluate((c) => {
      const media = c.querySelector('.nd-card__media').getBoundingClientRect(), badge = c.querySelector('.nd-badge').getBoundingClientRect();
      return {
        badgeOverMedia: badge.top >= media.top && badge.bottom <= media.bottom && badge.left >= media.left,
        stats: [...c.querySelectorAll('.nd-card__stats li')].map((li) => li.dataset.stat),
        order: ['.nd-card__rating', '.nd-card__title', '.nd-card__meta', '.nd-card__stats'].map((s) => Math.round(c.querySelector(s).getBoundingClientRect().top)),
        badgeText: c.querySelector('.nd-badge').textContent,
        ascentWords: c.querySelector('[data-stat="ascent"]').textContent,
      };
    });
    expect(m.badgeOverMedia, 'the difficulty badge sits over the media').toBe(true);
    expect(m.badgeText).toBe('Moderate');
    expect(m.stats, 'time, length, climb').toEqual(['duration', 'distance', 'ascent']);
    expect([...m.order].sort((a, b) => a - b), 'rating, title, place, stats from top to bottom').toEqual(m.order);
    expect(m.ascentWords, 'the climb says so in words for a screen reader').toMatch(/climb/);
    await expect(card.locator('.nd-card__rating'), 'an aria-label is ignored on a plain span, so the rating is an image').toHaveAttribute('role', 'img');
    await expect(card.locator('.nd-card__rating')).toHaveAttribute('aria-label', /Rated 4\.9 out of 5 by 356 people/);
  });

  test('F01-E30 at 900px and up there are no chips: every control is open in one compact bar', async ({ page }) => {
    await goDiscover(page);
    for (const id of ['nd-sport-pop', 'nd-within-pop', 'nd-filters']) {
      await expect(summary(page, id), id + ' chip is hidden on a wide screen').toBeHidden();
      await expect(pop(page, id)).toHaveJSProperty('open', true);
    }
    for (const label of ['Place', 'Within', 'Longest route']) await expect(root(page).getByLabel(label, { exact: true }).first()).toBeVisible();
    await expect(root(page).getByRole('group', { name: 'Theme' })).toBeVisible();
    const barH = await page.evaluate(() => Math.round(document.getElementById('nd-filterbar').getBoundingClientRect().height));
    expect(barH, 'the bar should leave the list and the map their room').toBeLessThanOrEqual(260);
  });

  test('F01-E31 the brand tokens reach the screen: serif titles, navy primary, orange with a navy label', async ({ page }) => {
    await goDiscover(page);
    const m = await page.evaluate(() => {
      const css = (el, p) => getComputedStyle(el)[p], root = getComputedStyle(document.documentElement);
      const title = document.querySelector('.nd-card__title');
      return {
        titleFont: css(title, 'fontFamily'),
        orange: root.getPropertyValue('--color-orange').trim(),
        onOrange: root.getPropertyValue('--color-on-orange').trim(),
        sienna: root.getPropertyValue('--color-accent').trim(),
        bg: root.getPropertyValue('--color-bg').trim(),
      };
    });
    expect(m.titleFont).toMatch(/Playfair Display/);
    await chip(page, 'Heritage walk').click();   // the fill is a 200ms transition: let the assertion wait for it
    await expect(chip(page, 'Heritage walk'), 'a pressed chip is filled with the site navy').toHaveCSS('background-color', 'rgb(23, 39, 82)');
    expect([m.orange, m.onOrange], 'the kit orange carries a navy label').toEqual(['#F26A1C', '#172752']);
    expect(m.sienna, 'the text-safe accent is the deck\'s burnt sienna').toBe('#A7542A');
    expect(m.bg).toBe('#F6F0E6');
  });
});
