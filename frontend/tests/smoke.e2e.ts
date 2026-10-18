import { expect, test } from '@playwright/test';

test('the page renders and shows the stubbed backend health', async ({ page, baseURL }) => {
	// QUAL-003: only same-origin traffic is allowed; anything else is recorded and aborted.
	const unexpected: string[] = [];
	await page.route('**/*', (route) => {
		const url = new URL(route.request().url());
		if (url.origin !== new URL(baseURL!).origin) {
			unexpected.push(url.href);
			return route.abort('blockedbyclient');
		}
		if (url.pathname === '/health') return route.fulfill({ json: { status: 'ok' } });
		return route.continue();
	});

	await page.goto('/');

	await expect(page.getByRole('heading', { name: 'SPARQL EasyQuery' })).toBeVisible();
	await expect(page.getByTestId('health')).toHaveText('{"status":"ok"}');
	// Tailwind utilities are compiled: `font-semibold` sets the heading weight.
	await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('font-weight', '600');
	expect(unexpected, 'Unexpected external browser requests').toEqual([]);
});
