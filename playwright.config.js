import { defineConfig, devices } from '@playwright/test';

const PORT = 4956;
const BASE_URL = `http://localhost:${PORT}`;

// Service worker registration (src/js/app.js) is gated on import.meta.env.PROD,
// so PWA/offline behavior can only be observed against a production build+preview,
// never against the plain `vite dev` server.
//
// Uses a dedicated, unlikely-to-collide port and never reuses a pre-existing server on
// it: silently reusing whatever already answers on a common port (e.g. 4173, another
// project's preview server) would test the wrong app instead of failing loudly.
export default defineConfig({
  testDir: './tests',
  // Playwright's default testMatch also picks up *.test.js, which is reserved for Vitest
  // unit/component specs (tests/unit/**, tests/component/**) — restrict to *.spec.js so
  // the two runners don't fight over the same files.
  testMatch: '**/*.spec.js',
  // api-contract.spec.js hits real, rate-limited public APIs (Overpass, Nominatim,
  // Wikipedia) on purpose — excluded from the default run, invoked explicitly via
  // `npm run test:api` instead of every `npm test`/CI push.
  testIgnore: '**/api-contract.spec.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Service worker activation timing is inherently a bit racy under heavy parallel load
  // (registration fires on the window "load" event, so its exact timing varies with CPU
  // contention across concurrently-running browser projects) — one retry absorbs that.
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120000,
  },
  projects: [
    {
      name: 'Desktop Chrome (PC)',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome (Android)',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari (iOS)',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'Desktop Firefox (PC)',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
});
