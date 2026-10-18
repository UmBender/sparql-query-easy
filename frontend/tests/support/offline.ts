import type { Page } from '@playwright/test';

/**
 * QUAL-003 for the new app: same-origin requests continue, `/health` is
 * stubbed, every other origin is recorded and aborted. Tests assert the
 * returned list is empty.
 */
export async function guardOffline(page: Page, baseURL: string): Promise<string[]> {
	const unexpected: string[] = [];
	const origin = new URL(baseURL).origin;
	await page.route('**/*', (route) => {
		const url = new URL(route.request().url());
		if (url.origin !== origin) {
			unexpected.push(url.href);
			return route.abort('blockedbyclient');
		}
		if (url.pathname === '/health') return route.fulfill({ json: { status: 'ok' } });
		return route.fallback();
	});
	return unexpected;
}
