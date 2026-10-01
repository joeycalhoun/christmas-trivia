import { defineConfig } from '@playwright/test';
import fs from 'node:fs';

// Use a locally installed Chromium if present (e.g. CI images), otherwise Playwright's own download.
const LOCAL_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 3199;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1360, height: 900 },
    launchOptions: fs.existsSync(LOCAL_CHROME) ? { executablePath: LOCAL_CHROME } : {},
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `rm -rf .e2e-data && node server/server.mjs --port ${PORT} --host 127.0.0.1 --data .e2e-data`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
  },
});
