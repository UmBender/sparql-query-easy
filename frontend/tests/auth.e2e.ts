/**
 * AUTH-003 with the mocked API: the login page validates in the browser,
 * sends only valid credentials, shows the server's answers, and the editor's
 * toolbar follows the session. Passwords never reach URLs or storage.
 * AUTH-004: protected pages send anonymous visitors to login and back, and
 * logout empties the app's query cache.
 */
import { expect, test, type Page } from '@playwright/test';
import { guardOffline } from './support/offline';
import { mockApi, type MockApi } from './support/mock-api';
import { openEditor } from './support/editor';

let unexpected: string[];
let api: MockApi;

test.beforeEach(async ({ page, baseURL }) => {
	unexpected = await guardOffline(page, baseURL!);
	api = await mockApi(page);
	await page.addInitScript(() => window.localStorage.setItem('easyquery-tour-seen', 'true'));
});

test.afterEach(async ({ page }) => {
	expect(unexpected, 'Unexpected external browser requests').toEqual([]);
	const stored = await page.evaluate(() =>
		JSON.stringify({ ...window.localStorage, ...window.sessionStorage })
	);
	expect(stored).not.toContain('correct horse');
	expect(page.url()).not.toContain('correct');
});

const loginForm = (page: Page) => page.getByRole('form', { name: 'Log in' });
const registerForm = (page: Page) => page.getByRole('form', { name: 'Create an account' });

test('an anonymous visitor uses the editor and reaches the login page from the toolbar', async ({
	page
}) => {
	await openEditor(page);
	await expect(page.locator('#cy')).toBeVisible();
	await page.getByRole('link', { name: 'Log in' }).click();
	await expect(page).toHaveURL(/\/login$/);
	await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
	await page.getByRole('link', { name: 'Continue without an account' }).click();
	await expect(page.locator('#cy')).toBeVisible();
});

test('login validates both fields, shows a wrong password and then logs in', async ({ page }) => {
	let attempts = 0;
	api.override('/api/auth/login', (body) =>
		++attempts === 1
			? { status: 401, json: { error: 'Invalid username or password' } }
			: { data: { username: String(body?.username) } }
	);
	await page.goto('/login');
	await loginForm(page).getByRole('button', { name: 'Log in' }).click();
	await expect(page.getByText('Enter your username.')).toBeVisible();
	await expect(page.getByText('Enter your password.')).toBeVisible();
	expect(api.bodies('/api/auth/login')).toEqual([]);

	await page.getByLabel('Username').fill('Ada');
	await page.getByLabel('Password').fill('wrong horse');
	await loginForm(page).getByRole('button', { name: 'Log in' }).click();
	await expect(page.getByRole('alert')).toHaveText('Invalid username or password');

	await page.getByLabel('Password').fill('correct horse');
	await loginForm(page).getByRole('button', { name: 'Log in' }).click();
	await expect(page.locator('#cy')).toBeVisible();
	await expect(page.getByTestId('account-name')).toHaveText('Ada');
	expect(api.bodies('/api/auth/login')).toEqual([
		{ username: 'Ada', password: 'wrong horse' },
		{ username: 'Ada', password: 'correct horse' }
	]);
});

test('registration checks the rules and the repeated password, reports a taken username, then creates the account', async ({
	page
}) => {
	let attempts = 0;
	api.override('/api/auth/register', (body) =>
		++attempts === 1
			? { status: 409, json: { error: 'This username is already taken' } }
			: { status: 201, json: { data: { username: String(body?.username) } } }
	);
	await page.goto('/login');
	await page.getByRole('button', { name: 'Create an account' }).click();
	await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible();

	await page.getByLabel('Username').fill('ab');
	await page.getByLabel('Password', { exact: true }).fill('short');
	await page.getByLabel('Repeat the password').fill('other');
	await registerForm(page).getByRole('button', { name: 'Create account' }).click();
	await expect(page.locator('#register-username-errors')).toHaveText(
		"Use 3 to 32 letters, digits, '.', '_' or '-'."
	);
	await expect(page.locator('#register-password-errors')).toHaveText('Use 8 to 128 characters.');
	await expect(page.locator('#register-confirm-errors')).toHaveText(
		'The passwords do not match.'
	);
	expect(api.bodies('/api/auth/register')).toEqual([]);

	await page.getByLabel('Username').fill('Ada');
	await page.getByLabel('Password', { exact: true }).fill('correct horse');
	await page.getByLabel('Repeat the password').fill('correct horse');
	await registerForm(page).getByRole('button', { name: 'Create account' }).click();
	await expect(page.getByRole('alert')).toHaveText('This username is already taken');
	await registerForm(page).getByRole('button', { name: 'Create account' }).click();
	await expect(
		page
			.locator('[data-sonner-toast]')
			.filter({ hasText: 'Account created. Logged in as Ada.' })
	).toBeVisible();
	await expect(page.getByTestId('account-name')).toHaveText('Ada');
	// The repeated password is checked here and never sent.
	expect(api.bodies('/api/auth/register')).toEqual([
		{ username: 'Ada', password: 'correct horse' },
		{ username: 'Ada', password: 'correct horse' }
	]);
});

