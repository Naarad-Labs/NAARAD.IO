/* Naarad Discover: find routes near a place, narrow them, compare them on a map.
 *
 * Screens built here: S01 results and map, S02 filters, S03 place search.
 * Layout on a phone follows replica/screens-notes.md: a search pill and three chips float over a full-bleed
 * map, results sit in a bottom sheet, and a Map button comes back from the full-height list. From 900px
 * up the controls sit in a bar above a list column and the map.
 * Components come from primitives.css (specs: replica/design/components.md).
 * Data comes from window.NaaradDiscoverData only (data.js), so swapping the local
 * seed for Supabase changes nothing in this file.
 *
 * Everything a tour carries (names, places) is set with textContent, never as HTML.
 */
(function () {
  'use strict';

  var Data = window.NaaradDiscoverData;
  var mount = document.getElementById('nd-root');
  if (!mount || !Data) return;

  /* ---------------------------------------------------------------- copy */

  // Icons: outline, 2px stroke, round caps, drawn for this file (brand kit, "Iconography").
  var ICON = {
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    locate: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    walk: '<circle cx="13" cy="4.5" r="1.8"/><path d="M12.5 8l-2.5 4.5 3.5 2.5 1 5M10 12.5L7 14M14 14.5l3 1.5M10 12.5l-1.5 6.5"/>',
    radius: '<circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="10" stroke-dasharray="2 3"/>',
    funnel: '<path d="M3 5h18l-7 8.5V20l-4-2v-4.5z"/>',
    clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 3h5"/>',
    length: '<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
    ascent: '<path d="M5 19L19 5M10 5h9v9"/>',
    star: '<path fill="currentColor" d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>',
    flower: '<circle cx="12" cy="12" r="1.6"/>' + [0, 45, 90, 135, 180, 225, 270, 315].map(function (a) {
      return '<ellipse cx="12" cy="6.2" rx="1.8" ry="3.6" transform="rotate(' + a + ' 12 12)"/>';
    }).join('')
  };
  function icon(name, cls) {
    return '<svg class="nd-icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICON[name] + '</svg>';
  }

  var SPORTS = [['', 'Any'], ['walk', 'Walk'], ['hike', 'Hike'], ['cycle', 'Cycle'], ['run', 'Run']];
  var THEMES = [
    ['heritage-walk', 'Heritage walk'], ['temple-trail', 'Temple trail'], ['nature-hike', 'Nature hike'],
    ['cultural-tour', 'Cultural tour'], ['coastal-walk', 'Coastal walk'], ['photography', 'Photography']
  ];
  var DIFFICULTIES = [['easy', 'Easy'], ['moderate', 'Moderate'], ['hard', 'Hard']];

  // Curated routes that have a full page today. Removed when get_tour and a real tour page (S04) exist.
  var ROUTE_PAGES = {
    'hampi-vijayanagara-circuit': 'hampi', 'thanjavur-brihadeeswarar-trail': 'thanjavur',
    'iit-madras-forest-loop': 'iitmadras', 'mysore-palace-heritage-walk': 'mysore',
    'varanasi-ghats-dawn-walk': 'varanasi', 'jaipur-pink-city-cycling': 'jaipur'
  };

  var DEFAULTS = { radiusKm: 30, longestKm: 200 };  // longest at its maximum means "any length"
  var PAGE_SIZE = 50;                               // the most search_tours returns; 21 routes today
  var INDIA = { lat: 20.5937, lng: 78.9629, zoom: 5 };
  var WIDE = '(min-width: 900px)';

  /* --------------------------------------------------------------- state */

  var state = { q: '', lat: null, lng: null, radiusKm: DEFAULTS.radiusKm, sport: '', themes: [], diff: [], longestKm: DEFAULTS.longestKm };
  var rows = [];            // the current results
  var selectedId = null;
  var requestNo = 0;
  var active = true;        // Discover is the visible planner mode
  var map = null, layerGroup = null, layers = {}, mapFailed = false;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function oneOf(list, value) { return list.some(function (x) { return x[0] === value; }); }
  function clamp(n, lo, hi) { return Math.min(Math.max(n, lo), hi); }

  function readUrl() {
    var p = new URLSearchParams(window.location.search);
    var lat = parseFloat(p.get('lat')), lng = parseFloat(p.get('lng'));
    if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) { state.lat = lat; state.lng = lng; }
    if (p.get('q')) state.q = p.get('q').slice(0, 80);
    var r = parseInt(p.get('r'), 10); if (isFinite(r)) state.radiusKm = clamp(r, 5, 200);
    var m = parseInt(p.get('max'), 10); if (isFinite(m)) state.longestKm = clamp(m, 5, 200);
    if (oneOf(SPORTS, p.get('sport') || '')) state.sport = p.get('sport') || '';
    state.themes = (p.get('theme') || '').split(',').filter(function (t) { return oneOf(THEMES, t); });
    state.diff = (p.get('diff') || '').split(',').filter(function (d) { return oneOf(DIFFICULTIES, d); });
    if (state.lat == null) state.q = '';
  }

  // Search state lives on /?page=planner&..., which index.html serves directly. Path-style URLs
  // would lose it: 404.html rewrites unknown paths and drops the query string.
  function writeUrl() {
    if (!active || !document.getElementById('page-planner').classList.contains('active')) return;
    var p = new URLSearchParams({ page: 'planner', mode: 'discover' });
    if (state.lat != null) { p.set('lat', state.lat.toFixed(5)); p.set('lng', state.lng.toFixed(5)); if (state.q) p.set('q', state.q); if (state.radiusKm !== DEFAULTS.radiusKm) p.set('r', state.radiusKm); }
    if (state.sport) p.set('sport', state.sport);
    if (state.themes.length) p.set('theme', state.themes.join(','));
    if (state.diff.length) p.set('diff', state.diff.join(','));
    if (state.longestKm !== DEFAULTS.longestKm) p.set('max', state.longestKm);
    try { history.replaceState(history.state, '', '/?' + p.toString()); } catch (e) { /* a sandboxed frame: the page works without it */ }
  }

  /* ---------------------------------------------------------- small utils */

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function svgEl(tag, attrs) {
    var n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function token(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function px(name) { return parseInt(token(name), 10) || 0; }   // a token such as --space-8 as a number
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function fmtKm(m) { return (m / 1000).toFixed(m < 100000 ? 1 : 0) + ' km'; }
  function fmtDuration(min) {
    if (min < 60) return min + ' min';
    var h = Math.floor(min / 60), r = min % 60;
    return h + ' h' + (r ? ' ' + r + ' min' : '');
  }
  // "Chennai, Chennai district, Tamil Nadu, India" -> "Chennai, Tamil Nadu"
  function shortPlace(label) {
    var parts = String(label || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    if (parts.length >= 3) return parts[0] + ', ' + parts[parts.length - 2];
    return parts.slice(0, 2).join(', ');
  }

  /* -------------------------------------------------------------- markup */

  mount.className = 'nd';
  // The three <details> are open in the markup, so without script every control simply shows.
  mount.innerHTML =
    '<div class="nd-discover" id="nd-discover">' +
      '<div class="nd-filterbar" id="nd-filterbar" role="search" aria-label="Find routes">' +
        '<div class="nd-search" id="nd-search">' +
          '<div class="nd-search__pill">' + icon('search', 'nd-search__icon') +
            '<label class="nd-sr-only" for="nd-place">Place</label>' +
            '<input class="nd-search__input" id="nd-place" type="text" autocomplete="off" maxlength="120" placeholder="Search a city or landmark" aria-describedby="nd-place-hint">' +
            '<button class="nd-iconbtn" id="nd-place-clear" type="button" aria-label="Clear search" hidden>' + icon('x') + '</button>' +
            '<button class="nd-iconbtn" id="nd-locate" type="button" aria-label="Use my location">' + icon('locate') + '</button>' +
          '</div>' +
          '<span class="nd-search__hint" id="nd-place-hint">Press Enter to search. Leave it empty to see all of India.</span>' +
          '<span class="nd-search__error" id="nd-place-error" role="alert" hidden></span>' +
        '</div>' +
        '<div class="nd-chiprow">' +
          '<details class="nd-pop" id="nd-sport-pop" open>' +
            '<summary class="nd-pillbtn" id="nd-sport-summary">' + icon('walk') + '<span id="nd-sport-label">Sport</span>' + icon('chevron', 'nd-pillbtn__chev') + '</summary>' +
            '<div class="nd-pop__panel"><fieldset class="nd-options" id="nd-sport"><legend>Sport</legend></fieldset></div>' +
          '</details>' +
          '<details class="nd-pop" id="nd-within-pop" open>' +
            '<summary class="nd-pillbtn" id="nd-within-summary">' + icon('radius') + '<span id="nd-within-label">All of India</span></summary>' +
            '<div class="nd-pop__panel"><div class="nd-range nd-range--narrow"><div class="nd-range__head"><label for="nd-radius">Within</label><span class="nd-range__value" id="nd-radius-v"></span></div><input id="nd-radius" type="range" min="5" max="200" step="5"></div></div>' +
          '</details>' +
          '<details class="nd-pop nd-filters" id="nd-filters" open>' +
            '<summary class="nd-pillbtn" id="nd-filters-summary">' + icon('funnel') + '<span id="nd-filters-label">Filters</span></summary>' +
            '<div class="nd-pop__panel nd-filters__body">' +
              '<div><span class="nd-field__label" id="nd-theme-l">Theme</span><div class="nd-chips nd-chips--labelled" id="nd-themes" role="group" aria-labelledby="nd-theme-l"></div></div>' +
              '<div class="nd-range nd-range--narrow"><div class="nd-range__head"><label for="nd-longest">Longest route</label><span class="nd-range__value" id="nd-longest-v"></span></div><input id="nd-longest" type="range" min="5" max="200" step="5"></div>' +
              '<div><span class="nd-field__label" id="nd-diff-l">Difficulty</span><div class="nd-chips nd-chips--labelled" id="nd-diffs" role="group" aria-labelledby="nd-diff-l"></div></div>' +
            '</div>' +
          '</details>' +
        '</div>' +
      '</div>' +
      '<div class="nd-split">' +
        '<div class="nd-map"><div class="nd-map__canvas" id="nd-map"></div><p class="nd-map__note" id="nd-map-note" hidden></p></div>' +
        '<section class="nd-sheet" id="nd-sheet" aria-labelledby="nd-results-h">' +
          '<div class="nd-sheet__handle" id="nd-handle" role="separator" tabindex="0" aria-orientation="horizontal" aria-label="Resize results panel" aria-valuemin="80" aria-valuemax="560" aria-valuenow="320"></div>' +
          '<div class="nd-sheet__bar"><h2 id="nd-results-h" class="nd-sr-only" tabindex="-1">Routes</h2><p class="nd-status" id="nd-status" role="status"></p><button class="nd-btn nd-btn--sm" id="nd-clear" type="button" hidden>Clear filters</button></div>' +
          '<ul class="nd-sheet__list" id="nd-list" role="list"></ul>' +
        '</section>' +
      '</div>' +
      '<button class="nd-mapbtn" id="nd-mapbtn" type="button" hidden>' + icon('map') + 'Map</button>' +
    '</div>';

  var place = $('nd-place'), placeError = $('nd-place-error'), listEl = $('nd-list'), statusEl = $('nd-status'),
      clearBtn = $('nd-clear'), sheet = $('nd-sheet'), handle = $('nd-handle'),
      radius = $('nd-radius'), longest = $('nd-longest'), discover = $('nd-discover'), filterbar = $('nd-filterbar'),
      mapBtn = $('nd-mapbtn'), pops = Array.prototype.slice.call(document.querySelectorAll('#nd-root .nd-pop'));

  SPORTS.forEach(function (s, i) {
    var label = el('label', 'nd-option'), input = el('input'), span = el('span', null, s[1]);
    input.type = 'radio'; input.name = 'nd-sport'; input.value = s[0]; input.checked = s[0] === state.sport;
    input.addEventListener('change', function () { state.sport = input.value; changed(); });
    // A tap or click picks and closes the dropdown. Arrow keys also fire "click", with detail 0: those keep it open.
    input.addEventListener('click', function (e) { if (e.detail > 0 && !wide.matches) closePops(); });
    label.appendChild(input); label.appendChild(span); $('nd-sport').appendChild(label);
  });
  function chips(host, list, key) {
    list.forEach(function (item) {
      var b = el('button', 'nd-chip', item[1]); b.type = 'button'; b.setAttribute('aria-pressed', 'false'); b.dataset.value = item[0];
      b.addEventListener('click', function () {
        var at = state[key].indexOf(item[0]);
        if (at === -1) state[key].push(item[0]); else state[key].splice(at, 1);
        b.setAttribute('aria-pressed', at === -1 ? 'true' : 'false');
        changed();
      });
      host.appendChild(b);
    });
  }
  chips($('nd-themes'), THEMES, 'themes');
  chips($('nd-diffs'), DIFFICULTIES, 'diff');

  /* ------------------------------------------------------- state -> screen */

  function panelFilterCount() {      // what the Filters chip counts: everything in its panel
    return (state.themes.length ? 1 : 0) + (state.diff.length ? 1 : 0) + (state.longestKm < DEFAULTS.longestKm ? 1 : 0);
  }
  function filterCount() { return (state.sport ? 1 : 0) + panelFilterCount(); }
  function syncClear() { $('nd-place-clear').hidden = !place.value; }

  function syncControls() {      // does not touch the place field: the user may be typing in it
    Array.prototype.forEach.call(document.querySelectorAll('input[name="nd-sport"]'), function (r) { r.checked = r.value === state.sport; });
    Array.prototype.forEach.call(document.querySelectorAll('#nd-themes .nd-chip'), function (c) { c.setAttribute('aria-pressed', state.themes.indexOf(c.dataset.value) !== -1 ? 'true' : 'false'); });
    Array.prototype.forEach.call(document.querySelectorAll('#nd-diffs .nd-chip'), function (c) { c.setAttribute('aria-pressed', state.diff.indexOf(c.dataset.value) !== -1 ? 'true' : 'false'); });
    var hasPlace = state.lat != null;
    radius.value = state.radiusKm; radius.disabled = !hasPlace;
    $('nd-radius-v').textContent = hasPlace ? state.radiusKm + ' km' : 'Choose a place';
    longest.value = state.longestKm;
    $('nd-longest-v').textContent = state.longestKm >= DEFAULTS.longestKm ? 'Any' : state.longestKm + ' km';
    // The three chips say what is set. A chip that changes the search is filled.
    var sportName = SPORTS.filter(function (x) { return x[0] === state.sport; })[0][1];
    $('nd-sport-label').textContent = state.sport ? sportName : 'Sport';
    $('nd-sport-summary').classList.toggle('is-active', !!state.sport);
    $('nd-within-label').textContent = hasPlace ? 'Within ' + state.radiusKm + ' km' : 'All of India';
    $('nd-within-summary').classList.toggle('is-active', hasPlace);
    var n = panelFilterCount();
    $('nd-filters-label').textContent = n ? 'Filters (' + n + ')' : 'Filters';
    $('nd-filters-summary').classList.toggle('is-active', n > 0);
    syncClear();
    syncInset();   // a chip's text changed, so the row may have wrapped
  }

  function searchArgs() {
    var a = { p_limit: PAGE_SIZE };
    if (state.lat != null) { a.p_lat = state.lat; a.p_lng = state.lng; a.p_radius_m = state.radiusKm * 1000; }
    if (state.sport) a.p_sport = state.sport;
    if (state.diff.length) a.p_difficulty = state.diff.slice();
    if (state.themes.length) a.p_themes = state.themes.slice();
    if (state.longestKm < DEFAULTS.longestKm) a.p_max_distance_m = state.longestKm * 1000;
    return a;
  }

  var refreshTimer = null;
  function changed(delay) {          // any control changed: update the labels now, search shortly
    syncControls();
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, delay || 0);
  }

  function refresh() {
    var no = ++requestNo;
    showLoading();
    writeUrl();
    Data.searchTours(searchArgs()).then(function (result) {
      if (no !== requestNo) return;          // a newer search is already running
      rows = result;
      render();
    }, function (err) {
      if (no !== requestNo) return;
      rows = [];
      showError(err);
    });
  }

  /* -------------------------------------------------------------- the list */

  function showLoading() {
    listEl.setAttribute('aria-busy', 'true');
    listEl.textContent = '';
    for (var i = 0; i < 3; i++) {
      var li = el('li'), card = el('div', 'nd-card nd-card--skeleton'); card.setAttribute('aria-hidden', 'true');
      card.innerHTML = '<div class="nd-card__media"></div><div class="nd-card__body"><span class="nd-skeleton nd-skeleton--title"></span><span class="nd-skeleton nd-skeleton--meta"></span><span class="nd-skeleton nd-skeleton--stat"></span></div><div class="nd-card__foot"><span class="nd-skeleton nd-skeleton--badge"></span></div>';
      li.appendChild(card); listEl.appendChild(li);
    }
    statusEl.textContent = 'Loading routes…';
    clearBtn.hidden = true;
  }

  function statusText() {
    var total = rows.length ? rows[0].total_count : 0;
    var head = plural(total, 'route', 'routes');
    return state.lat != null ? head + ' within ' + state.radiusKm + ' km of ' + (shortPlace(state.q) || 'your place') : head;
  }

  function render() {
    listEl.setAttribute('aria-busy', 'false');
    listEl.textContent = '';
    statusEl.textContent = statusText();
    clearBtn.hidden = !(filterCount() || state.lat != null) || !rows.length;   // the empty state has its own button
    clearBtn.textContent = filterCount() ? 'Clear filters' : 'Show all of India';
    if (!rows.length) { showEmpty(); drawMap(); settleFocus(); return; }
    rows.forEach(function (row) { listEl.appendChild(cardFor(row)); });
    if (selectedId && !rows.some(function (r) { return r.id === selectedId; })) selectedId = null;
    markSelected();
    drawMap();
    settleFocus();
  }

  // The control that was just used often disappears when the list redraws (Clear filters, Try again), and
  // focus would drop to the page. Put it somewhere sensible instead: the results heading.
  var focusPending = false;
  function settleFocus() {
    if (!focusPending) return;
    focusPending = false;
    $('nd-results-h').focus({ preventScroll: true });
  }

  function showEmpty() {
    var li = el('li'), box = el('div', 'nd-empty');
    box.innerHTML = icon('flower', 'nd-empty__icon');   // the kit's mandala motif, as a line drawing
    box.appendChild(el('h3', null, 'No routes match'));
    box.appendChild(el('p', null, state.lat != null
      ? 'Nothing starts within ' + state.radiusKm + ' km of ' + (shortPlace(state.q) || 'your place') + ' with these filters. Try a wider distance or fewer filters.'
      : 'No route fits these filters. Try fewer filters.'));
    var out = el('button', 'nd-btn nd-btn--primary', filterCount() ? 'Clear filters' : 'Show all of India'); out.type = 'button';
    out.addEventListener('click', clearAll);
    box.appendChild(out);
    li.appendChild(box); listEl.appendChild(li);
  }

  function showError(err) {
    listEl.setAttribute('aria-busy', 'false');
    listEl.textContent = '';
    statusEl.textContent = '';
    var li = el('li'), box = el('div', 'nd-empty'); box.setAttribute('role', 'alert');
    box.appendChild(el('h3', null, 'We could not load routes'));
    box.appendChild(el('p', null, 'Check your connection and try again.'));
    var retry = el('button', 'nd-btn nd-btn--primary', 'Try again'); retry.type = 'button';
    retry.addEventListener('click', function () { focusPending = true; refresh(); });
    box.appendChild(retry); li.appendChild(box); listEl.appendChild(li);
    clearBtn.hidden = true;
    if (focusPending) { focusPending = false; retry.focus(); }   // it failed again: keep focus on the new button
    if (window.console && err) console.warn('[Discover] search failed:', err.message || err);
  }

  function silhouette(row) {
    var svg = svgEl('svg', { viewBox: '0 0 200 90', fill: 'none' });
    var coords = row.path_preview && row.path_preview.coordinates;
    if (!coords || coords.length < 2) {              // no real track: a plain pin, not a made-up line
      var pin = svgEl('g', { transform: 'translate(88 21)', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
      pin.appendChild(svgEl('path', { d: 'M12 46s-12-10.4-12-20a12 12 0 1124 0c0 9.6-12 20-12 20z' }));
      pin.appendChild(svgEl('circle', { cx: '12', cy: '26', r: '4' }));
      svg.setAttribute('style', 'color:var(--color-text-muted)');
      svg.appendChild(pin); return svg;
    }
    var xs = coords.map(function (c) { return c[0]; }), ys = coords.map(function (c) { return c[1]; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    // longitude shrinks with latitude; keep the shape honest
    var kx = Math.cos(((minY + maxY) / 2) * Math.PI / 180);
    var w = Math.max((maxX - minX) * kx, 1e-9), h = Math.max(maxY - minY, 1e-9);
    var scale = Math.min(176 / w, 66 / h), offX = (200 - w * scale) / 2, offY = (90 - h * scale) / 2;
    var d = coords.map(function (c, i) { return (i ? 'L' : 'M') + (offX + (c[0] - minX) * kx * scale).toFixed(1) + ' ' + (offY + (maxY - c[1]) * scale).toFixed(1); }).join('');
    svg.appendChild(svgEl('path', { d: d, class: 'route-line route-line--casing' }));
    svg.appendChild(svgEl('path', { d: d, class: 'route-line route-line--' + (row.difficulty || 'unknown') }));
    return svg;
  }

  function cardFor(row) {
    var li = el('li'), card = el('article', 'nd-card'); card.dataset.id = row.id;
    var hasLine = !!(row.path_preview && row.path_preview.coordinates && row.path_preview.coordinates.length > 1);
    var media = el('div', 'nd-card__media' + (hasLine ? '' : ' nd-card__media--none')); media.setAttribute('aria-hidden', 'true'); media.appendChild(silhouette(row));
    var body = el('div', 'nd-card__body');
    if (row.rating_avg != null) {
      var r = el('span', 'nd-card__rating'); r.insertAdjacentHTML('afterbegin', icon('star'));
      r.appendChild(el('strong', null, row.rating_avg.toFixed(1))); r.appendChild(document.createTextNode(' (' + row.rating_count + ')'));
      r.setAttribute('role', 'img');   // an aria-label is ignored on a plain span; as an image it is read whole
      r.setAttribute('aria-label', 'Rated ' + row.rating_avg.toFixed(1) + ' out of 5 by ' + row.rating_count + ' people');
      body.appendChild(r);
    }
    var h = el('h3', 'nd-card__title'), link = el('button', 'nd-card__link', row.name); link.type = 'button';
    link.addEventListener('click', function () { select(row.id, 'card'); });
    h.appendChild(link); body.appendChild(h);
    var meta = row.location_label || '';
    if (row.centre_distance_m != null) meta += (meta ? ' · ' : '') + fmtKm(row.centre_distance_m) + ' away';
    if (meta) body.appendChild(el('p', 'nd-card__meta', meta));
    var stats = el('ul', 'nd-card__stats'); stats.setAttribute('role', 'list');
    function stat(kind, iconName, strong, rest) {   // time, length, climb: the order the original uses
      var s = el('li'); s.dataset.stat = kind; s.insertAdjacentHTML('afterbegin', icon(iconName));
      s.appendChild(el('strong', null, strong)); if (rest) s.appendChild(el('span', 'nd-sr-only', rest)); stats.appendChild(s);
    }
    if (row.duration_min != null) stat('duration', 'clock', fmtDuration(row.duration_min));
    if (row.distance_m != null) stat('distance', 'length', fmtKm(row.distance_m));
    if (row.ascent_m != null) stat('ascent', 'ascent', Math.round(row.ascent_m) + ' m', ' climb');
    if (stats.children.length) body.appendChild(stats);
    var page = ROUTE_PAGES[row.slug];
    if (page && typeof window.showRoutePage === 'function') {
      var more = el('button', 'nd-card__more', 'Open route page'); more.type = 'button';
      more.setAttribute('aria-label', 'Open the route page for ' + row.name);
      more.addEventListener('click', function () { window.showRoutePage(page); });
      body.appendChild(more);
    }
    card.appendChild(media); card.appendChild(body);
    // The badge sits over the media (as in the original) but comes last in the reading order.
    if (row.difficulty) card.appendChild(el('span', 'nd-badge nd-badge--' + row.difficulty + ' nd-card__badge', row.difficulty.charAt(0).toUpperCase() + row.difficulty.slice(1)));
    li.appendChild(card);
    return li;
  }

  function markSelected() {
    Array.prototype.forEach.call(listEl.querySelectorAll('.nd-card'), function (c) {
      var on = c.dataset.id === selectedId, b = c.querySelector('.nd-card__link');
      c.classList.toggle('is-selected', on);
      if (b) { if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); }
    });
    Object.keys(layers).forEach(function (id) {
      var on = id === selectedId, l = layers[id];
      [l.line, l.start].forEach(function (p) {
        var node = p && p.getElement && p.getElement(); if (node) node.classList.toggle('is-selected', on);
      });
      if (on && l.line) l.line.bringToFront();
      if (on) l.start.bringToFront();
    });
  }

  function select(id, from) {
    selectedId = id;
    markSelected();
    var l = layers[id];
    if (l && map) {
      var b = l.line ? l.line.getBounds() : L.latLngBounds([l.start.getLatLng()]);
      fit(b, l.line ? 15 : 12);
    }
    if (from === 'map') {
      var card = listEl.querySelector('.nd-card[data-id="' + id + '"]');
      if (card) card.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  }

  /* --------------------------------------------------------------- the map */

  function mapVisible() { var c = $('nd-map'); return !!(c && c.getClientRects().length); }

  function mapNote(text) { var n = $('nd-map-note'); n.textContent = text || ''; n.hidden = !text; }

  function ensureMap() {
    if (map || mapFailed || !active || !mapVisible()) return;
    if (!window.L) { mapFailed = true; mapNote('The map could not load. The list still works.'); return; }
    map = L.map($('nd-map'), { zoomControl: false }).setView([INDIA.lat, INDIA.lng], INDIA.zoom);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 18
    }).addTo(map);
    layerGroup = L.layerGroup().addTo(map);
    drawMap();
  }

  // Leaves room for the sheet where it covers the map (below 900px).
  function bottomPad() { return window.matchMedia(WIDE).matches ? px('--space-24') : sheet.offsetHeight + px('--space-24'); }

  // And for the controls that float over the top of it.
  function topPad() { return window.matchMedia(WIDE).matches ? px('--space-24') : inset() + px('--space-8'); }

  function fit(bounds, maxZoom) {
    if (!map) return;
    var pad = px('--space-24');
    map.fitBounds(bounds, { paddingTopLeft: [pad, topPad()], paddingBottomRight: [pad, bottomPad()], maxZoom: maxZoom || 13, animate: !reduceMotion });
  }

  function drawMap() {
    if (!map) return;
    layerGroup.clearLayers(); layers = {};
    var all = [];
    rows.forEach(function (row) {
      var kind = row.difficulty || 'unknown', rec = {};
      var coords = row.path_preview && row.path_preview.coordinates;
      if (coords && coords.length > 1) {
        var ll = coords.map(function (c) { return [c[1], c[0]]; });
        L.polyline(ll, { className: 'route-line route-line--casing', interactive: false }).addTo(layerGroup);
        rec.line = L.polyline(ll, { className: 'route-line route-line--' + kind }).addTo(layerGroup);
        rec.line.on('click', function () { select(row.id, 'map'); });
        all = all.concat(ll);
      }
      rec.start = L.circleMarker([row.start_lat, row.start_lng], { radius: px('--space-8'), className: 'nd-start nd-start--' + kind }).addTo(layerGroup);
      rec.start.on('click', function () { select(row.id, 'map'); });
      all.push([row.start_lat, row.start_lng]);
      layers[row.id] = rec;
    });
    markSelected();
    if (state.lat != null) {
      if (all.length) {
        fit(L.latLngBounds(all).extend([state.lat, state.lng]), 13);   // the routes found, and where you searched from
      } else {                                                         // nothing found: show the area that was searched
        var dLat = state.radiusKm / 111.32, dLng = dLat / Math.max(Math.cos(state.lat * Math.PI / 180), 0.01);
        fit(L.latLngBounds([[state.lat - dLat, state.lng - dLng], [state.lat + dLat, state.lng + dLng]]), 13);
      }
    } else if (all.length) {
      fit(L.latLngBounds(all), 11);
    }
  }

  /* ---------------------------------------------------------- place search */

  function setPlaceError(msg) {
    placeError.textContent = msg || ''; placeError.hidden = !msg;
    if (msg) place.setAttribute('aria-invalid', 'true'); else place.removeAttribute('aria-invalid');
    syncInset();   // the message sits in the bar and may make it taller
  }

  function usePlace(lat, lng, label) {
    state.lat = lat; state.lng = lng; state.q = label; place.value = label;
    setPlaceError('');
    selectedId = null;
    changed();
  }

  function submitPlace() {
    if (place.getAttribute('aria-busy') === 'true') return;   // one request at a time: the geocoder allows 1 a second
    var q = place.value.trim().slice(0, 120);
    setPlaceError('');
    if (!q) { state.lat = state.lng = null; state.q = ''; selectedId = null; changed(); return; }
    if (typeof window.forwardGeocode !== 'function') { setPlaceError('Place search is not available right now. Try again in a moment.'); return; }
    place.setAttribute('aria-busy', 'true'); $('nd-search').classList.add('is-busy');
    var hint = $('nd-place-hint'), hintText = hint.textContent;
    hint.textContent = 'Searching…';
    window.forwardGeocode(q, function (err, results) {   // Nominatim, on Enter only: its policy forbids search-as-you-type
      place.removeAttribute('aria-busy'); $('nd-search').classList.remove('is-busy');
      hint.textContent = hintText;
      if (err) { setPlaceError('Place search is not available right now. Check your connection and try again.'); return; }
      if (!results || !results.length) { setPlaceError('We could not find that place. Check the spelling or try a nearby city.'); return; }
      var r = results[0], lat = parseFloat(r.lat), lng = parseFloat(r.lon);
      if (!isFinite(lat) || !isFinite(lng)) { setPlaceError('We could not find that place. Check the spelling or try a nearby city.'); return; }
      usePlace(lat, lng, shortPlace(r.display_name) || q);
    });
  }

  place.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('nd-search').classList.add('is-done'); submitPlace(); } });
  place.addEventListener('input', function () { $('nd-search').classList.remove('is-done'); syncClear(); });
  // The hint floats over the map on a phone, so it only shows while the field is in use.
  place.addEventListener('focus', function () { $('nd-search').classList.add('is-focused'); });
  place.addEventListener('blur', function () { $('nd-search').classList.remove('is-focused'); });
  $('nd-place-clear').addEventListener('click', function () { place.value = ''; syncClear(); place.focus(); submitPlace(); });

  $('nd-locate').addEventListener('click', function () {
    var btn = $('nd-locate');
    setPlaceError('');
    if (!navigator.geolocation) { setPlaceError('This browser cannot share your location. Type a place instead.'); return; }
    btn.setAttribute('aria-busy', 'true'); btn.setAttribute('aria-label', 'Locating…');
    function done() { btn.removeAttribute('aria-busy'); btn.setAttribute('aria-label', 'Use my location'); }
    navigator.geolocation.getCurrentPosition(function (pos) {
      done(); usePlace(pos.coords.latitude, pos.coords.longitude, 'My location');
    }, function (err) {
      done();
      setPlaceError(err && err.code === 1
        ? 'Location is blocked for this site. Allow it in your browser settings, or type a place.'
        : 'We could not find your location. Type a place instead.');
    }, { timeout: 10000, maximumAge: 60000 });
  });

  /* ------------------------------------------------------ other controls */

  radius.addEventListener('input', function () { state.radiusKm = parseInt(radius.value, 10); changed(200); });
  longest.addEventListener('input', function () { state.longestKm = parseInt(longest.value, 10); changed(200); });

  function clearAll() {
    focusPending = true;
    if (filterCount()) { state.sport = ''; state.themes = []; state.diff = []; state.longestKm = DEFAULTS.longestKm; }
    else { state.lat = state.lng = null; state.q = ''; place.value = ''; state.radiusKm = DEFAULTS.radiusKm; setPlaceError(''); }
    selectedId = null;
    changed();
  }
  clearBtn.addEventListener('click', clearAll);

  // The three chips open a panel each below 900px, one at a time. At 900px and up there are no chips:
  // every control is open in the bar.
  var wide = window.matchMedia(WIDE);
  function closePops(except) { pops.forEach(function (d) { if (d !== except && d.open) d.open = false; }); }
  function syncPops() { pops.forEach(function (d) { d.open = wide.matches; }); }
  pops.forEach(function (d) {
    d.addEventListener('toggle', function () { if (!wide.matches && d.open) closePops(d); });
  });
  document.addEventListener('pointerdown', function (e) {
    if (!wide.matches && !(e.target.closest && e.target.closest('.nd-pop'))) closePops();
  });
  mount.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || wide.matches) return;
    var open = pops.filter(function (d) { return d.open; })[0];
    if (!open) return;
    open.open = false; open.querySelector('summary').focus(); e.preventDefault();
  });
  if (wide.addEventListener) wide.addEventListener('change', syncPops);
  syncPops();

  /* ----------------------------------------------- results sheet (handle) */

  var MIN_H = px('--size-sheet-peek');
  var LIST_AT = 0.7;                 // a sheet this much of the screen is the list view: the Map button shows
  function holder() { return sheet.parentNode.offsetHeight; }
  // Below 900px the chips float over the map, and the sheet never grows over them.
  function inset() { return wide.matches ? 0 : filterbar.offsetHeight + px('--space-12'); }
  function syncInset() { discover.style.setProperty('--nd-inset', inset() + 'px'); }
  function maxH() { return Math.max(MIN_H + px('--space-64'), holder() - inset()); }
  function defaultH() { return Math.max(160, Math.round(holder() * 0.4)); }
  var sheetReady = false;
  function initSheet() {           // measured once the page is visible: hidden elements have no height
    if (sheetReady || !mapVisible()) return;
    sheetReady = true;
    syncInset();
    setH(defaultH());
  }
  // targetH is what was asked for. The CSS never shows more than the space there is (max-height),
  // so what the user sees, and what the handle reports, is the smaller of the two. It is worked out from
  // the target, not read from the element, because the element is still animating for 200ms after a change.
  var targetH = 0;
  function shown() { return Math.max(MIN_H, Math.min(targetH, holder() - inset())); }
  function listMode() { return !wide.matches && shown() >= holder() * LIST_AT; }
  function syncHandle() {
    var now = shown();
    handle.setAttribute('aria-valuemax', maxH()); handle.setAttribute('aria-valuenow', now);
    discover.style.setProperty('--nd-sheet-shown', (wide.matches ? 0 : now) + 'px');   // lifts the map's own controls above the sheet
    var list = listMode();
    mapBtn.hidden = !list; discover.classList.toggle('is-list', list);
    return now;
  }
  function setH(h) {
    targetH = Math.round(clamp(h, MIN_H, maxH()));
    sheet.style.setProperty('--sheet-h', targetH + 'px');
    return syncHandle();
  }
  var startY = 0, startH = 0, dragging = false, moved = 0;
  handle.addEventListener('pointerdown', function (e) {
    dragging = true; moved = 0; startY = e.clientY; startH = shown(); sheet.style.transition = 'none';
    if (handle.setPointerCapture) handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', function (e) { if (dragging) { moved = Math.max(moved, Math.abs(startY - e.clientY)); setH(startH + startY - e.clientY); } });
  function endDrag(e) {
    if (!dragging) return;
    dragging = false; sheet.style.transition = '';
    if (e && e.type === 'pointerup' && moved < 4) setH(listMode() ? defaultH() : maxH());   // a tap, not a drag: list view or back
  }
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
  handle.addEventListener('keydown', function (e) {   // window splitter pattern
    var h = shown();
    if (e.key === 'ArrowUp') setH(h + px('--space-24'));
    else if (e.key === 'ArrowDown') setH(h - px('--space-24'));
    else if (e.key === 'Home') setH(MIN_H);
    else if (e.key === 'End') setH(maxH());
    else return;
    e.preventDefault();
  });
  // The way back from the list view to the map. It hides itself, so focus goes to the handle.
  mapBtn.addEventListener('click', function () { setH(defaultH()); handle.focus({ preventScroll: true }); });

  /* ----------------------------------------------------- show, hide, start */

  function setActive(on) {
    active = !!on;
    var search = document.querySelector('.pm-search-wrap');   // the planner bar's own search belongs to Plan mode
    if (search) search.style.display = active ? 'none' : '';
    if (active) { initSheet(); ensureMap(); if (map) { map.invalidateSize(); drawMap(); } writeUrl(); }
  }

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (map && mapVisible()) map.invalidateSize(); syncInset(); if (sheetReady) setH(wide.matches ? targetH : shown()); }, 150);
  });

  var page = $('page-planner');
  if (page && window.MutationObserver) {
    new MutationObserver(function () { if (active && page.classList.contains('active')) { initSheet(); ensureMap(); if (map) map.invalidateSize(); writeUrl(); } })
      .observe(page, { attributes: true, attributeFilter: ['class'] });
  }

  window.NaaradDiscover = { setActive: setActive };

  readUrl();
  place.value = state.q;
  syncControls();
  setActive(true);
  refresh();
  ensureMap();
})();
