import test from 'node:test';
import assert from 'node:assert/strict';
import { UNSAVED_LABEL, routeSlug, isOnline, blocksNavigation, barModel, renderBar, markLinks } from '../../app/offline-state.js';

const origin = 'https://naarad.io';
const base = { origin, online: false, savedSlugs: ['hampi-heritage-trail'], enabled: true };

test('routeSlug reads only /routes/<slug>/ pages', () => {
  assert.equal(routeSlug('/routes/hampi-heritage-trail/'), 'hampi-heritage-trail');
  assert.equal(routeSlug('/routes/hampi-heritage-trail'), 'hampi-heritage-trail');
  assert.equal(routeSlug('/routes/'), null);
  assert.equal(routeSlug('/routes'), null);
  assert.equal(routeSlug('/routes/geo-tracks.json'), null);
  assert.equal(routeSlug('/routes/a/b/'), null);
  assert.equal(routeSlug('/stories/x/'), null);
  assert.equal(routeSlug('/routes/Bad_Slug/'), null);
  assert.equal(routeSlug(''), null);
  assert.equal(routeSlug(null), null);
});

test('isOnline: only an explicit false means offline', () => {
  assert.equal(isOnline({ onLine: false }), false);
  assert.equal(isOnline({ onLine: true }), true);
  assert.equal(isOnline({}), true);
  assert.equal(isOnline(undefined), true);
});

test('offline, an unsaved route page is blocked, with a reason a visitor can read', () => {
  const result = blocksNavigation({ ...base, url: `${origin}/routes/jaipur-pink-city-cycling/` });
  assert.equal(result.blocked, true);
  assert.equal(result.slug, 'jaipur-pink-city-cycling');
  assert.match(result.reason, /not saved/i);
  assert.match(result.reason, /offline/i);
});

test('a saved route, an online visitor, and a switched-off flag are never blocked', () => {
  assert.equal(blocksNavigation({ ...base, url: `${origin}/routes/hampi-heritage-trail/` }).blocked, false);
  assert.equal(blocksNavigation({ ...base, online: true, url: `${origin}/routes/jaipur-pink-city-cycling/` }).blocked, false);
  assert.equal(blocksNavigation({ ...base, enabled: false, url: `${origin}/routes/jaipur-pink-city-cycling/` }).blocked, false);
});

test('only route pages are blocked: not the catalogue, My Journey, stories, other sites, or a bad URL', () => {
  for (const url of [`${origin}/routes/`, `${origin}/journey/`, `${origin}/stories/x/`, 'https://elsewhere.example/routes/x/', 'not a url', '']) {
    assert.equal(blocksNavigation({ ...base, url }).blocked, false, url);
  }
});

test('blocksNavigation accepts a URL object, a relative path and a Set of saved slugs', () => {
  assert.equal(blocksNavigation({ ...base, url: new URL('/routes/x-y/', origin) }).blocked, true);
  assert.equal(blocksNavigation({ ...base, url: '/routes/x-y/' }).blocked, true);
  assert.equal(blocksNavigation({ ...base, savedSlugs: new Set(['x-y']), url: '/routes/x-y/' }).blocked, false);
});

test('the bar: hidden online; offline it says what is shown, and whether anything is saved', () => {
  assert.deepEqual(barModel({ online: true, savedCount: 3 }), { visible: false, text: '' });
  assert.equal(barModel({ online: false, savedCount: 2 }).visible, true);
  assert.match(barModel({ online: false, savedCount: 2 }).text, /offline/i);
  assert.match(barModel({ online: false, savedCount: 2 }).text, /saved on this device/i);
  assert.match(barModel({ online: false, savedCount: 0 }).text, /no routes are saved/i);
});

test('renderBar: nothing when hidden; otherwise a status region with the text escaped', () => {
  assert.equal(renderBar({ visible: false, text: '' }), '');
  const html = renderBar({ visible: true, text: 'You are offline. <b>x</b>' });
  assert.match(html, /id="offline-bar"/);
  assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /<b>x<\/b>/);
  assert.match(html, /&lt;b&gt;/);
});

test('markLinks flags exactly the unsaved route links, and nothing at all when online or switched off', () => {
  const hrefs = ['/routes/hampi-heritage-trail/', '/routes/jaipur-pink-city-cycling/', '/routes/', '/journey/', 'https://elsewhere.example/routes/x/', '/routes/udaipur-lake-palace-circuit/?stop=2'];
  assert.deepEqual(markLinks(hrefs, base), [false, true, false, false, false, true]);
  assert.deepEqual(markLinks(hrefs, { ...base, online: true }), hrefs.map(() => false));
  assert.deepEqual(markLinks(hrefs, { ...base, enabled: false }), hrefs.map(() => false));
  assert.deepEqual(markLinks([], base), []);
});

test('the label is plain and short', () => {
  assert.equal(UNSAVED_LABEL, 'Not saved for offline');
});
