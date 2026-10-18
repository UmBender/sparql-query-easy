import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'frontend-tests',
  // These suites need the Ktor server: npm run test:e2e and npm run fixtures:legacy.
  testIgnore: ['e2e/**', 'fixtures-capture/**'],
  fullyParallel: false,
  use: {
    browserName: 'firefox',
    headless: true,
    serviceWorkers: 'block',
  },
});
