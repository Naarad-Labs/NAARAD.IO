/* About, the not-found page, and anything else that is a page of prose,
   usually with a picture. */

import { picture, escapeHtml } from '../media.js';
import { icon } from '../icons.js';
import { sectionPath } from '../urls.js';
import * as Seo from '../seo.js';

const HERO_SIZES = '(max-width: 1023px) 100vw, 46vw';

const PAGES = {
  about: {
    eyebrow: 'About Naarad',
    title: 'Explore. Listen.<br><span class="accent">Connect.</span>',
    lede: 'Naarad is a heritage atlas for India: walking routes with the stories of the places they pass, told at the places themselves.',
    photo: 'hampi-vittala-hall',
    actions: [{ label: 'Explore routes', view: 'routes' }],
    sections: [
      {
        heading: 'What it is',
        body: 'Every route on Naarad carries its real facts: how far it goes, how long it takes, where its stops are and what the ground does between them. Where a route has stops, each one has a story written for it, and you can read or listen to it as you walk.',
      },
      {
        heading: 'Where the data comes from',
        body: 'Route lines through published stops are drawn between their real coordinates and labelled as connecting lines, not surveyed tracks. Elevation profiles are sampled from NASA SRTM 30 m data. Photographs are freely licensed, and every one carries its photographer and licence.',
      },
      {
        heading: 'What is still being built',
        body: 'Creator narration, machine transcription and translation, offline route bundles and accounts need the Naarad backend. Those parts of the interface say so where you meet them, instead of showing something that is not there.',
      },
    ],
  },
  // What 404.html shows for an address that has no page.
  'not-found': {
    eyebrow: 'Page not found',
    title: 'This page is not<br><span class="accent">on the map.</span>',
    lede: 'The address may be mistyped, or the page may have moved. Every route and story on Naarad is listed on the pages below.',
    photo: null,
    actions: [{ label: 'Browse routes', view: 'routes' }, { label: 'Read the stories', view: 'stories' }],
    sections: [],
  },
};

export async function render(context) {
  const page = PAGES[context.view] || PAGES.about;
  return `<div class="info-page">
    <header class="info-hero${page.photo ? '' : ' is-plain'}">
      <div class="info-hero-copy">
        <p class="eyebrow eyebrow-mark">${escapeHtml(page.eyebrow)}</p>
        <h1 class="display">${page.title}</h1>
        <p class="lede">${escapeHtml(page.lede)}</p>
        <div class="info-actions">
          ${page.actions.map((action, index) => `<a class="button${index ? '' : ' button-primary'}" href="${sectionPath(action.view)}" data-view="${action.view}">${escapeHtml(action.label)} ${icon('arrow')}</a>`).join('')}
        </div>
      </div>
      ${page.photo ? `<div class="info-hero-media">
        ${picture(page.photo, { sizes: HERO_SIZES, alt: '', priority: true, credit: true, className: 'torn-left' })}
      </div>` : ''}
    </header>
    ${page.sections.length ? `<div class="info-body">
      ${page.sections.map((section) => `<section>
        <h2 class="eyebrow eyebrow-mark">${escapeHtml(section.heading)}</h2>
        <p>${escapeHtml(section.body)}</p>
      </section>`).join('')}
    </div>` : ''}
  </div>`;
}

export const stylesheet = '/app/info.css';

export function meta({ view } = {}) {
  if (view === 'not-found') {
    // No canonical: this is not a page, and it must never be indexed as one.
    return {
      title: 'Page not found · Naarad',
      description: 'There is no page at this address on Naarad.',
      path: null,
      robots: 'noindex',
    };
  }
  return {
    title: 'About · Naarad',
    description: 'What Naarad is, where its route and elevation data comes from, and what is still being built.',
    path: sectionPath('about'),
    card: Seo.HOME_CARD,
    preload: { photo: PAGES.about.photo, sizes: HERO_SIZES },
    schema: [Seo.breadcrumbs([['About', sectionPath('about')]])],
  };
}
