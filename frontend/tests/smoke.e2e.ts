import { expect, test } from '@playwright/test';
import { guardOffline } from './support/offline';

test('the page renders and shows the stubbed backend health', async ({ page, baseURL }) => {
	const unexpected = await guardOffline(page, baseURL!);

	await page.goto('/');

	await expect(page.getByRole('heading', { name: 'SPARQL EasyQuery' })).toBeVisible();
	await expect(page.getByTestId('health')).toHaveText('{"status":"ok"}');
	// Tailwind utilities are compiled: `font-semibold` sets the heading weight.
	await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('font-weight', '600');
	expect(unexpected, 'Unexpected external browser requests').toEqual([]);
});
