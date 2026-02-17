const path = require('node:path');
const { defineConfig } = require('@playwright/test');

const port = Number(process.env.CLIENT_SMOKE_PORT || 4179);
const rootDir = path.resolve(__dirname, '..', '..');
const serverScript = path.join(rootDir, 'scripts', 'client-smoke-server.mjs');

module.exports = defineConfig({
  testDir: __dirname,
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    headless: true
  },
  webServer: {
    command: `node "${serverScript}" --port ${port}`,
    url: `http://127.0.0.1:${port}/practica_04.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  },
  reporter: process.env.CI ? [['github'], ['list']] : [['list']]
});
