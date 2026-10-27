/* Story: a magazine spread on desktop, a readable single column on a phone.
   The left rail tracks the reader's position; the right rail keeps the route
   the story belongs to within reach. */

import { picture, creditText, escapeHtml, photoPath } from '../media.js';
import { icon } from '../icons.js';
import * as Data from '../data.js';
import { routePreview } from '../previews.js';
import { routePath, storyPath, sectionPath, absoluteUrl } from '../urls.js';
import * as Seo from '../seo.js';

const HERO_SIZES = '(max-width: 1023px) 100vw, 58vw';

let loading = null;

/** Every story. A file that cannot be read rejects, and is read again next time. */
export function loadStories() {
  loading ||= readStories().catch((error) => { loading = null; throw error; });
  return loading;
}

async function readStories() {
  const response = await fetch('/content/stories.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`/content/stories.json: ${response.status}`);
  try { return (await response.json()).stories || []; } catch (error) { throw new Error(`/content/stories.json: ${error.message}`); }
}

export async function getStory(slug) {
  const all = await loadStories();
  return all.find((story) => story.slug === slug) || null;
}

const wordCount = (story) => story.sections
  .reduce((sum, section) => sum + section.body.join(' ').split(/\s+/).length, 0);

export const readingMinutes = (story) => Math.max(1, Math.round(wordCount(story) / 220));
export const listeningMinutes = (story) => Math.max(1, Math.round(wordCount(story) / 150));

/** The plain text a story is read aloud from. */
export function storyText(story) {
  return story.sections
    .map((section) => `${section.heading}. ${section.body.join(' ')}`)
    .join(' ');
}

function section(entry) {
  return `<section class="story-section" id="${escapeHtml(entry.id)}">
    ${entry.eyebrow ? `<p class="eyebrow eyebrow-mark">${escapeHtml(entry.eyebrow)}</p>` : ''}
    <h2>${escapeHtml(entry.heading)}</h2>
    ${entry.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
    ${entry.photo ? `<figure class="story-figure">
      ${picture(entry.photo, { sizes: '(max-width: 1023px) 100vw, 620px', alt: entry.caption || entry.heading, ratio: '3 / 2' })}
      <figcaption class="caption">${icon('camera')}<span>${escapeHtml(entry.caption || '')} <b>${escapeHtml(creditText(entry.photo))}</b></span></figcaption>
    </figure>` : ''}
    ${entry.pullQuote ? `<blockquote class="story-pull">
      ${icon('quote')}
      <p>${escapeHtml(entry.pullQuote.text)}</p>
      <cite>${escapeHtml(entry.pullQuote.source)}</cite>
    </blockquote>` : ''}
  </section>`;
}

function routeAside(story, route) {
  if (!route) return '';
  const preview = routePreview(route, { width: 300, height: 120, numbered: true });
  return `<div class="story-route-card">
    <p class="eyebrow-ink eyebrow">This story is part of</p>
    <div class="story-route-head">
      <div>
        <strong>${escapeHtml(route.name)}</strong>
        <small>${escapeHtml(route.region || route.location || '')}</small>
      </div>
      ${route.media?.card ? picture(route.media.card, { sizes: '64px', alt: '', ratio: '1 / 1', className: 'story-route-thumb' }) : ''}
    </div>
    <div class="story-route-metrics">
      ${[['walk', Data.formatDistance(route.distanceM)], ['pin', route.stopCount ? `${route.stopCount} stops` : null], ['clock', Data.formatDuration(route.durationMin)]]
    .filter(([, value]) => value)
    .map(([name, value]) => `<span>${icon(name)}${escapeHtml(value)}</span>`).join('')}
    </div>
    ${route.stops?.length ? `<ol class="story-route-pips" aria-label="Stops on this route">
      ${route.stops.map((stop) => `<li class="${story.stopOrder === stop.order ? 'is-current' : ''}">
        <a href="${routePath(route.slug, stop.order === route.stops[0].order ? null : stop.order)}" data-route="${escapeHtml(route.slug)}" data-stop="${stop.order}" title="${escapeHtml(stop.name)}">${stop.order}</a>
      </li>`).join('')}
    </ol>` : ''}
    ${preview ? `<div class="story-route-map">${preview}</div>` : ''}
    <a class="button button-sm story-route-cta" href="${routePath(route.slug)}" data-route="${escapeHtml(route.slug)}">View Full Route ${icon('arrow')}</a>
  </div>`;
}

async function relatedAside(story, all) {
  const related = all.filter((candidate) => candidate.slug !== story.slug).slice(0, 3);
  if (!related.length) return '';
  return `<div class="story-related">
    <div class="story-related-head">
      <h2 class="eyebrow eyebrow-mark">Related stories</h2>
      <a class="icon-button" href="${sectionPath('stories')}" data-view="stories" aria-label="All stories">${icon('arrow')}</a>
    </div>
    <ul>
      ${related.map((candidate) => `<li>
        <a href="${storyPath(candidate.slug)}" data-story="${escapeHtml(candidate.slug)}">
          ${picture(candidate.heroPhoto, { sizes: '96px', alt: '', ratio: '4 / 3' })}
          <span>
            <b>${escapeHtml(candidate.title)}</b>
            <small>${icon('book')}${readingMinutes(candidate)} min read ${icon('headphones')}${listeningMinutes(candidate)} min listen</small>
          </span>
        </a>
      </li>`).join('')}
    </ul>
  </div>`;
}

export async function render(context) {
  const story = context.story;
  const all = await loadStories();
  const route = story.route ? await Data.getRoute(story.route) : null;
  const related = await relatedAside(story, all);
  const title = story.titleAccent && story.title.endsWith(story.titleAccent)
    ? `${escapeHtml(story.title.slice(0, -story.titleAccent.length))}<span class="accent">${escapeHtml(story.titleAccent)}</span>`
    : escapeHtml(story.title);

  return `<article class="story-page">
    <header class="story-hero">
      <div class="story-hero-copy">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a href="${sectionPath('stories')}" data-view="stories">Stories</a>${icon('chevron')}
          <b aria-current="page">${escapeHtml(route?.name || story.location)}</b>
        </nav>
        <h1>${title}</h1>
        <p class="story-standfirst">${escapeHtml(story.standfirst)}</p>
        <div class="story-meta">
          <span>${icon('pin')}${escapeHtml(story.location)}</span>
          <span>${icon('book')}${readingMinutes(story)} min read</span>
          <span>${icon('headphones')}${listeningMinutes(story)} min listen</span>
        </div>
        <div class="story-byline">
          <span class="byline-mark" aria-hidden="true"><img src="/Images/cropped_logo.png" alt=""></span>
          <span class="byline-copy"><small>Written by</small><b>Naarad editorial</b></span>
        </div>
      </div>
      <div class="story-hero-media">
        ${picture(story.heroPhoto, {
    sizes: HERO_SIZES,
    alt: story.title, priority: true, credit: true, className: 'story-hero-photo',
  })}
      </div>
    </header>

    <div class="story-body">
      <aside class="story-rail" aria-label="On this page">
        <nav class="story-toc">
          <h2 class="eyebrow-ink eyebrow">On this page</h2>
          <ol>
            ${story.sections.map((entry, index) => `<li><a href="#${escapeHtml(entry.id)}" data-toc="${escapeHtml(entry.id)}" class="${index === 0 ? 'is-current' : ''}">${escapeHtml(entry.heading)}</a></li>`).join('')}
          </ol>
        </nav>
        <ul class="story-actions">
          <li><button type="button" data-action="listen-story">${icon('headphones')} Listen to this story</button></li>
          <li><button type="button" data-action="share">${icon('share')} Share</button></li>
          <li><button type="button" data-action="journal" data-route="${escapeHtml(route?.slug || '')}">${icon('edit')} Add to journal</button></li>
          ${route ? `<li><a href="${routePath(route.slug)}" data-route="${escapeHtml(route.slug)}">${icon('map')} View on route</a></li>` : ''}
        </ul>
      </aside>

      <div class="story-content">
        ${story.sections.map(section).join('')}
        <footer class="story-footer">
          <p class="data-note">Written for Naarad${story.published ? ` · published ${escapeHtml(story.published)}` : ''}. Photographs are credited where they appear.</p>
        </footer>
      </div>

      <aside class="story-aside">
        ${routeAside(story, route)}
        ${related}
      </aside>
    </div>
  </article>`;
}

export const stylesheet = '/app/story.css';

const imageUrl = (id) => {
  const path = id ? photoPath(id) : null;
  return path ? absoluteUrl(path) : null;
};

/** A date only when the content records one; nothing is filled in. */
const publishedDate = (story) => (/^\d{4}-\d{2}-\d{2}$/.test(story.published || '') ? story.published : null);

export async function meta({ story }) {
  const path = storyPath(story.slug);
  const url = absoluteUrl(path);
  const route = story.route ? await Data.getRoute(story.route) : null;
  const stop = route ? Data.getStop(route, story.stopOrder) : null;
  const routeUrl = route ? absoluteUrl(routePath(route.slug)) : null;
  const card = {
    name: `story-${story.slug}`,
    eyebrow: story.location,
    title: story.title,
    facts: [`${readingMinutes(story)} min read`, 'Naarad editorial'],
    photo: story.heroPhoto,
    route: null,
    alt: `${story.title}: the Naarad title card, set on the story's lead photograph.`,
  };
  const article = Seo.compact({
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: story.title,
    description: story.standfirst,
    url,
    mainEntityOfPage: url,
    inLanguage: Seo.LANGUAGE,
    image: [imageUrl(story.heroPhoto), absoluteUrl(Seo.cardPath(card.name))].filter(Boolean),
    author: { '@type': 'Organization', name: 'Naarad editorial', url: absoluteUrl(sectionPath('about')) },
    publisher: { '@id': Seo.ORG_ID },
    datePublished: publishedDate(story),
    about: route ? { '@type': 'TouristTrip', '@id': `${routeUrl}#trip`, name: route.name, url: routeUrl } : null,
    mentions: stop ? [{
      '@type': 'TouristAttraction',
      '@id': `${routeUrl}#stop-${stop.order}`,
      name: stop.name,
      url: absoluteUrl(routePath(route.slug, stop.order === route.stops[0].order ? null : stop.order)),
    }] : null,
  });
  return {
    title: `${story.title} · Naarad`,
    description: story.standfirst,
    path,
    type: 'article',
    published: publishedDate(story),
    card,
    preload: story.heroPhoto ? { photo: story.heroPhoto, sizes: HERO_SIZES } : null,
    schema: [Seo.breadcrumbs([['Stories', sectionPath('stories')], [story.title, path]]), article, Seo.organization()],
  };
}

/** The Stories index, when no single story is selected. */
export async function renderIndex() {
  const all = await loadStories();
  const lead = all[0];
  if (!lead) {
    return `<div class="story-index"><div class="empty-state">${icon('book')}<div>
      <strong>No stories published yet</strong><p>Stories appear here as they are written.</p></div></div></div>`;
  }
  const rest = all.slice(1);
  return `<div class="story-index">
    <header class="story-index-hero">
      <p class="eyebrow eyebrow-mark">Stories · Field notes</p>
      <h1 class="display">Listen closer.</h1>
      <p class="lede">Short written stories about the places on Naarad's routes: what happened there, who built it, and what is left to see.</p>
    </header>
    <a class="story-lead" href="${storyPath(lead.slug)}" data-story="${escapeHtml(lead.slug)}">
      ${picture(lead.heroPhoto, { sizes: '(max-width: 1023px) 100vw, 60vw', alt: lead.title, ratio: '16 / 9' })}
      <div>
        <p class="eyebrow eyebrow-mark">${escapeHtml(lead.location)}</p>
        <h2>${escapeHtml(lead.title)}</h2>
        <p>${escapeHtml(lead.standfirst)}</p>
        <span class="text-link">Read the story ${icon('arrow')}</span>
      </div>
    </a>
    <div class="story-grid">
      ${rest.map((story) => `<a class="story-card" href="${storyPath(story.slug)}" data-story="${escapeHtml(story.slug)}">
        ${picture(story.heroPhoto, { sizes: '(max-width: 1023px) 100vw, 420px', alt: story.title, ratio: '3 / 2' })}
        <span class="story-card-copy">
          <span class="eyebrow eyebrow-mark">${escapeHtml(story.location)}</span>
          <strong>${escapeHtml(story.title)}</strong>
          <small>${escapeHtml(story.standfirst.slice(0, 120))}…</small>
          <span class="story-card-meta">${icon('book')}${readingMinutes(story)} min read ${icon('headphones')}${listeningMinutes(story)} min listen</span>
        </span>
      </a>`).join('')}
    </div>
  </div>`;
}

export async function indexMeta() {
  const all = await loadStories();
  const lead = all[0];
  return {
    title: 'Stories · Naarad',
    description: 'Short heritage stories from the places on Naarad’s walking routes.',
    path: sectionPath('stories'),
    card: {
      name: 'stories',
      eyebrow: 'Stories · Field notes',
      title: 'Listen closer.',
      facts: [`${all.length} ${all.length === 1 ? 'story' : 'stories'} from Naarad editorial`],
      photo: lead?.heroPhoto || null,
      route: null,
      alt: `Listen closer: Naarad's stories${lead ? `, set on the lead photograph of ${lead.title}` : ''}.`,
    },
    schema: [Seo.breadcrumbs([['Stories', sectionPath('stories')]])],
  };
}
