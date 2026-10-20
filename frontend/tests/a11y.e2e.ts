/**
 * QUAL-015: axe on every main route (tests/support/screens.ts) in the light
 * and dark themes, offline. Any violation fails, whatever its impact
 * (DEC-016 Q3 A).
 */
import AxeBuilder from '@axe-core/playwright';
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
		test(`axe reports no violations on ${screen.path} in the ${theme} theme`, async ({
			page
		}) => {
			const api = await mockApi(page);
			await prepareScreen(page, api, screen);
			await useTheme(page, theme);
			await page.goto(screen.path);
			await screen.ready(page);
			await expect(page.locator('html')).toHaveClass(
				theme === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b)/
			);
			// An open tooltip is portalled to <body>, outside the landmarks; its trigger carries the label.
			const results = await new AxeBuilder({ page })
				.exclude('[data-bits-floating-content-wrapper]')
				.analyze();
			expect(
				results.violations.map((violation) => ({
					id: violation.id,
					impact: violation.impact,
					nodes: violation.nodes.map((node) => node.target.join(' '))
				})),
				`${screen.path} (${theme})`
			).toEqual([]);
		});
	}
}
