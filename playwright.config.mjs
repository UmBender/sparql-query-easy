import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'frontend-tests',
  // The end-to-end suite needs the Ktor server: npm run test:e2e.
  testIgnore: ['e2e/**'],
  fullyParallel: false,
  use: {
    browserName: 'firefox',
    headless: true,
    serviceWorkers: 'block',
  },
});