test('a returning visitor is restored from the session and can log out', async ({ page }) => {
	let loggedIn = true;
	api.override('/api/auth/session', () =>
		loggedIn
			? { data: { username: 'Ada' } }
			: { status: 401, json: { error: 'Login required' } }
	);
	api.override('/api/auth/logout', () => {
		loggedIn = false;
		return { status: 204 };
	});
	await openEditor(page);
	await expect(page.getByTestId('account-name')).toHaveText('Ada');
	await page.getByRole('button', { name: 'Log out' }).click();
	await expect(
		page.locator('[data-sonner-toast]').filter({ hasText: 'Logged out.' })
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
	expect(api.requests.filter((request) => request.path === '/api/auth/logout')).toHaveLength(1);
});

test('an unavailable account database leaves the editor usable and says so on the login page', async ({
	page
}) => {
	api.override('/api/auth/session', () => ({
		status: 503,
		json: { error: 'Accounts are temporarily unavailable' }
	}));
	await openEditor(page);
	await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
	await page.goto('/login');
	await expect(page.getByRole('status')).toHaveText(
		'Accounts are temporarily unavailable. The query editor still works.'
	);
});

test('a protected page sends an anonymous visitor to login and back after logging in', async ({
	page
}) => {
	let loggedIn = false;
	api.override('/api/auth/session', () =>
		loggedIn
			? { data: { username: 'Ada' } }
			: { status: 401, json: { error: 'Login required' } }
	);
	api.override('/api/auth/login', (body) => {
		loggedIn = true;
		return { data: { username: String(body?.username) } };
	});
	await page.goto('/study');
	await expect(page).toHaveURL(/\/login\?next=%2Fstudy$/);
	await expect(page.getByRole('heading', { name: 'Proposed queries' })).toHaveCount(0);

	await page.getByLabel('Username').fill('Ada');
	await page.getByLabel('Password').fill('correct horse');
	await loginForm(page).getByRole('button', { name: 'Log in' }).click();
	await expect(page).toHaveURL(/\/study$/);
	await expect(page.getByRole('heading', { name: 'Proposed queries' })).toBeVisible();

	// The session survives a reload: the page shows directly, without visiting login.
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Proposed queries' })).toBeVisible();
	await expect(page).toHaveURL(/\/study$/);
});

test('a login link pointing to another site returns to the editor instead', async ({ page }) => {
	api.override('/api/auth/login', (body) => ({ data: { username: String(body?.username) } }));
	await page.goto('/login?next=%2F%2Fevil.example%2Fstudy');
	await page.getByLabel('Username').fill('Ada');
	await page.getByLabel('Password').fill('correct horse');
	await loginForm(page).getByRole('button', { name: 'Log in' }).click();
	await expect(page.locator('#cy')).toBeVisible();
	expect(new URL(page.url()).pathname).toBe('/');
});

test('public pages never redirect an anonymous visitor', async ({ page }) => {
	for (const path of ['/', '/login', '/styleguide']) {
		await page.goto(path);
		await expect(page.locator('main, #cy').first()).toBeVisible();
		await expect(page.getByText('Checking your session…')).toHaveCount(0);
		expect(new URL(page.url()).pathname).toBe(path);
	}
});

test('logout empties the query cache and leaves a protected page for login', async ({ page }) => {
	let loggedIn = true;
	api.override('/api/auth/session', () =>
		loggedIn
			? { data: { username: 'Ada' } }
			: { status: 401, json: { error: 'Login required' } }
	);
	api.override('/api/auth/logout', () => {
		loggedIn = false;
		return { status: 204 };
	});
	type Handle = {
		__easyquery: {
			queryClient: {
				setQueryData(key: unknown[], value: unknown): void;
				getQueryData(key: unknown[]): unknown;
			};
		};
	};
	await openEditor(page);
	await expect(page.getByTestId('account-name')).toHaveText('Ada');
	await page.evaluate(() =>
		(window as never as Handle).__easyquery.queryClient.setQueryData(['probe'], 'Ada only')
	);
	await page.getByRole('button', { name: 'Log out' }).click();
	await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
	expect(
		await page.evaluate(() =>
			(window as never as Handle).__easyquery.queryClient.getQueryData(['probe'])
		)
	).toBeUndefined();

	loggedIn = true;
	await page.goto('/study');
	await expect(page.getByRole('heading', { name: 'Proposed queries' })).toBeVisible();
	await page.getByRole('button', { name: 'Log out' }).click();
	await expect(page).toHaveURL(/\/login\?next=%2Fstudy$/);
});
