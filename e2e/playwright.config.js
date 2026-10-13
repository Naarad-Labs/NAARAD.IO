// Current responsive atlas checks run against the local static server.
// Install from this folder with npm install, then run npm test.
const { defineConfig } = require('@playwright/test');
const fs = require('fs');

module.exports = defineConfig({
  testDir: '.',
  testMatch: 'revamp.spec.js',
  outputDir: 'test-results',
  fullyParallel: true,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'results.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
        (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    },
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
