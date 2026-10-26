/* The address of every page, in one place.
 *
 *   /                       home
 *   /routes/                the route catalogue; ?q= fills its search
 *   /explore/               the same catalogue, canonical to /routes/
 *   /routes/<slug>/         a route; the open stop is a query, ?stop=3
 *   /stories/               the story index
 *   /stories/<slug>/        a story
 *   /creators/  /journey/  /about/
 *   /blog/  /blog/<slug>/   reserved for the blog
 *
 * Views build their links from here and main.js resolves addresses against
 * the same scheme, so a link and the page it opens cannot drift apart. The
 * addresses of the single-document site that came before (/?route=x,
 * /?story=x, /?view=v, and its /route/x and /story/x forms) are converted by
 * legacyTarget().
 */

export const ORIGIN = 'https://naarad.io';

/** Sections with one page each, under /<name>/. */
export const SECTIONS = ['explore', 'routes', 'stories', 'creators', 'journey', 'about'];

const segment = (slug) => encodeURIComponent(String(slug));

export const sectionPath = (name) => (name === 'home' ? '/' : `/${segment(name)}/`);

/** The catalogue, with its search filled in when there is a query. */
export function cataloguePath(query = '', base = '/routes/') {
  return query ? `${base}?${new URLSearchParams({ q: query })}` : base;
}

/** A route page. The first stop is the page itself, so it carries no query. */
export function routePath(slug, stop = null) {
  return `/routes/${segment(slug)}/${stop ? `?stop=${Number(stop)}` : ''}`;
}

export const storyPath = (slug) => `/stories/${segment(slug)}/`;

export const absoluteUrl = (path) => new URL(path, ORIGIN).href;

/**
 * The form a page is known by: /about -> /about/, /index.html -> /,
 * /routes/x/index.html -> /routes/x/. Paths with a file extension are left
 * alone; they are files, not pages.
 */
export function normalPath(pathname) {
  let path = pathname.replace(/\/index\.html$/, '/');
  if (!path.endsWith('/') && !/\.[a-z0-9]+$/i.test(path)) path += '/';
  return path;
}

/**
 * The clean address an old one stands for, or null when the address is not
 * an old one. Takes a URL; returns a path with its query and hash.
 */
export function legacyTarget(url) {
  const params = url.searchParams;
  const hash = url.hash || '';
  const path = url.pathname;

  if (path === '/' || path === '/index.html') {
    const route = params.get('route');
    const story = params.get('story');
    const view = params.get('view');
    if (route) return routePath(route, Number(params.get('stop')) || null) + hash;
    if (story) return storyPath(story) + hash;
    if (view) return (SECTIONS.includes(view) ? sectionPath(view) : '/') + hash;
    // The old header search sent its query to the homepage.
    if (params.get('q')) return cataloguePath(params.get('q')) + hash;
  }

  const old = path.match(/^\/(route|story)\/([^/]+)\/?$/);
  if (old) {
    let slug;
    try { slug = decodeURIComponent(old[2]); } catch { return null; }   // a malformed escape names nothing
    const stop = Number(params.get('stop')) || null;
    return (old[1] === 'route' ? routePath(slug, stop) : storyPath(slug)) + hash;
  }
  return null;
}
