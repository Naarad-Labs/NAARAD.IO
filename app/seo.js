/* What a page says about itself to search engines and link previews.
 *
 * A view's meta() returns:
 *   title, description   the <title> and the description everyone reads
 *   path                 the canonical address; null for the not-found page
 *   robots               'noindex' for a page that must stay out of search
 *   type                 Open Graph type: 'website' (default) or 'article'
 *   published            an ISO date, only when the content records one
 *   card                 the share card: { name, alt, eyebrow, title, facts,
 *                        photo, route }; scripts/build-site.mjs draws it into
 *                        Images/og/<name>.jpg
 *   preload              { photo, sizes } for the page's hero photograph
 *   schema               JSON-LD nodes, without @context
 * main.js turns that into the head (setMeta). The helpers here are the parts
 * every page shares: the site and organisation nodes, breadcrumbs, and the
 * address of a share card.
 */

import { ORIGIN, absoluteUrl } from './urls.js';

export const SITE_NAME = 'Naarad';
export const ORG_ID = `${ORIGIN}/#organization`;
export const SITE_ID = `${ORIGIN}/#website`;
export const LANGUAGE = 'en-IN';

/* The narration is the device's own speech synthesis reading written text;
   nothing on the site is a recording yet, and the copy says so. */
export const SITE_DESCRIPTION = 'Heritage walking routes across India with real route data and a written story for each stop, which your phone can read aloud as you walk.';

/** Share cards are 1200 x 630 JPEGs drawn by the build into Images/og/. */
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;
export const cardPath = (name) => `/Images/og/${name}.jpg`;

/** The homepage card, which pages without a card of their own share. */
export const HOME_CARD = Object.freeze({
  name: 'home',
  eyebrow: 'Heritage walks across India',
  title: 'Walk a place. Hear its story.',
  facts: [],
  photo: 'hampi-landscape',
  route: null,
  alt: 'Naarad: Walk a place. Hear its story. Set on a photograph of the boulder landscape of Hampi, Karnataka.',
});

export function organization() {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE_NAME,
    url: absoluteUrl('/'),
    logo: { '@type': 'ImageObject', url: absoluteUrl('/Images/naarad-icon-512.png'), width: 512, height: 512 },
  };
}

/** The site, with the catalogue search as its search action. */
export function website() {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: absoluteUrl('/'),
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    inLanguage: LANGUAGE,
    publisher: { '@id': ORG_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${absoluteUrl('/routes/')}?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** A BreadcrumbList from [name, path] pairs, starting at the homepage. */
export function breadcrumbs(trail) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [['Home', '/'], ...trail].map(([name, path], index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item: absoluteUrl(path),
    })),
  };
}

/** Drop the keys whose value is null, undefined or an empty list. */
export function compact(node) {
  return Object.fromEntries(Object.entries(node).filter(([, value]) => (
    value != null && !(Array.isArray(value) && !value.length)
  )));
}
