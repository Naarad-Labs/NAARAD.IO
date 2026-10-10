// Runs against a local static server (serve.js) on the repo root. No network: external hosts are blocked and
// answered by the fixture (see fixtures.js). Install first: npm install && npx playwright install chromium
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  outputDir: 'test-results',
  fullyParallel: true,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'results.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1440, height: 900 },
    serviceWorkers: 'block',      // the offline spec turns it on for itself
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node serve.js',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    cwd: __dirname,
  },
});
