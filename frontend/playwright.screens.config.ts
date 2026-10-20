import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// QUAL-014: the screen screenshots, run inside the pinned Playwright image by
// scripts/test-screens.mjs (`npm run test:screens`) so text renders the same everywhere.
export default defineConfig({
	...base,
	testMatch: 'screens.e2e.ts',
	testIgnore: [],
	reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/screens' }]],
	outputDir: 'test-results/screens'
});
