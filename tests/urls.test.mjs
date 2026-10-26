/* The address scheme (app/urls.js): the clean path of every page, and the
   conversion of every old address to its clean one. */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ORIGIN, SECTIONS, sectionPath, cataloguePath, routePath, storyPath, absoluteUrl, normalPath, legacyTarget,
} from '../app/urls.js';

const legacy = (address) => legacyTarget(new URL(address, ORIGIN));

test('clean paths', () => {
  assert.equal(sectionPath('home'), '/');
  assert.equal(sectionPath('about'), '/about/');
  assert.equal(sectionPath('journey'), '/journey/');
  assert.equal(cataloguePath(), '/routes/');
  assert.equal(cataloguePath(''), '/routes/');
  assert.equal(cataloguePath('temple walk'), '/routes/?q=temple+walk');
  assert.equal(cataloguePath('temple', '/explore/'), '/explore/?q=temple');
  assert.equal(routePath('hampi-heritage-trail'), '/routes/hampi-heritage-trail/');
  assert.equal(routePath('hampi-heritage-trail', 3), '/routes/hampi-heritage-trail/?stop=3');
  assert.equal(routePath('hampi-heritage-trail', '3'), '/routes/hampi-heritage-trail/?stop=3');
  assert.equal(routePath('hampi-heritage-trail', null), '/routes/hampi-heritage-trail/');
  assert.equal(routePath('hampi-heritage-trail', 0), '/routes/hampi-heritage-trail/');
  assert.equal(storyPath('stone-chariot-of-hampi'), '/stories/stone-chariot-of-hampi/');
});

test('slugs are encoded, so a path cannot be broken out of', () => {
  assert.equal(routePath('a b'), '/routes/a%20b/');
  assert.equal(routePath('a/b'), '/routes/a%2Fb/');
  assert.equal(routePath('a?b#c'), '/routes/a%3Fb%23c/');
  assert.equal(storyPath('मंदिर'), '/stories/%E0%A4%AE%E0%A4%82%E0%A4%A6%E0%A4%BF%E0%A4%B0/');
  assert.equal(decodeURIComponent(routePath('a b').split('/')[2]), 'a b');
});

test('absoluteUrl puts a path on the site\'s own origin', () => {
  assert.equal(ORIGIN, 'https://naarad.io');
  assert.equal(absoluteUrl('/'), 'https://naarad.io/');
  assert.equal(absoluteUrl('/routes/x/?stop=2'), 'https://naarad.io/routes/x/?stop=2');
  assert.equal(absoluteUrl(sectionPath('stories')), 'https://naarad.io/stories/');
});

test('normalPath gives a page one form, and leaves files alone', () => {
  assert.equal(normalPath('/about'), '/about/');
  assert.equal(normalPath('/about/'), '/about/');
  assert.equal(normalPath('/index.html'), '/');
  assert.equal(normalPath('/routes/x/index.html'), '/routes/x/');
  assert.equal(normalPath('/routes/x'), '/routes/x/');
  assert.equal(normalPath('/sw.js'), '/sw.js');
  assert.equal(normalPath('/Images/og/home.jpg'), '/Images/og/home.jpg');
  assert.equal(normalPath('/routes/geo-tracks.json'), '/routes/geo-tracks.json');
});

test('the old ?route= address, with and without a stop', () => {
  assert.equal(legacy('/?route=hampi-heritage-trail'), '/routes/hampi-heritage-trail/');
  assert.equal(legacy('/?route=hampi-heritage-trail&stop=3'), '/routes/hampi-heritage-trail/?stop=3');
  assert.equal(legacy('/index.html?route=hampi-heritage-trail'), '/routes/hampi-heritage-trail/');
  // A stop that is not a positive number is no stop.
  assert.equal(legacy('/?route=hampi-heritage-trail&stop=abc'), '/routes/hampi-heritage-trail/');
  assert.equal(legacy('/?route=hampi-heritage-trail&stop=0'), '/routes/hampi-heritage-trail/');
  assert.equal(legacy('/?route=hampi-heritage-trail&stop='), '/routes/hampi-heritage-trail/');
});

test('the old ?story=, ?view= and ?q= addresses', () => {
  assert.equal(legacy('/?story=stone-chariot-of-hampi'), '/stories/stone-chariot-of-hampi/');
  for (const section of SECTIONS) assert.equal(legacy(`/?view=${section}`), `/${section}/`, section);
  assert.equal(legacy('/?view=home'), '/');
  assert.equal(legacy('/?view=nonsense'), '/');
  assert.equal(legacy('/?q=temple'), '/routes/?q=temple');
  assert.equal(legacy('/?q=temple+walk'), '/routes/?q=temple+walk');
});

test('the old path forms /route/x and /story/x', () => {
  assert.equal(legacy('/route/hampi-heritage-trail'), '/routes/hampi-heritage-trail/');
  assert.equal(legacy('/route/hampi-heritage-trail/'), '/routes/hampi-heritage-trail/');
  assert.equal(legacy('/route/hampi-heritage-trail?stop=2'), '/routes/hampi-heritage-trail/?stop=2');
  assert.equal(legacy('/story/stone-chariot-of-hampi'), '/stories/stone-chariot-of-hampi/');
  assert.equal(legacy('/story/stone-chariot-of-hampi/'), '/stories/stone-chariot-of-hampi/');
});

test('a fragment survives the conversion', () => {
  assert.equal(legacy('/?story=stone-chariot-of-hampi#belief-and-symbolism'), '/stories/stone-chariot-of-hampi/#belief-and-symbolism');
  assert.equal(legacy('/?route=hampi-heritage-trail&stop=3#map'), '/routes/hampi-heritage-trail/?stop=3#map');
  assert.equal(legacy('/route/x#top'), '/routes/x/#top');
});

test('an encoded slug is decoded, then encoded once', () => {
  assert.equal(legacy('/?route=a%20b'), '/routes/a%20b/');
  assert.equal(legacy('/route/a%20b'), '/routes/a%20b/');
  assert.equal(legacy('/story/a%2Fb'), '/stories/a%2Fb/');
  assert.equal(legacy('/?route=%E0%A4%AE'), '/routes/%E0%A4%AE/');
});

test('an address that is not an old one is not converted', () => {
  for (const address of [
    '/', '/routes/', '/routes/hampi-heritage-trail/', '/stories/', '/stories/x/', '/about/', '/journey/', '/creators/',
    '/?foo=bar', '/?stop=3', '/routes/?q=temple', '/route/', '/route', '/route/a/b', '/story/', '/routes/x/?route=y',
    '/sw.js', '/no-such-place/',
  ]) assert.equal(legacy(address), null, address);
});

test('a malformed escape in an old path names nothing and does not throw', () => {
  assert.equal(legacy('/route/%E0%A4%A'), null);
  assert.equal(legacy('/story/%'), null);
});

test('every conversion lands on an address that is its own normal form', () => {
  for (const address of ['/?route=x', '/?route=x&stop=2', '/?story=y', '/?view=routes', '/?q=z', '/route/x', '/story/y']) {
    const target = legacy(address);
    const { pathname } = new URL(target, ORIGIN);
    assert.equal(normalPath(pathname), pathname, address);
    assert.equal(legacy(target), null, `${address} converts only once`);
  }
});
