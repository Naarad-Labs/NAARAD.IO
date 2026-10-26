/* The accessibility rules the pages' markup must keep, checked on what the
   views draw (no browser needed; tests in e2e/ cover how it behaves). */

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
const HomeView = await import('../app/views/home.js');
const ExploreView = await import('../app/views/explore.js');
const StudioView = await import('../app/views/studio.js');
const Icons = await import('../app/icons.js');
await Media.loadMedia();
const routes = await Data.loadRoutes();

const ids = (html) => [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);

test('a route\'s section links are navigation to targets that exist, not a tab widget', async () => {
  assert.ok(routes.length > 15);
  for (const route of routes) {
    const html = await RouteView.render({ route, stop: route.stops[0]?.order });
    const nav = html.match(/<nav class="route-tabs" aria-label="Route sections">([\s\S]*?)<\/nav>/);
    assert.ok(nav, `${route.slug}: the section links are a labelled nav`);
    const links = [...nav[1].matchAll(/<a href="#([^"]+)" data-tab="([^"]+)"([^>]*)>/g)];
    assert.ok(links.length >= 4, route.slug);
    assert.equal(links.filter((link) => link[3].includes('aria-current')).length, 1, `${route.slug}: one section is current`);
    for (const [, target] of links) assert.equal(ids(html).filter((id) => id === target).length, 1, `${route.slug}: #${target} is on the page once`);
    assert.doesNotMatch(nav[1], /role=|tabindex=|aria-selected|aria-controls/, `${route.slug}: plain links, in the tab order`);
    assert.doesNotMatch(html, /role="tabpanel"/, `${route.slug}: the sections are not panels of a tab widget`);
    assert.equal((html.match(/data-tab="stops"/g) || []).length, route.stops.length ? 1 : 0, `${route.slug}: no link to a list of stops that is not there`);
  }
});

test('nothing in a route page points aria-controls, aria-labelledby or a tab at an element that is not there', async () => {
  for (const route of routes) {
    const html = await RouteView.render({ route, stop: route.stops[0]?.order });
    const present = new Set(ids(html));
    for (const [, name, value] of html.matchAll(/\s(aria-controls|aria-labelledby)="([^"]+)"/g)) {
      for (const id of value.split(/\s+/)) assert.ok(present.has(id), `${route.slug}: ${name}="${id}"`);
    }
    assert.doesNotMatch(html, /id="tab-|id="panel-/, route.slug);
  }
});

test('the stop rail has two sibling buttons per stop, and no control inside a control', async () => {
  const route = routes.find((candidate) => candidate.slug === 'hampi-heritage-trail');
  const html = await RouteView.render({ route, stop: 1 });
  const rows = [...html.matchAll(/<li class="stop-row">([\s\S]*?)<\/li>/g)].map((match) => match[1]);
  assert.equal(rows.length, route.stops.length);
  for (const [index, row] of rows.entries()) {
    const buttons = [...row.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map((match) => match[0]);
    assert.equal(buttons.length, 2, `stop ${index + 1}: select and play are two buttons`);
    assert.match(buttons[0], /data-select-stop="\d+"/);
    assert.match(buttons[1], new RegExp(`data-action="listen" data-stop="${index + 1}"`));
    assert.match(buttons[1], /aria-label="Listen to [^"]+"/);
    for (const button of buttons) {
      assert.equal((button.match(/<button\b/g) || []).length, 1, `stop ${index + 1}: a button inside a button`);
      assert.doesNotMatch(button, /role="button"|tabindex=/, `stop ${index + 1}: a focusable thing inside a button`);
    }
    assert.ok(row.indexOf('</button>') < row.lastIndexOf('<button'), `stop ${index + 1}: the buttons are siblings`);
  }
});

test('the pause mark is drawn as shapes, so it is solid where the player fills icons', () => {
  const pause = Icons.icon('pause');
  assert.match(pause, /<rect /);
  assert.doesNotMatch(pause, /<path /, 'a stroke-only mark vanishes under fill: currentColor; stroke: none');
  assert.equal((pause.match(/<rect /g) || []).length, 2);
});

test('the landmarks are named, and nothing carries a role its element may not have', async () => {
  const shell = fs.readFileSync(new URL('app/shell.html', ROOT), 'utf8');
  assert.match(shell, /<form class="header-search" role="search" aria-label="Site search"/);
  const toggle = shell.match(/<button class="menu-toggle"[^>]*>/)[0];
  assert.match(toggle, /aria-label="Menu"/, 'one label whether the menu is open or shut: aria-expanded says which');
  const controls = toggle.match(/aria-controls="([^"]+)"/)?.[1];
  assert.ok(controls && new RegExp(`<nav [^>]*id="${controls}"`).test(shell), 'the button names the nav it opens');

  const catalogue = await ExploreView.render();
  assert.match(catalogue, /<form class="catalogue-search" role="search" aria-label="Search routes"/);
  assert.match(catalogue, /\b3 routes have ordered stops/);

  const home = await HomeView.render();
  assert.doesNotMatch(home, /role="listitem"|role="list"/);
});

test('only the result count is a live region, so typing does not read out every card', async () => {
  const catalogue = await ExploreView.render();
  assert.equal((catalogue.match(/aria-live=|role="status"/g) || []).length, 1);
  assert.match(catalogue, /<span id="catalogue-count" role="status">\d+ routes?<\/span>/);
  assert.doesNotMatch(catalogue, /<section class="catalogue-results"[^>]*aria-live/);
});

test('the studio says it is a drafting space, and promises no recording, audio or publishing', async () => {
  const html = await StudioView.render();
  const lede = html.match(/<p class="lede">([\s\S]*?)<\/p>/)[1];
  assert.match(lede, /drafting space/i);
  assert.match(lede, /publishing is not open/i);
  assert.doesNotMatch(lede, /\brecord|audio stories|prepare/i);
  assert.doesNotMatch(html, /up to 10 minutes|Drag and drop/, 'a limit nothing enforces, and a drop target that is not there');
});
