import type { Page } from '@playwright/test';

/**
 * QUAL-003 for the new app: same-origin requests continue, `/health` is
 * stubbed, every other origin is recorded and aborted. QUAL-022: every
 * Content-Security-Policy violation the page reports is recorded too. Tests
 * assert the returned list is empty.
 */
export async function guardOffline(page: Page, baseURL: string): Promise<string[]> {
	const unexpected: string[] = [];
	const origin = new URL(baseURL).origin;
	await page.exposeFunction('__reportCspViolation', (violation: string) => {
		unexpected.push(`CSP ${violation}`);
	});
	await page.addInitScript(() => {
		document.addEventListener('securitypolicyviolation', (event) => {
			const report = (window as unknown as { __reportCspViolation: (text: string) => void })
				.__reportCspViolation;
			report(
				`${event.effectiveDirective} blocked ${event.blockedURI || 'inline'} at ${event.sourceFile}:${event.lineNumber}`
			);
		});
	});
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
