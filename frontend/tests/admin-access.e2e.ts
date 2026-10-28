/**
 * QUAL-019 (Security Test Plan, threat 1) in the browser: an anonymous visitor
 * or a participant who opens any admin page sees no admin data. The route
 * guard sends them to login or to the editor before an admin page mounts, so
 * the app sends no `/api/admin` request at all. To make a leak visible, the
 * mocked admin API here answers every request with canary data, as a broken
 * server would; the real server's 401/403 is proven by AccessControlMatrixTest.
 */
import { expect, test, type Page } from '@playwright/test';
import { guardOffline } from './support/offline';
import { mockApi, type MockApi } from './support/mock-api';

const CANARY = 'CANARY-admin-data';

/** Every admin page of the app, with ids that would exist. */
const ADMIN_PAGES = [
	'/admin',
	'/admin/tasks',
	'/admin/tasks/new',
	'/admin/tasks/fire-fast',
	'/admin/groups',
	'/admin/groups/1'
];

const SESSIONS = [
	{
		who: 'an anonymous visitor',
		session: { status: 401, json: { error: 'Login required' } },
		lands: '/login'
	},
	{
		who: 'a participant',
		session: { data: { username: 'Ada', role: 'participant' } },
		lands: '/'
	}
] as const;

let unexpected: string[];
let api: MockApi;
let adminRequests: string[];

test.beforeEach(async ({ page, baseURL }) => {
	unexpected = await guardOffline(page, baseURL!);
	api = await mockApi(page);
	adminRequests = [];
	// Registered after mockApi, so it answers /api/admin first.
	await page.route(
		(url) => url.pathname.startsWith('/api/admin'),
		(route) => {
			adminRequests.push(
				`${route.request().method()} ${new URL(route.request().url()).pathname}`
			);
			return route.fulfill({
				json: {
					data: [
						{
							key: CANARY,
							title: CANARY,
							name: CANARY,
							username: CANARY,
							members: [],
							tasks: []
						}
					]
				}
			});
		}
	);
	await page.addInitScript(() => window.localStorage.setItem('easyquery-tour-seen', 'true'));
});

test.afterEach(() => {
	expect(unexpected, 'Unexpected external browser requests').toEqual([]);
});

async function expectNoAdminData(page: Page) {
	await expect(page.getByText(CANARY)).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'Admin', exact: true })).toHaveCount(0);
	await expect(page.getByRole('navigation', { name: 'Admin' })).toHaveCount(0);
	expect(await page.content()).not.toContain(CANARY);
}

for (const { who, session, lands } of SESSIONS) {
	test(`${who} opening an admin page is sent away and no admin API call is made`, async ({
		page
	}) => {
		api.override('/api/auth/session', () => session);
		for (const path of ADMIN_PAGES) {
			await page.goto(path);
			await expect(page).toHaveURL((url) => url.pathname === lands);
			if (lands === '/login')
				expect(new URL(page.url()).searchParams.get('next'), path).toBe(path);
			else await expect(page.locator('#cy')).toBeVisible();
			await expectNoAdminData(page);
		}
		expect(adminRequests, 'admin API requests').toEqual([]);
		expect(api.requests.filter((request) => request.path.startsWith('/api/admin'))).toEqual([]);
	});
}

test('a session that turns into a participant on reload leaves the admin page without admin calls', async ({
	page
}) => {
	let role = 'admin';
	api.override('/api/auth/session', () => ({ data: { username: 'Grace', role } }));
	api.override('/api/study/forms', () => ({ data: [] }));
	await page.goto('/admin');
	await expect(page.getByRole('heading', { name: 'Admin', exact: true })).toBeVisible();

	// The admin was removed from EASYQUERY_ADMIN_USERNAMES and the server restarted.
	role = 'participant';
	adminRequests.length = 0;
	await page.goto('/admin/tasks');
	await expect(page).toHaveURL((url) => url.pathname === '/');
	await expectNoAdminData(page);
	expect(adminRequests).toEqual([]);
});
