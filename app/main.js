/* Naarad's public experience: one route model, distinct responsive compositions. */
const pageStyles = document.createElement('link');
pageStyles.rel = 'stylesheet';
pageStyles.href = '/app/pages.css';
document.head.append(pageStyles);

const Data = window.NaaradData;
const shell = document.querySelector('#app-content');
const routeMarkup = shell.innerHTML;
const DEFAULT_ROUTE = 'hampi-vijayanagara-circuit';
let routes = [];
let route = null;
let map = null;
let generation = 0;
let lastSearchAt = 0;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const routeHref = (value) => `/?route=${encodeURIComponent(value.slug)}`;
const imageFor = (value) => value.media?.url || '/Images/ansi.webp';
const shortLocation = (value) => value.location || 'India';
const metric = (value, fallback = '—') => value ?? fallback;

function setText(selector, value) { const element = $(selector); if (element) element.textContent = value; }
function setDescription(value) {
  document.title = value;
  const description = $('meta[name="description"]');
  if (description) description.content = value;
}

function showNotice(message) {
  let notice = $('#site-notice');
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'site-notice';
    notice.className = 'site-notice';
    notice.setAttribute('role', 'status');
    document.body.append(notice);
  }
  notice.textContent = message;
  notice.hidden = false;
  clearTimeout(showNotice.timer);
  showNotice.timer = setTimeout(() => { notice.hidden = true; }, 5000);
}

