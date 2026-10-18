import { expect, test } from '@playwright/test';
import { guardOffline } from './support/offline';

test('the editor renders and reports the stubbed backend health', async ({ page, baseURL }) => {
	const unexpected = await guardOffline(page, baseURL!);

	await page.goto('/');

	await expect(page.getByRole('link', { name: 'SPARQL EasyQuery home' })).toBeVisible();
	await expect(page.locator('#status-api')).toHaveText('API: online');
	// Tailwind utilities are compiled: `font-semibold` sets the brand weight.
	await expect(page.getByRole('link', { name: 'SPARQL EasyQuery home' })).toHaveCSS(
		'font-weight',
		'600'
	);
	expect(unexpected, 'Unexpected external browser requests').toEqual([]);
});

test('P-17 unexpected external browser traffic is rejected', async ({ page, baseURL }) => {
	const unexpected = await guardOffline(page, baseURL!);
	await page.goto('/');
	await page.evaluate(() => fetch('https://unexpected.example.test/asset.js').catch(() => {}));
	expect(unexpected).toEqual(['https://unexpected.example.test/asset.js']);
});
