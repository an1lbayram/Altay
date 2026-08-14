import { defineConfig, devices } from '@playwright/test';

// Dedicated config for tests/api-contract.spec.js — real, rate-limited public APIs, run
// explicitly via `npm run test:api`, never as part of the main suite/CI. No webServer: these
// are pure HTTP contract checks against third-party services, not our own app.
export default defineConfig({
  testDir: './tests',
  testMatch: '**/api-contract.spec.js',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  timeout: 45000,
  projects: [
    {
      name: 'Desktop Chrome (PC)',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
