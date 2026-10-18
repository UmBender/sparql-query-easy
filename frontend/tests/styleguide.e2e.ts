import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { guardOffline } from './support/offline';

test.describe('styleguide (FE-050)', () => {
	let unexpected: string[];

	test.beforeEach(async ({ page, baseURL }) => {
		unexpected = await guardOffline(page, baseURL!);
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/styleguide');
		await expect(page.getByRole('heading', { name: 'Styleguide' })).toBeVisible();
	});

	test.afterEach(() => {
		expect(unexpected, 'Unexpected external browser requests').toEqual([]);
	});

	test('shows every token group and component and switches theme without a reload', async ({
		page
	}) => {
		for (const heading of [
			'Palettes',
			'Semantic colors (current theme)',
			'Graph node kinds',
			'Type, spacing, radii, shadows, layers',
			'Components'
		]) {
			await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
		}
		await expect(page.getByTestId('node-kind-canvas').locator('canvas').first()).toBeVisible();
		await page.evaluate(() => ((window as unknown as { __marker: boolean }).__marker = true));
		const background = () =>
			page.evaluate(() => getComputedStyle(document.body).backgroundColor);
		const light = await background();
		await page.getByTestId('theme-toggle').click();
		await expect(page.locator('html')).toHaveClass(/dark/);
		expect(await background()).not.toBe(light);
		expect(
			await page.evaluate(() => (window as unknown as { __marker?: boolean }).__marker)
		).toBe(true);
		await page.getByTestId('theme-toggle').click();
		await expect(page.locator('html')).not.toHaveClass(/dark/);
	});

	test('interactive components are keyboard reachable with a visible focus ring', async ({
		page
	}) => {
		await page.getByRole('button', { name: 'Run the query' }).focus();
		await page.keyboard.press('Tab');
		const focused = page.locator(':focus-visible');
		await expect(focused).toHaveAccessibleName('Zoom in');
		const ring = await focused.evaluate((element) => getComputedStyle(element).boxShadow);
		expect(ring).not.toBe('none');
		await page.getByRole('radio', { name: '3' }).focus();
		await page.keyboard.press('Space');
		await expect(page.getByTestId('rating-value')).toHaveText('Rating: 3');
		await page.getByRole('combobox', { name: 'Search nodes' }).fill('char');
		await page.keyboard.press('ArrowDown');
		await page.keyboard.press('Enter');
		await expect(page.getByText('Chosen: Charmander')).toBeVisible();
	});

	for (const theme of ['light', 'dark'] as const) {
		test(`axe reports no violations in the ${theme} theme`, async ({ page }) => {
			if (theme === 'dark') {
				await page.getByTestId('theme-toggle').click();
				await expect(page.locator('html')).toHaveClass(/dark/);
			}
			const results = await new AxeBuilder({ page }).analyze();
			expect(
				results.violations.map((violation) => ({
					id: violation.id,
					nodes: violation.nodes.map((node) => node.target.join(' '))
				}))
			).toEqual([]);
		});
	}
});
