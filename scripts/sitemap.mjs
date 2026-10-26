/* The sitemap and its <lastmod> dates, as pure functions (no clock, no git, no
 * files) so tests/sitemap.test.mjs can run them and scripts/build-site.mjs
 * only has to feed them.
 *
 * A page's date is the day its content last changed, and the build remembers it
 * in content/lastmod.json: for every indexable page, a hash of what the page
 * says and the date that hash was first seen. A build keeps a page's date while
 * its hash is the same and gives it the build date only when the hash differs.
 * Nothing depends on git history, so a shallow clone, a rebase or a checkout
 * with no .git directory builds the same file.
 */

import crypto from 'node:crypto';

export const MANIFEST_NOTE = 'Written by scripts/build-site.mjs. For each page in the sitemap: a hash of what the page says (its main content and the head tags it owns) and the date that hash was first built. The sitemap\'s lastmod is that date; it moves only when the hash does.';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * What a page says: the head tags it owns (title and description, canonical,
 * share tags, JSON-LD) and its main content. The header, footer and scripts
 * that every page shares are left out, so changing them dates no page.
 */
export function pageContent(html) {
  const main = html.match(/<main id="app-content"[\s\S]*?<\/main>/);
  if (!main) throw new Error('no <main id="app-content"> in the page');
  const title = html.match(/<title>[\s\S]*?<\/title>/)?.[0] || '';
  const owned = html.match(/<(?:meta|link)\b[^>]*\sdata-page=""[^>]*>|<script\b[^>]*\sdata-page=""[^>]*>[\s\S]*?<\/script>/g) || [];
  return [title, ...owned, main[0]].join('\n');
}

export const contentHash = (html) => crypto.createHash('sha256').update(pageContent(html)).digest('hex');

/**
 * The manifest after a build.
 *   previous  the committed manifest, or null
 *   hashes    { address: hash } for every page that goes in the sitemap
 *   today     () => 'YYYY-MM-DD', called only when some page is new or changed
 */
export function nextManifest(previous, hashes, today) {
  const before = previous && typeof previous.pages === 'object' && previous.pages ? previous.pages : {};
  let date = null;
  const pages = {};
  for (const address of Object.keys(hashes).sort()) {
    const known = before[address];
    if (known && known.hash === hashes[address] && DATE.test(known.date)) {
      pages[address] = { hash: known.hash, date: known.date };
      continue;
    }
    if (date === null) {
      date = today();
      if (!DATE.test(date)) throw new Error(`the build date must be YYYY-MM-DD, got "${date}"`);
    }
    pages[address] = { hash: hashes[address], date };
  }
  return { note: MANIFEST_NOTE, pages };
}

const escapeXml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** sitemap.xml for [{ url, address }] in order, dated from the manifest. */
export function sitemapXml(entries, manifest) {
  const rows = entries.map(({ url, address }) => {
    const date = manifest.pages[address]?.date;
    return `  <url><loc>${escapeXml(url)}</loc>${date ? `<lastmod>${date}</lastmod>` : ''}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
}
