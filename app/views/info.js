/* About, and anything else that is a page of prose with a picture. */

import { picture, escapeHtml } from '../media.js';
import { icon } from '../icons.js';

const PAGES = {
  about: {
    eyebrow: 'About Naarad',
    title: 'Explore. Listen.<br><span class="accent">Connect.</span>',
    lede: 'Naarad is a heritage atlas for India: walking routes with the stories of the places they pass, told at the places themselves.',
    photo: 'hampi-vittala-hall',
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
};

export async function render(context) {
  const page = PAGES[context.view] || PAGES.about;
  return `<div class="info-page">
    <header class="info-hero">
      <div class="info-hero-copy">
        <p class="eyebrow eyebrow-mark">${escapeHtml(page.eyebrow)}</p>
        <h1 class="display">${page.title}</h1>
        <p class="lede">${escapeHtml(page.lede)}</p>
        <a class="button button-primary" href="/?view=routes" data-view="routes">Explore routes ${icon('arrow')}</a>
      </div>
      <div class="info-hero-media">
        ${picture(page.photo, { sizes: '(max-width: 1023px) 100vw, 46vw', alt: '', priority: true, credit: true, className: 'torn-left' })}
      </div>
    </header>
    <div class="info-body">
      ${page.sections.map((section) => `<section>
        <h2 class="eyebrow eyebrow-mark">${escapeHtml(section.heading)}</h2>
        <p>${escapeHtml(section.body)}</p>
      </section>`).join('')}
    </div>
  </div>`;
}

export const stylesheet = '/app/info.css';
export const meta = {
  title: 'About · Naarad',
  description: 'What Naarad is, where its route and elevation data comes from, and what is still being built.',
};
