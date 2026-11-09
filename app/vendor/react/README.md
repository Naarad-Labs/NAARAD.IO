# React 18 UMD Vendor

- **react.production.min.js**: 10.7 KB gzipped (131 KB minified)
- **react-dom.production.min.js**: 45.1 KB gzipped (131 KB minified)

Source: https://unpkg.com/react@18/umd/ (MIT License)

These are the production builds for use in the Naarad site. They are loaded lazily
for React island hydration and are NOT precached by the service worker (per Phase 1
ruling for external/vendor scripts).

Bundle size for the Explore page (React 18 UMD + React DOM):
- Total: ~56 KB minified, ~18 KB gzipped

This fits within the 150 KB JS budget per-page with the existing app code.