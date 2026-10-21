import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// DOC-006: writes the /help page's images to static/help/. Run in the pinned
// Playwright image like the screen screenshots (`npm run help:screens`), so the
// pictures are the same on every machine. Not part of `npm test`.
export default defineConfig({
	...base,
	testDir: 'tests-help',
	testMatch: '**/*.capture.ts',
	testIgnore: [],
	reporter: [['list']],
	outputDir: 'test-results/help'
});
