/** Shared steps of the real-stack suites (STUDY-003…007). */
import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const PASSWORD = 'correct horse';

/** Registers `username`, or logs in when it exists; the session cookie lands in the page's context. */
export async function loginAs(request: APIRequestContext, username: string): Promise<void> {
	const credentials = { data: { username, password: PASSWORD } };
	const created = await request.post('/api/auth/register', credentials);
	if (created.status() === 409) {
		const login = await request.post('/api/auth/login', credentials);
		expect(login.status(), `login ${username}`).toBe(200);
	} else {
		expect(created.status(), `register ${username}`).toBe(201);
	}
}

/** Fails the test on any browser request leaving the app's origin (no external services). */
export function guardOffline(page: Page, baseURL: string): string[] {
	const unexpected: string[] = [];
	void page.route('**/*', (route) => {
		const url = new URL(route.request().url());
		if (url.origin !== new URL(baseURL).origin) {
			unexpected.push(url.href);
			return route.abort('blockedbyclient');
		}
		return route.fallback();
	});
	void page.addInitScript(() => window.localStorage.setItem('easyquery-tour-seen', 'true'));
	return unexpected;
}
