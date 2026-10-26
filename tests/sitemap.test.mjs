/* The sitemap's dates (scripts/sitemap.mjs): a page's lastmod is the day its
   content last changed, remembered in content/lastmod.json, and nothing reads
   git or the clock unless a page is new or changed. */

import test from 'node:test';
import assert from 'node:assert/strict';
import { pageContent, contentHash, nextManifest, sitemapXml } from '../scripts/sitemap.mjs';

const page = ({ title = 'Page · Naarad', description = 'A page.', main = '<h1>Page</h1>', chrome = 'Home | About' } = {}) => `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="description" content="${description}" data-page="">
  <link rel="canonical" href="https://naarad.io/page/" data-page="">
  <script type="application/ld+json" data-page="">{"@context":"https://schema.org"}</script>
  <link rel="icon" href="/Images/cropped_logo.png">
  <script>var shell = true;</script>
</head>
<body>
  <header>${chrome}</header>
  <main id="app-content" class="view-page" data-prerendered="/page/">${main}</main>
  <footer>${chrome}</footer>
</body></html>
`;

const never = () => { throw new Error('the clock must not be read'); };

test('a page is what its main content and its own head tags say', () => {
  const content = pageContent(page());
  assert.match(content, /<title>Page · Naarad<\/title>/);
  assert.match(content, /name="description" content="A page\."/);
  assert.match(content, /rel="canonical"/);
  assert.match(content, /application\/ld\+json/);
  assert.match(content, /<main id="app-content"[^>]*><h1>Page<\/h1><\/main>/);
  assert.doesNotMatch(content, /Home \| About/);
  assert.doesNotMatch(content, /var shell/);
  assert.doesNotMatch(content, /cropped_logo/);
});

test('changing the header, the footer or a script dates no page', () => {
  assert.equal(contentHash(page({ chrome: 'Home | About' })), contentHash(page({ chrome: 'Home | Routes | About' })));
});

test('changing what the page says changes its hash', () => {
  const base = contentHash(page());
  assert.notEqual(base, contentHash(page({ main: '<h1>Page</h1><p>More.</p>' })));
  assert.notEqual(base, contentHash(page({ description: 'Another description.' })));
  assert.notEqual(base, contentHash(page({ title: 'Other · Naarad' })));
  assert.match(base, /^[0-9a-f]{64}$/);
});

test('a document with no main content is an error, not an empty hash', () => {
  assert.throws(() => contentHash('<html><body>nothing</body></html>'), /app-content/);
});

test('a page whose hash is unchanged keeps its date, and the clock is never read', () => {
  const previous = { pages: { '/a/': { hash: 'h1', date: '2026-10-13' }, '/b/': { hash: 'h2', date: '2026-10-15' } } };
  const next = nextManifest(previous, { '/a/': 'h1', '/b/': 'h2' }, never);
  assert.deepEqual(next.pages, previous.pages);
});

test('a changed or new page gets the build date, once, and the others keep theirs', () => {
  const previous = { pages: { '/a/': { hash: 'h1', date: '2026-10-13' }, '/b/': { hash: 'h2', date: '2026-10-15' } } };
  let reads = 0;
  const next = nextManifest(previous, { '/a/': 'h1', '/b/': 'changed', '/c/': 'new' }, () => { reads += 1; return '2026-11-02'; });
  assert.deepEqual(next.pages, {
    '/a/': { hash: 'h1', date: '2026-10-13' },
    '/b/': { hash: 'changed', date: '2026-11-02' },
    '/c/': { hash: 'new', date: '2026-11-02' },
  });
  assert.equal(reads, 1);
});

test('a page that left the sitemap leaves the manifest', () => {
  const previous = { pages: { '/a/': { hash: 'h1', date: '2026-10-13' }, '/gone/': { hash: 'h9', date: '2026-10-13' } } };
  assert.deepEqual(Object.keys(nextManifest(previous, { '/a/': 'h1' }, never).pages), ['/a/']);
});

test('a missing, empty or damaged manifest dates every page with the build date', () => {
  for (const previous of [null, undefined, {}, { pages: null }, { pages: { '/a/': 'oops' } }, { pages: { '/a/': { hash: 'h1', date: 'yesterday' } } }]) {
    const next = nextManifest(previous, { '/a/': 'h1' }, () => '2026-11-02');
    assert.deepEqual(next.pages, { '/a/': { hash: 'h1', date: '2026-11-02' } }, JSON.stringify(previous));
  }
});

test('the build date must be a real YYYY-MM-DD', () => {
  for (const bad of ['', 'today', '2026-1-2', '02/11/2026', '2026-11-02T10:00:00Z', undefined]) {
    assert.throws(() => nextManifest(null, { '/a/': 'h1' }, () => bad), /YYYY-MM-DD/, String(bad));
  }
});

test('the manifest is the same however the pages were listed', () => {
  const one = nextManifest(null, { '/b/': 'x', '/a/': 'y', '/': 'z' }, () => '2026-11-02');
  const two = nextManifest(null, { '/': 'z', '/a/': 'y', '/b/': 'x' }, () => '2026-11-02');
  assert.equal(JSON.stringify(one), JSON.stringify(two));
  assert.deepEqual(Object.keys(one.pages), ['/', '/a/', '/b/']);
});

test('the sitemap lists the given pages in order, each dated from the manifest', () => {
  const manifest = { pages: { '/': { hash: 'h', date: '2026-10-15' }, '/routes/': { hash: 'h', date: '2026-10-26' } } };
  const xml = sitemapXml([
    { url: 'https://naarad.io/', address: '/' },
    { url: 'https://naarad.io/routes/', address: '/routes/' },
  ], manifest);
  assert.equal(xml, `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://naarad.io/</loc><lastmod>2026-10-15</lastmod></url>
  <url><loc>https://naarad.io/routes/</loc><lastmod>2026-10-26</lastmod></url>
</urlset>
`);
});

test('a page with no date is listed without a lastmod, and an address is escaped', () => {
  const xml = sitemapXml([{ url: 'https://naarad.io/a?x=1&y=2', address: '/a' }], { pages: {} });
  assert.match(xml, /<loc>https:\/\/naarad\.io\/a\?x=1&amp;y=2<\/loc><\/url>/);
  assert.doesNotMatch(xml, /lastmod/);
});
