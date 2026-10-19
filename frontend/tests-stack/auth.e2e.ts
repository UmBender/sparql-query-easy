/**
 * AUTH-003 on the real stack: register, session restore after a reload,
 * logout, a wrong password and login against Ktor (AUTH-001) with the
 * Testcontainers PostgreSQL of playwright.stack.config.ts. AUTH-004: a protected
 * page sends an anonymous visitor to login and back. AUTH-005: the configured
 * `stack-admin` reaches the admin page; a participant does not.
 */
import { expect, test } from '@playwright/test';

let unexpected: string[];

test.beforeEach(async ({ page, baseURL }) => {
	unexpected = [];
	await page.route('**/*', (route) => {
		const url = new URL(route.request().url());
		if (url.origin !== new URL(baseURL!).origin) {
			unexpected.push(url.href);
			return route.abort('blockedbyclient');
		}
		return route.fallback();
	});
	await page.addInitScript(() => window.localStorage.setItem('easyquery-tour-seen', 'true'));
});

test.afterEach(() => {
	expect(unexpected, 'Unexpected external browser requests').toEqual([]);
});

test('register, restore the session, log out, reject a wrong password and log in again', async ({
	page,
	context
}) => {
	const username = `ada-${Date.now()}`;
	await page.goto('/login');
	await page.getByRole('button', { name: 'Create an account' }).click();
	await page.getByLabel('Username').fill(username);
	await page.getByLabel('Password', { exact: true }).fill('correct horse');
	await page.getByLabel('Repeat the password').fill('correct horse');
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page.getByTestId('account-name')).toHaveText(username);

	const cookie = (await context.cookies()).find((item) => item.name === 'easyquery_session');
	expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
	expect(await page.evaluate(() => document.cookie)).not.toContain('easyquery_session');

	await page.reload();
	await expect(page.getByTestId('account-name')).toHaveText(username);

	await page.getByRole('button', { name: 'Log out' }).click();
	await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
	await page.reload();
	await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();

	await page.getByRole('link', { name: 'Log in' }).click();
	await page.getByLabel('Username').fill(username.toUpperCase());
	await page.getByLabel('Password').fill('wrong horse');
	await page
		.getByRole('form', { name: 'Log in' })
		.getByRole('button', { name: 'Log in' })
		.click();
	await expect(page.getByRole('alert')).toHaveText('Invalid username or password');
	await page.getByLabel('Password').fill('correct horse');
	await page
		.getByRole('form', { name: 'Log in' })
		.getByRole('button', { name: 'Log in' })
		.click();
	await expect(page.getByTestId('account-name')).toHaveText(username);
	expect(page.url()).not.toContain('horse');
});

test('a taken username is reported by the server', async ({ page, request }) => {
	const username = `taken-${Date.now()}`;
	const created = await request.post('/api/auth/register', {
		data: { username, password: 'correct horse' }
	});
	expect(created.status()).toBe(201);

	await page.goto('/login');
	await page.getByRole('button', { name: 'Create an account' }).click();
	await page.getByLabel('Username').fill(username);
	await page.getByLabel('Password', { exact: true }).fill('another horse');
	await page.getByLabel('Repeat the password').fill('another horse');
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page.getByRole('alert')).toHaveText('This username is already taken');
});

test('a protected page needs a session and returns there after login', async ({
	page,
	request
}) => {
	const username = `study-${Date.now()}`;
	const created = await request.post('/api/auth/register', {
		data: { username, password: 'correct horse' }
	});
	expect(created.status()).toBe(201);

	await page.goto('/study');
	await expect(page).toHaveURL(/\/login\?next=%2Fstudy$/);
	await page.getByLabel('Username').fill(username);
	await page.getByLabel('Password').fill('correct horse');
	await page
		.getByRole('form', { name: 'Log in' })
		.getByRole('button', { name: 'Log in' })
		.click();
	await expect(page).toHaveURL(/\/study$/);
	await expect(page.getByRole('heading', { name: 'Proposed queries' })).toBeVisible();

	await page.reload();
	await expect(page.getByRole('heading', { name: 'Proposed queries' })).toBeVisible();
	await page.getByRole('button', { name: 'Log out' }).click();
	await expect(page).toHaveURL(/\/login\?next=%2Fstudy$/);
	await page.goto('/study');
	await expect(page).toHaveURL(/\/login\?next=%2Fstudy$/);
});

test('the configured admin reaches the admin page and a participant is sent to the editor', async ({
	page
}) => {
	async function register(username: string) {
		await page.goto('/login');
		await page.getByRole('button', { name: 'Create an account' }).click();
		await page.getByLabel('Username').fill(username);
		await page.getByLabel('Password', { exact: true }).fill('correct horse');
		await page.getByLabel('Repeat the password').fill('correct horse');
		await page.getByRole('button', { name: 'Create account' }).click();
		await expect(page.getByTestId('account-name')).toHaveText(username);
	}

	await register(`grace-${Date.now()}`);
	await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
	await page.goto('/admin');
	await expect(page.locator('#cy')).toBeVisible();
	expect(new URL(page.url()).pathname).toBe('/');
	await page.getByRole('button', { name: 'Log out' }).click();

	await register('stack-admin');
	await page.getByRole('link', { name: 'Admin' }).click();
	await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
});