function updateNav(view) {
  $$('[data-view]').forEach((link) => {
    const active = link.dataset.view === view;
    link.classList.toggle('is-current', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  $('.site-header')?.classList.remove('nav-open');
  $('.menu-toggle')?.setAttribute('aria-expanded', 'false');
}

function card(value, index = 0) {
  const distance = Data.formatDistance(value.distanceM);
  const duration = Data.formatDuration(value.durationMin);
  const image = value.media?.url;
  return `<a class="catalogue-card" href="${routeHref(value)}" data-route="${escapeHtml(value.slug)}">
    <span class="catalogue-image">${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async">` : '<span class="catalogue-image-fallback" aria-hidden="true">N</span>'}<span class="catalogue-number">${String(index + 1).padStart(2, '0')}</span></span>
    <span class="catalogue-copy"><span class="eyebrow">${escapeHtml(value.themeLabel || value.sport || 'Explore')}</span><strong>${escapeHtml(value.name)}</strong><span>${escapeHtml(shortLocation(value))}</span><small>${escapeHtml([distance, duration, Data.formatDifficulty(value.difficulty)].filter(Boolean).join(' · '))}</small></span>
    <span class="catalogue-arrow" aria-hidden="true">↗</span>
  </a>`;
}

function homePage() {
  const featured = routes.slice(0, 6);
  return `<section class="editorial-home" aria-labelledby="home-title">
    <div class="home-hero"><img src="/Images/hero-800.webp" srcset="/Images/hero-800.webp 800w, /Images/hero-1600.webp 1600w" sizes="100vw" alt="Historic architecture in warm evening light" fetchpriority="high" decoding="async"><div class="home-hero-shade"></div><div class="home-hero-copy"><p class="eyebrow">A living heritage · A shared human story</p><h1 id="home-title">Every place<br>has a story.</h1><p>Step beyond the postcard. Find routes, listen to local voices, and see India through the stories held in its landscapes.</p><a class="button button-primary" href="/?view=explore" data-view="explore">Explore the routes <span aria-hidden="true">→</span></a></div><span class="home-hero-index">NAARAD FIELD NOTES / 01</span></div>
    <div class="home-intro"><span class="eyebrow">Explore · Listen · Connect</span><h2>The world opens up when you slow down.</h2><p>Choose a place. Follow a real route where one has been published. Make room for the details you might otherwise pass by.</p></div>
    <section class="home-featured"><div class="section-heading"><div><span class="eyebrow">From the atlas</span><h2>Routes to begin with</h2></div><a href="/?view=explore" data-view="explore">View all routes <span aria-hidden="true">→</span></a></div><div class="catalogue-grid">${featured.map(card).join('')}</div></section>
    <section class="home-story"><img src="/Images/Hampi.webp" alt="Stone architecture at Hampi" loading="lazy"><div><span class="eyebrow">Field note · Hampi</span><h2>Some stories are best found on foot.</h2><p>Explore the published route details, inspect its starting point on the map, and discover what is ready for your next visit.</p><a class="text-link" href="/?route=${DEFAULT_ROUTE}" data-route="${DEFAULT_ROUTE}">Open the Hampi route ↗</a></div></section>
  </section>`;
}

function cataloguePage(view = 'explore') {
  return `<section class="catalogue-page" aria-labelledby="catalogue-title"><div class="catalogue-hero"><span class="eyebrow">The Naarad atlas / ${routes.length} routes</span><h1 id="catalogue-title">Go where stories live.</h1><p>Search places and browse published routes across India. Detailed map lines appear only where verified route geometry is available.</p><label class="catalogue-search"><span class="sr-only">Filter routes by place or name</span><input id="catalogue-query" type="search" placeholder="Search routes or places" autocomplete="off"><span aria-hidden="true">⌕</span></label><div class="catalogue-filters" role="group" aria-label="Route type"><button type="button" class="is-active" data-filter="all">All routes</button><button type="button" data-filter="walk">Walk</button><button type="button" data-filter="hike">Hike</button><button type="button" data-filter="cycle">Cycle</button></div></div><div class="section-heading"><div><span class="eyebrow">Curated and community tracks</span><h2 id="catalogue-count">${routes.length} routes</h2></div></div><div id="catalogue-grid" class="catalogue-grid">${routes.map(card).join('')}</div></section>`;
}

function storyPage() {
  return `<section class="editorial-page"><span class="eyebrow">Stories / Field notes</span><h1>Listen closer.</h1><p class="editorial-lede">Places are shaped by the people who know them. Naarad brings route context, local voices, and field notes into one shared atlas.</p><div class="story-feature"><img src="/Images/Hampi.webp" alt="Historic stone architecture at Hampi" loading="lazy"><div><span class="eyebrow">Hampi · Karnataka</span><h2>A landscape of stone and memory</h2><p>The Hampi route is part of the published catalogue. Story audio and ordered stop data will appear here when they are published.</p><a class="text-link" href="/?route=${DEFAULT_ROUTE}" data-route="${DEFAULT_ROUTE}">Explore Hampi ↗</a></div></div></section>`;
}

function infoPage(view) {
  const content = view === 'creators'
    ? { eyebrow: 'Create with Naarad', title: 'Help a place tell its story.', copy: 'Naarad is building a space for local creators to document routes, record context, and share the details visitors miss. Creator publishing is being prepared.' }
    : { eyebrow: 'About Naarad', title: 'Explore. Listen. Connect.', copy: 'Naarad is an atlas for curious travellers: routes, local context, and stories designed to bring people closer to the places they visit.' };
  return `<section class="editorial-page info-page"><span class="eyebrow">${content.eyebrow}</span><h1>${content.title}</h1><p class="editorial-lede">${content.copy}</p><a class="button button-primary" href="/?view=explore" data-view="explore">Explore routes <span aria-hidden="true">→</span></a></section>`;
}

function renderCatalogue(query = '', sport = 'all') {
  const text = query.trim().toLocaleLowerCase();
  const shown = routes.filter((value) => (sport === 'all' || value.sport === sport) &&
    (!text || `${value.name} ${value.location || ''} ${value.themeLabel || ''}`.toLocaleLowerCase().includes(text)));
  setText('#catalogue-count', `${shown.length} ${shown.length === 1 ? 'route' : 'routes'}`);
  $('#catalogue-grid').innerHTML = shown.length ? shown.map(card).join('') : '<p class="catalogue-empty">No routes match that search. Try another place or route type.</p>';
}

function renderRouteInfo(value) {
  const description = Data.getEditorial(value);
  const name = value.name;
  const location = shortLocation(value);
  const distance = metric(Data.formatDistance(value.distanceM));
  const duration = metric(Data.formatDuration(value.durationMin));
  const difficulty = metric(Data.formatDifficulty(value.difficulty));
  setText('#route-title', name);
  setText('.route-location span', location);
  setText('.route-description', description?.body || 'Explore the published route information and map.');
  $$('.route-stats .metric strong').forEach((node, i) => { node.textContent = [distance, duration, difficulty][i]; });
  $$('.route-overview .overview-topline strong').forEach((node, i) => { node.textContent = i === 0 ? metric(Data.formatElevation(value.ascentM)) : metric(Data.formatElevation(value.descentM)); });
  const terrain = $('.terrain-breakdown');
  if (terrain) terrain.innerHTML = '<p class="data-note">Surface breakdown has not been published for this route.</p>';
  const tagList = $('.tag-list');
  if (tagList) tagList.innerHTML = [value.themeLabel, value.sport && Data.formatDifficulty(value.sport), value.difficulty && Data.formatDifficulty(value.difficulty)].filter(Boolean).map((tag) => `<li>${escapeHtml(tag)}</li>`).join('');
  setText('#stops-title', value.stops.length ? `Story stops (${value.stops.length})` : 'Story stops');
  $('#route-stops').innerHTML = value.stops.length
    ? value.stops.map((stop, index) => `<li class="stop-card" data-stop="${index}"><span class="stop-number">${index + 1}</span><div class="stop-copy"><h3>${escapeHtml(stop.name || stop.title || `Stop ${index + 1}`)}</h3><p>${escapeHtml(stop.description || '')}</p></div></li>`).join('')
    : '<li class="empty-stop"><span class="eyebrow">Stories in progress</span><p>Ordered story stops and narration have not been published for this route yet.</p></li>';
  const playAll = $('#play-all');
  if (playAll) { playAll.disabled = !value.stops.some((stop) => stop.audioUrl); playAll.title = playAll.disabled ? 'Audio is not available for this route yet' : 'Play all stories'; }
  setText('.sheet-route-title h1', name);
  setText('.sheet-route-title .eyebrow', location);
  setText('.sheet-description', description?.body || 'Explore this route.');
  $$('.sheet-metrics b').forEach((node, i) => { node.textContent = [distance, duration, difficulty][i]; });
  const preview = $('.mobile-stops-preview');
  if (preview) { preview.classList.add('is-empty'); preview.innerHTML = '<div><span class="eyebrow">Story stops</span><h2>Coming into focus</h2><p>Audio and ordered stops have not been published for this route.</p></div>'; }
  const tabs = $('#route-tabs');
  if (tabs) { const first = $('button', tabs); if (first) first.textContent = value.stops.length ? `Stops ${value.stops.length}` : 'Route details'; }
  const elevation = $('#elevation-profile');
  if (elevation) { elevation.setAttribute('role', 'status'); elevation.removeAttribute('aria-label'); elevation.innerHTML = '<p class="data-note">An elevation profile will appear when measured route samples are published.</p>'; }
  const elevationMetrics = $('.elevation-metrics');
  if (elevationMetrics) elevationMetrics.innerHTML = `<span><b>${escapeHtml(metric(Data.formatElevation(value.ascentM)))}</b> Ascent</span><span><b>${escapeHtml(distance)}</b> Route distance</span><span><b>${escapeHtml(duration)}</b> Estimated time</span>`;
  const compare = $('.compare-card');
  if (compare) {
    const others = routes.filter((candidate) => candidate.slug !== value.slug && candidate.media?.url).slice(0, 2);
    $('#route-comparisons', compare)?.remove();
    $$('.route-card', compare).forEach((node) => node.remove());
    compare.insertAdjacentHTML('beforeend', [value, ...others].map((candidate, index) => `<a class="route-card ${index === 0 ? 'is-selected' : ''}" href="${routeHref(candidate)}" data-route="${escapeHtml(candidate.slug)}"><img src="${escapeHtml(imageFor(candidate))}" alt="" loading="lazy"><span class="route-card-copy">${index === 0 ? '<span class="route-card-label">Current route</span>' : ''}<strong>${escapeHtml(candidate.name)}</strong><small>${escapeHtml([Data.formatDistance(candidate.distanceM), Data.formatDuration(candidate.durationMin)].filter(Boolean).join(' · '))}</small></span><span class="route-radio" aria-hidden="true"></span></a>`).join(''));
  }
  const story = $('.story-panel');
  if (story) {
    const img = $('img', story);
    if (img) { img.src = imageFor(value); img.alt = value.media?.alt || ''; }
    const para = $('p:last-child', story);
    if (para) para.textContent = description?.body || '';
  }
  setText('.mobile-route-bar strong', name);
  setText('.mobile-route-bar .eyebrow', location);
  setText('.map-loading p', 'Preparing your map…');
  const mapSearch = $('#map-search-input');
  if (mapSearch) mapSearch.placeholder = 'Search a place on the map…';
  const mapSearchLabel = $('label[for="map-search-input"]');
  if (mapSearchLabel) mapSearchLabel.textContent = 'Search a place on the map';
  const mapNode = $('#map');
  if (mapNode) mapNode.setAttribute('aria-label', `${name} map`);
  setDescription(`${name} · Naarad`);
}

async function showRoute(slug, push = true) {
  const current = ++generation;
  map?.destroy(); map = null;
  route = await Data.getRoute(slug) || await Data.getRoute(DEFAULT_ROUTE);
  if (current !== generation || !route) return;
  shell.className = 'route-layout';
  shell.innerHTML = routeMarkup;
  document.body.dataset.view = 'route';
  renderRouteInfo(route);
  updateNav('routes');
  if (push) history.pushState({ route: route.slug }, '', routeHref(route));
  window.scrollTo(0, 0);
  try {
    const { mountRouteMap } = await import('./map.js');
    if (current !== generation) return;
    const controller = await mountRouteMap($('#map'), route, { initialLayer: 'satellite', onSelectStop: (stop) => showNotice(stop.name || stop.title || 'Story stop') });
    if (current !== generation) controller.destroy();
    else map = controller;
  } catch (error) {
    console.error('Map unavailable', error);
    const mapNode = $('#map');
    if (mapNode) mapNode.innerHTML = '<p class="map-unavailable">The interactive map is unavailable. Route details are still here.</p>';
  }
}

function showView(view, push = true) {
  ++generation;
  map?.destroy(); map = null; route = null;
  document.body.dataset.view = view;
  shell.className = view === 'home' ? 'home-layout' : 'editorial-layout';
  shell.innerHTML = view === 'home' ? homePage() : view === 'stories' ? storyPage() : view === 'creators' || view === 'about' ? infoPage(view) : cataloguePage(view);
  updateNav(view);
  setDescription(`${view.charAt(0).toUpperCase() + view.slice(1)} · Naarad`);
  if (push) history.pushState({ view }, '', view === 'home' ? '/' : `/?view=${encodeURIComponent(view)}`);
  window.scrollTo(0, 0);
}

function navigateFromUrl(push = false) {
  const params = new URLSearchParams(location.search);
  const selectedRoute = params.get('route');
  const view = params.get('view');
  if (selectedRoute) return showRoute(selectedRoute, push);
  if (view && ['home', 'explore', 'routes', 'stories', 'creators', 'about'].includes(view)) return showView(view, push);
  return showRoute(DEFAULT_ROUTE, push);
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-route], a[data-view], .back-link, .mobile-back');
  if (link && !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    if (link.dataset.route) showRoute(link.dataset.route);
    else showView(link.dataset.view || 'routes');
    return;
  }
  if (event.target.closest('.menu-toggle')) {
    const open = $('.site-header')?.classList.toggle('nav-open');
    $('.menu-toggle')?.setAttribute('aria-expanded', String(!!open));
  }
  if (event.target.closest('#fit-route')) map?.fit();
  if (event.target.closest('#map-satellite')) {
    const button = $('#map-satellite');
    const satellite = button?.getAttribute('aria-pressed') !== 'true';
    map?.setLayer(satellite ? 'satellite' : 'street');
    button?.setAttribute('aria-pressed', String(satellite));
    if (button) button.lastElementChild.textContent = satellite ? 'Satellite' : 'Street';
  }
  if (event.target.closest('#map-layers')) {
    const button = $('#map-satellite');
    const satellite = button?.getAttribute('aria-pressed') !== 'true';
    map?.setLayer(satellite ? 'satellite' : 'street');
    button?.setAttribute('aria-pressed', String(satellite));
    if (button) button.lastElementChild.textContent = satellite ? 'Satellite' : 'Street';
  }
  if (event.target.closest('[data-map-zoom="in"]')) map?.zoomIn();
  if (event.target.closest('[data-map-zoom="out"]')) map?.zoomOut();
  if (event.target.closest('.map-location')) map?.locate();
  if (event.target.closest('.sheet-expand')) {
    const expanded = $('.mobile-map-sheet')?.classList.toggle('is-expanded');
    $('.sheet-expand')?.setAttribute('aria-label', expanded ? 'Collapse route details' : 'Expand route details');
  }
  if (event.target.closest('.mobile-share') && navigator.share && route) navigator.share({ title: route.name, url: location.href }).catch(() => {});
  else if (event.target.closest('.mobile-share')) navigator.clipboard?.writeText(location.href).then(() => showNotice('Route link copied.')).catch(() => showNotice('Could not copy the link.'));
  if (event.target.closest('.stop-play, #play-all')) showNotice('Audio is not available for this route yet.');
  const filterButton = event.target.closest('[data-filter]');
  if (filterButton) {
    $$('.catalogue-filters button').forEach((button) => button.classList.toggle('is-active', button === filterButton));
    renderCatalogue($('#catalogue-query')?.value || '', filterButton.dataset.filter);
  }
  const tab = event.target.closest('#route-tabs button');
  if (tab) {
    $$('#route-tabs button').forEach((button) => { const active = button === tab; button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active)); });
    const label = tab.textContent.trim().toLowerCase();
    if (label.includes('overview')) $('.route-overview')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else if (label.includes('stories')) $('.story-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else $('#route-stops')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'catalogue-query') renderCatalogue(event.target.value, $('.catalogue-filters .is-active')?.dataset.filter || 'all');
});

document.addEventListener('submit', async (event) => {
  if (event.target.classList.contains('header-search')) {
    event.preventDefault();
    showView('explore');
    const input = $('#catalogue-query');
    if (input) { input.value = $('#route-search')?.value || ''; renderCatalogue(input.value); input.focus(); }
  }
  if (!event.target.classList.contains('map-search')) return;
  event.preventDefault();
  const query = $('#map-search-input')?.value.trim();
  if (!query || !map) return;
  const now = Date.now();
  if (now - lastSearchAt < 1100) { showNotice('Please wait a moment before searching again.'); return; }
  lastSearchAt = now;
  showNotice('Looking for that place…');
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query.slice(0, 120))}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Search unavailable');
    const result = (await response.json())[0];
    if (!result || !map?.flyTo(Number(result.lat), Number(result.lon))) showNotice('Place not found. Try a nearby landmark.');
    else showNotice(result.display_name || 'Map moved to the place.');
  } catch { showNotice('Place search is unavailable right now.'); }
});

window.addEventListener('popstate', () => navigateFromUrl(false));

try {
  routes = await Data.loadRoutes();
  await navigateFromUrl(false);
} catch (error) {
  console.error('Route data unavailable', error);
  shell.innerHTML = '<section class="load-error"><span class="eyebrow">The atlas is resting</span><h1>Routes could not be loaded.</h1><p>Check your connection and try again.</p><button class="button button-primary" type="button" id="retry-load">Try again</button></section>';
  $('#retry-load')?.addEventListener('click', () => location.reload());
}
