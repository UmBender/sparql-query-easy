import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'frontend-tests',
  fullyParallel: false,
  use: {
    browserName: 'firefox',
    headless: true,
    serviceWorkers: 'block',
  },
});
