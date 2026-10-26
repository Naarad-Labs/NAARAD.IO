/* What each page says about itself (meta() in app/views): the rules that keep
   a page from claiming more than the site has. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ROOT = new URL('../', import.meta.url);
globalThis.fetch = async (input) => {
  const file = new URL(String(input).slice(1), ROOT);
  return fs.existsSync(file) ? new Response(fs.readFileSync(file)) : new Response('missing', { status: 404 });
};

const Data = await import('../app/data.js');
const Media = await import('../app/media.js');
const RouteView = await import('../app/views/route.js');
const StoryView = await import('../app/views/story.js');
const ExploreView = await import('../app/views/explore.js');
const StudioView = await import('../app/views/studio.js');
await Media.loadMedia();

const routes = await Data.loadRoutes();
const types = (meta) => meta.schema.map((node) => node['@type']);

test('a route with stops is indexable and is a TouristTrip with its distance and stops', () => {
  const editorial = routes.filter((route) => route.hasStops);
  assert.deepEqual(editorial.map((route) => route.slug).sort(), ['auroville-explorer', 'hampi-heritage-trail', 'thanjavur-living-heritage']);
  for (const route of editorial) {
    const meta = RouteView.meta({ route });
    assert.equal(meta.robots, null, route.slug);
    assert.deepEqual(types(meta), ['BreadcrumbList', 'TouristTrip', 'Organization'], route.slug);
    const trip = meta.schema[1];
    assert.equal(trip.itinerary.numberOfItems, route.stops.length);
    assert.equal(trip.potentialAction.distance, Data.formatDistance(route.distanceM));
  }
});

test('every route without stops is noindex,follow and describes no trip', () => {
  const stubs = routes.filter((route) => !route.hasStops);
  assert.ok(stubs.length >= 15);
  for (const route of stubs) {
    const meta = RouteView.meta({ route });
    assert.equal(meta.robots, 'noindex,follow', route.slug);
    assert.deepEqual(types(meta), ['BreadcrumbList', 'Organization'], route.slug);
    assert.ok(meta.path.endsWith(`/${route.slug}/`), 'the page keeps its own address');
    assert.ok(meta.card, 'and its share card');
  }
});

test('a catalogue row states no distance of its own, a recorded track states the recorded one', () => {
  const rows = routes.filter((route) => route.source === 'catalogue');
  const tracks = routes.filter((route) => route.source === 'track');
  assert.ok(rows.length && tracks.length);
  for (const route of rows) {
    assert.ok(route.distanceM != null, 'the row has a stand-in distance');
    const meta = RouteView.meta({ route });
    assert.doesNotMatch(meta.description, /\d\s?km|\d\s?m long/, route.slug);
    assert.deepEqual(meta.card.facts, [], route.slug);
  }
  for (const route of tracks) {
    const meta = RouteView.meta({ route });
    assert.match(meta.description, new RegExp(Data.formatDistance(route.distanceM)), route.slug);
    assert.ok(meta.card.facts.includes(Data.formatDistance(route.distanceM)), route.slug);
  }
});

test('Puducherry is not placed in Tamil Nadu', () => {
  const route = routes.find((candidate) => candidate.slug === 'pondicherry-french-quarter');
  assert.equal(route.location, 'Puducherry');
  assert.equal(route.region, 'Puducherry');
  assert.doesNotMatch(RouteView.meta({ route }).description, /Tamil Nadu/);
});

test('no story is dated unless the content records a date', async () => {
  const stories = await StoryView.loadStories();
  assert.equal(stories.length, 3);
  for (const story of stories) {
    assert.equal(story.published, undefined, `${story.slug}: a date needs a real, checkable source`);
    const meta = await StoryView.meta({ story });
    assert.equal(meta.published, null);
    assert.equal(meta.schema.find((node) => node['@type'] === 'Article').datePublished, undefined);
    assert.doesNotMatch(await StoryView.render({ story }), /published \d/);
  }
});

test('a date the content does record is shown, but only if it is a real date', async () => {
  const [story] = await StoryView.loadStories();
  const dated = await StoryView.meta({ story: { ...story, published: '2026-11-02' } });
  assert.equal(dated.published, '2026-11-02');
  assert.equal(dated.schema.find((node) => node['@type'] === 'Article').datePublished, '2026-11-02');
  const odd = await StoryView.meta({ story: { ...story, published: 'last autumn' } });
  assert.equal(odd.published, null);
});

test('the studio promises no narration, audio or publishing', () => {
  const { description } = StudioView.meta();
  assert.doesNotMatch(description, /narration|audio|transcript|prepare/i);
  assert.match(description, /publishing is not open/i);
});

test('the catalogue and the story index say what they hold', async () => {
  await ExploreView.render();
  const { description } = ExploreView.meta();
  const withStops = routes.filter((route) => route.hasStops).length;
  assert.ok(description.includes(`Search ${routes.length} heritage walking routes`));
  assert.ok(description.includes(`${withStops} have ordered stops`));
  assert.doesNotMatch(description, /every published route|terrain/i);

  const index = await StoryView.indexMeta();
  assert.doesNotMatch(index.description, /long-form/i);
  assert.doesNotMatch(await StoryView.renderIndex(), /long-form/i);
});
