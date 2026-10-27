/* The sitemap dates, end to end: the real build, in a copy of the site. A
   page's lastmod moves only when what the page says does, whatever the clock,
   the git history or the checkout. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cannotBuild, copySite, snapshot, build, edit, lastmods, changes } from './build-helpers.mjs';

const skip = cannotBuild() || false;

test('a rebuild changes nothing, whatever the date, and without git', { skip }, async (t) => {
  const site = copySite();                                  // a copy has no .git: nothing may need it
  t.after(site.remove);
  assert.ok(!fs.existsSync(path.join(site.dir, '.git')));
  const before = snapshot(site.dir);
  const dates = lastmods(site.dir);
  assert.ok(Object.keys(dates).length >= 10);

  const first = build(site.dir, [], { NAARAD_BUILD_DATE: '2031-01-01' });
  assert.equal(first.code, 0, first.output);
  assert.deepEqual(changes(before, snapshot(site.dir)), [], 'the committed tree is what the build produces');
  assert.match(first.stdout, /0 files written/);
  assert.deepEqual(lastmods(site.dir), dates);
});

test('only a page whose content changed gets the build date', { skip }, async (t) => {
  const site = copySite();
  t.after(site.remove);
  const dates = lastmods(site.dir);

  edit(site.dir, 'content/stories.json', (text) => text.replace('A City of Wonders', 'A City of Marvels'));
  const result = build(site.dir, [], { NAARAD_BUILD_DATE: '2031-02-03' });
  assert.equal(result.code, 0, result.output);

  const after = lastmods(site.dir);
  assert.equal(after['/stories/stone-chariot-of-hampi/'], '2031-02-03', 'the story that changed');
  for (const address of ['/about/', '/creators/', '/routes/hampi-heritage-trail/', '/stories/bazaar-that-sold-the-world/']) {
    assert.equal(after[address], dates[address], `${address} did not change`);
  }

  // Changing only the shell (header, footer, scripts) dates no page.
  edit(site.dir, 'app/shell.html', (text) => text.replace('Real places. Deeper stories.', 'Real places, deeper stories.'));
  const shell = build(site.dir, [], { NAARAD_BUILD_DATE: '2031-03-04' });
  assert.equal(shell.code, 0, shell.output);
  assert.deepEqual(lastmods(site.dir), after);
  assert.match(fs.readFileSync(path.join(site.dir, 'about', 'index.html'), 'utf8'), /Real places, deeper stories\./);
});

test('a page that leaves the sitemap leaves content/lastmod.json, and a stub never enters it', { skip }, async (t) => {
  const site = copySite();
  t.after(site.remove);
  const manifest = JSON.parse(fs.readFileSync(path.join(site.dir, 'content', 'lastmod.json'), 'utf8'));
  assert.ok(manifest.pages['/routes/hampi-heritage-trail/']);
  assert.ok(!manifest.pages['/routes/mysore-palace-heritage-walk/']);
  assert.deepEqual(Object.keys(manifest.pages), Object.keys(lastmods(site.dir)).sort());
  for (const entry of Object.values(manifest.pages)) {
    assert.match(entry.hash, /^[0-9a-f]{64}$/);
    assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/);
  }
});
