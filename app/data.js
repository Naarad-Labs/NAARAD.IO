/* Shared data adapter for the new route experience.
 * `seed-tours.json` is authoritative for route geometry and measured metadata.
 * Curated routes intentionally expose only their start point: no route line,
 * stops, or elevation profile is inferred when the seed does not contain it.
 */
(function (root) {
  'use strict';

  var SEED_URL = '/discover/seed-tours.json';
  var pending = null;
  var editorialLabels = {
    'heritage-walk': 'Heritage walk',
    'temple-trail': 'Temple trail',
    'nature-hike': 'Nature hike',
    'cultural-tour': 'Cultural route',
    photography: 'Photo route',
    'coastal-walk': 'Coastal walk'
  };

  function validCoordinate(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng) &&
      lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  function cloneLine(line) {
    if (!line || line.type !== 'LineString' || !Array.isArray(line.coordinates)) return null;
    var coordinates = line.coordinates.filter(function (point) {
      return Array.isArray(point) && point.length >= 2 &&
        Number.isFinite(point[0]) && Number.isFinite(point[1]) &&
        Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90;
    }).map(function (point) { return [point[0], point[1]]; });
    return coordinates.length >= 2 ? { type: 'LineString', coordinates: coordinates } : null;
  }

  function normalize(row) {
    var start = validCoordinate(row.start_lat, row.start_lng)
      ? { lat: row.start_lat, lng: row.start_lng }
      : null;
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      location: row.location_label || null,
      sport: row.sport || null,
      theme: row.theme || null,
      themeLabel: editorialLabels[row.theme] || null,
      difficulty: row.difficulty || null,
      distanceM: Number.isFinite(row.distance_m) ? row.distance_m : null,
      durationMin: Number.isFinite(row.duration_min) ? row.duration_min : null,
      ascentM: Number.isFinite(row.ascent_m) ? row.ascent_m : null,
      descentM: Number.isFinite(row.descent_m) ? row.descent_m : null,
      rating: Number.isFinite(row.rating_avg) ? row.rating_avg : null,
      ratingCount: Number.isFinite(row.rating_count) ? row.rating_count : null,
      start,
      geometry: cloneLine(row.path),
      geometryPreview: cloneLine(row.path_preview),
      // The seed has no story-stop or elevation-sample table. Empty/null values
      // make absence explicit and prevent artwork from being mistaken for data.
      stops: [],
      elevationProfile: null,
      hasPublishedGeometry: !!cloneLine(row.path),
      media: null
    };
  }

  function loadRoutes() {
    if (!pending) {
      pending = root.fetch(SEED_URL).then(function (response) {
        if (!response.ok) throw new Error('Could not load route data (' + response.status + ')');
        return response.json();
      }).then(function (payload) {
        if (!payload || !Array.isArray(payload.tours)) {
          throw new Error('Route data is missing its tours list');
        }
        var media = root.NaaradMedia || (typeof require === 'function' ? require('./media.js') : null);
        return payload.tours.filter(function (row) {
          return row && row.slug && (!row.status || row.status === 'published');
        }).map(function (row) {
          var route = normalize(row);
          route.media = media ? media.forRoute(route) : { url: null, alt: '', source: null };
          return route;
        });
      }).catch(function (error) {
        pending = null; // allow a deliberate retry after a transient failure
        throw error;
      });
    }
    return pending;
  }

  function getRoute(slug) {
    return loadRoutes().then(function (routes) {
      return routes.find(function (route) { return route.slug === slug; }) || null;
    });
  }

  function formatDistance(metres) {
    if (!Number.isFinite(metres) || metres < 0) return null;
    return metres >= 1000
      ? (metres / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' km'
      : Math.round(metres).toLocaleString() + ' m';
  }

  function formatDuration(minutes) {
    if (!Number.isFinite(minutes) || minutes < 0) return null;
    var hours = Math.floor(minutes / 60), remainder = minutes % 60;
    if (!hours) return remainder + ' min';
    if (!remainder) return hours + ' hr';
    return hours + ' hr ' + remainder + ' min';
  }

  function formatElevation(metres) {
    if (!Number.isFinite(metres) || metres < 0) return null;
    return Math.round(metres).toLocaleString() + ' m';
  }

  function formatDifficulty(value) {
    if (value == null || value === '') return null;
    return String(value).replace(/[_-]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function getEditorial(route) {
    if (!route) return null;
    var place = route.location || 'this place';
    var kind = route.themeLabel || (route.sport === 'cycle' ? 'Cycling route' : route.sport === 'hike' ? 'Hiking route' : 'Walking route');
    if (route.slug === 'hampi-vijayanagara-circuit') {
      return {
        eyebrow: kind,
        title: 'A landscape of stone and memory',
        body: 'Explore Hampi’s granite landscape, temple architecture and the banks of the Tungabhadra. The published listing gives the route distance and starting point; its exact track and story stops are still being prepared.',
        source: 'Editorial context paired with published route metadata.'
      };
    }
    return {
      eyebrow: kind,
      title: 'A story of ' + place,
      body: 'Explore ' + place + ' through this published ' + kind.toLowerCase() + '. Open the map for its available route data; ordered story stops and narration will appear when they are published.',
      source: 'Generated from published route name, category, and location metadata.'
    };
  }

  var api = {
    loadRoutes: loadRoutes,
    getRoute: getRoute,
    formatDistance: formatDistance,
    formatDuration: formatDuration,
    formatElevation: formatElevation,
    formatDifficulty: formatDifficulty,
    getEditorial: getEditorial
  };
  root.NaaradData = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
