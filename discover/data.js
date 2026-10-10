/* Naarad Discover data layer: the local stand-in for the Postgres functions in
 * replica/schema.sql.
 *
 * Same names, same arguments, same result rows as search_tours() and get_tour(),
 * so the screens never know which one they are talking to. Today the rows come
 * from discover/seed-tours.json. When the schema is applied to Supabase, replace
 * the two functions below with
 *
 *     searchTours: (args) => supabase.rpc('search_tours', args).then(unwrap)
 *     getTour:     (slug) => supabase.rpc('get_tour', { p_slug: slug }).then(unwrap)
 *
 * and nothing else changes. discover/data.test.js holds this file to the same
 * behaviour as schema.test.sql.
 *
 * Where it matches the SQL: filters on a field the tour does not have exclude it
 * (SQL NULL semantics), no centre means "anywhere" (best rated first), one of
 * latitude and longitude alone is an error, limit is capped at 50, radius at 200 km.
 */
(function (root) {
  'use strict';

  var SEED_URL = '/discover/seed-tours.json';
  var loading = null;

  function load() {
    if (!loading) {
      loading = root.fetch(SEED_URL)
        .then(function (res) {
          if (!res.ok) throw new Error('Could not load routes (' + res.status + ')');
          return res.json();
        })
        .then(function (data) { return data.tours; })
        .catch(function (err) { loading = null; throw err; }); // let a retry try again
    }
    return loading;
  }

  function haversineM(lat1, lng1, lat2, lng2) {
    var R = 6371008.8, rad = Math.PI / 180;
    var dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function clamp(n, lo, hi) { return Math.min(Math.max(n, lo), hi); }

  function invalid(message) {
    var err = new Error(message);
    err.code = '22023'; // the SQL function raises the same state
    return err;
  }

  // "the field is null or fails the bound" excludes the tour, as in SQL
  function atLeast(value, bound) { return bound == null || (value != null && value >= bound); }
  function atMost(value, bound) { return bound == null || (value != null && value <= bound); }

  function searchTours(a) {
    a = a || {};
    return load().then(function (all) {
      var hasLat = a.p_lat != null, hasLng = a.p_lng != null;
      if (hasLat !== hasLng ||
          (hasLat && (a.p_lat < -90 || a.p_lat > 90 || a.p_lng < -180 || a.p_lng > 180))) {
        throw invalid('search_tours: give both a valid latitude and longitude, or neither');
      }
      var radius = clamp(a.p_radius_m == null ? 30000 : a.p_radius_m, 1, 200000);
      var limit = clamp(a.p_limit == null ? 20 : a.p_limit, 1, 50);
      var offset = Math.max(a.p_offset == null ? 0 : a.p_offset, 0);

      var hits = [];
      all.forEach(function (t) {
        if (t.status && t.status !== 'published') return;
        var d = hasLat ? haversineM(a.p_lat, a.p_lng, t.start_lat, t.start_lng) : null;
        if (hasLat && d > radius) return;
        if (a.p_sport != null && t.sport !== a.p_sport) return;
        if (a.p_difficulty != null && a.p_difficulty.indexOf(t.difficulty) === -1) return;
        if (a.p_themes != null && a.p_themes.indexOf(t.theme) === -1) return;
        if (!atLeast(t.distance_m, a.p_min_distance_m) || !atMost(t.distance_m, a.p_max_distance_m)) return;
        if (!atLeast(t.duration_min, a.p_min_duration_min) || !atMost(t.duration_min, a.p_max_duration_min)) return;
        if (!atLeast(t.ascent_m, a.p_min_ascent_m) || !atMost(t.ascent_m, a.p_max_ascent_m)) return;
        if (a.p_surface != null && t.surface !== a.p_surface) return;
        if (a.p_route_type != null && t.route_type !== a.p_route_type) return;
        hits.push({ t: t, d: d });
      });

      // nearest first (with a centre), then best rated, nulls last, then id so pages never shift
      hits.sort(function (x, y) {
        if (hasLat && x.d !== y.d) return x.d - y.d;
        var rx = x.t.rating_avg, ry = y.t.rating_avg;
        if (rx !== ry) {
          if (rx == null) return 1;
          if (ry == null) return -1;
          return ry - rx;
        }
        return x.t.id < y.t.id ? -1 : x.t.id > y.t.id ? 1 : 0;
      });

      var total = hits.length;
      return hits.slice(offset, offset + limit).map(function (h) {
        var t = h.t;
        return {
          id: t.id, slug: t.slug, name: t.name, location_label: t.location_label,
          sport: t.sport, theme: t.theme, difficulty: t.difficulty,
          route_type: t.route_type, surface: t.surface,
          distance_m: t.distance_m, duration_min: t.duration_min, ascent_m: t.ascent_m,
          rating_avg: t.rating_avg, rating_count: t.rating_count, cover_image_path: t.cover_image_path,
          start_lat: t.start_lat, start_lng: t.start_lng,
          path_preview: t.path_preview,
          centre_distance_m: h.d == null ? null : Math.round(h.d),
          total_count: total
        };
      });
    });
  }

  function getTour(slug) {
    return load().then(function (all) {
      for (var i = 0; i < all.length; i++) {
        var t = all[i];
        if (t.slug === slug && (!t.status || t.status === 'published')) {
          var copy = {};
          Object.keys(t).forEach(function (k) { copy[k] = t[k]; });
          copy.stops = t.stops || [];
          return copy;
        }
      }
      return null;
    });
  }

  var api = { searchTours: searchTours, getTour: getTour, source: 'local seed' };
  root.NaaradDiscoverData = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
