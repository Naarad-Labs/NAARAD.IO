/* scripts/build-site.mjs is all or nothing: when anything goes wrong it exits
   non-zero before it writes or deletes a single file, so a bad content file can
   never take pages off the site or leave a half-written tree. These run the
   real build, in a copy of the site, with the content broken in turn. */

import test from 'node:test';
import assert from 'node:assert/strict';
import { cannotBuild, copySite, snapshot, build, edit, changes } from './build-helpers.mjs';

const skip = cannotBuild() || false;

/** Break the copy, build, and check that the build failed with `message` and left every file as it was. */
async function fails(t, { change, message, args = [] }) {
  const site = copySite();
  t.after(site.remove);
  change(site.dir);
  const before = snapshot(site.dir);
  const result = build(site.dir, args);
  assert.notEqual(result.code, 0, `the build exited 0:\n${result.output}`);
  assert.match(result.output, message, result.output);
  assert.deepEqual(changes(before, snapshot(site.dir)), [], 'the build must not write or delete anything when it fails');
}

test('routes.json that is not valid JSON stops the build and takes no page off the site', { skip }, async (t) => {
  await fails(t, { change: (dir) => edit(dir, 'content/routes.json', (text) => text.replace(/\s*$/, ',\n')), message: /could not start|routes\.json/ });
});

test('photo-sources.json that is not valid JSON is named, before anything is written', { skip }, async (t) => {
  await fails(t, { change: (dir) => edit(dir, 'content/photo-sources.json', (text) => text.replace(/\s*$/, ',\n')), message: /content\/photo-sources\.json/ });
});

test('lastmod.json that is not valid JSON is named, before anything is written', { skip }, async (t) => {
  await fails(t, { change: (dir) => edit(dir, 'content/lastmod.json', () => '{ "pages": '), message: /content\/lastmod\.json/ });
});

test('a content file that cannot be loaded stops the build', { skip }, async (t) => {
  await fails(t, { change: (dir) => edit(dir, 'content/stories.json', () => '[1,'), message: /could not start|stories/ });
});

test('a console error on a page stops the build', { skip }, async (t) => {
  await fails(t, {
    change: (dir) => edit(dir, 'app/views/home.js', (text) => `${text}\nconsole.error('boom from a test');\n`),
    message: /boom from a test/,
  });
});

test('a script error on a page stops the build', { skip }, async (t) => {
  await fails(t, {
    change: (dir) => edit(dir, 'app/views/home.js', (text) => `${text}\nsetTimeout(() => { throw new Error('late failure from a test'); }, 0);\n`),
    message: /late failure from a test/,
  });
});

test('a request that fails stops the build', { skip }, async (t) => {
  await fails(t, {
    change: (dir) => edit(dir, 'app/views/home.js', (text) => `${text}\nfetch('/content/no-such-file.json');\n`),
    message: /404.*no-such-file/,
  });
});

test('an option it does not know is refused', { skip }, async (t) => {
  await fails(t, { change: () => {}, args: ['--force'], message: /unknown option --force/ });
});

test('it will not delete a page unless told to, and then it does', { skip }, async (t) => {
  const site = copySite();
  t.after(site.remove);
  // A story taken out of the content, as a slip of the keyboard might.
  edit(site.dir, 'content/stories.json', (text) => {
    const data = JSON.parse(text);
    data.stories = data.stories.filter((story) => story.slug !== 'water-that-built-a-capital');
    return `${JSON.stringify(data, null, 2)}\n`;
  });
  const before = snapshot(site.dir);

  const refused = build(site.dir);
  assert.notEqual(refused.code, 0, refused.output);
  assert.match(refused.output, /would delete/);
  assert.match(refused.output, /stories\/water-that-built-a-capital\/index\.html/);
  assert.match(refused.output, /--allow-removal/);
  assert.deepEqual(changes(before, snapshot(site.dir)), [], 'a refused build writes nothing');

  const allowed = build(site.dir, ['--allow-removal']);
  assert.equal(allowed.code, 0, allowed.output);
  const after = snapshot(site.dir);
  assert.ok(!after.has('stories/water-that-built-a-capital/index.html'));
  assert.ok(!after.has('Images/og/story-water-that-built-a-capital.jpg'));
  assert.ok(after.has('stories/stone-chariot-of-hampi/index.html'));
});
