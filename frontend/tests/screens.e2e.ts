/**
 * QUAL-014: full-page screenshots of every main route in the light and dark
 * themes, offline with the typed mock API. Text is part of the picture, so
 * this suite runs only in the pinned Playwright image (`npm run
 * test:screens`), where fonts rasterise the same on every machine. Refresh
 * baselines deliberately: `npm run test:screens -- --update-snapshots`.
 */
import { expect, test } from '@playwright/test';
import { guardOffline } from './support/offline';
import { mockApi } from './support/mock-api';
import { MAIN_ROUTES, prepareScreen, useTheme } from './support/screens';

let unexpected: string[];

test.beforeEach(async ({ page, baseURL }) => {
	unexpected = await guardOffline(page, baseURL!);
	await page.setViewportSize({ width: 1280, height: 800 });
});

test.afterEach(() => {
	expect(unexpected, 'Unexpected external browser requests').toEqual([]);
});

for (const screen of MAIN_ROUTES) {
	for (const theme of ['light', 'dark'] as const) {
		test(`${screen.path} in the ${theme} theme`, async ({ page }) => {
			const api = await mockApi(page);
			await prepareScreen(page, api, screen);
			await useTheme(page, theme);
			await page.goto(screen.path);
			await screen.ready(page);
			await expect(page.locator('html')).toHaveClass(
				theme === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b)/
			);
			await page.evaluate(() => document.fonts.ready.then(() => undefined));
			await expect(page).toHaveScreenshot(`${screen.name}-${theme}.png`, {
				fullPage: true,
				animations: 'disabled',
				caret: 'hide'
			});
		});
	}
}
