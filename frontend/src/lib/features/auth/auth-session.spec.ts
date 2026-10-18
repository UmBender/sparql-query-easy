/**
 * AUTH-003: the session store against an MSW server that follows the
 * AUTH-001 contract (status codes and messages of tcc/03 - Backend/API v1.md).
 */
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApiClient } from '#lib/api/client.js';
import { AuthSession } from './auth-session.svelte.js';
import { loginSchema, registerSchema } from './auth-form.js';

const BASE = 'http://api.test';
const accounts = new Map<string, { username: string; password: string }>();
let current: string | null = null;
const bodies: unknown[] = [];

const server = setupServer(
	http.get(`${BASE}/api/auth/session`, () =>
		current
			? HttpResponse.json({ data: { username: current } })
			: HttpResponse.json({ error: 'Login required' }, { status: 401 })
	),
	http.post(`${BASE}/api/auth/register`, async ({ request }) => {
		const body = (await request.json()) as { username: string; password: string };
		bodies.push(body);
		if (accounts.has(body.username.toLowerCase()))
			return HttpResponse.json({ error: 'This username is already taken' }, { status: 409 });
		accounts.set(body.username.toLowerCase(), body);
		current = body.username;
		return HttpResponse.json({ data: { username: body.username } }, { status: 201 });
	}),
	http.post(`${BASE}/api/auth/login`, async ({ request }) => {
		const body = (await request.json()) as { username: string; password: string };
		bodies.push(body);
		const account = accounts.get(body.username.toLowerCase());
		if (!account || account.password !== body.password)
			return HttpResponse.json({ error: 'Invalid username or password' }, { status: 401 });
		current = account.username;
		return HttpResponse.json({ data: { username: account.username } });
	}),
	http.post(`${BASE}/api/auth/logout`, () => {
		if (!current) return HttpResponse.json({ error: 'Login required' }, { status: 401 });
		current = null;
		return new HttpResponse(null, { status: 204 });
	})
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => {
	accounts.clear();
	current = null;
	bodies.length = 0;
});

const session = () => new AuthSession(createApiClient({ baseUrl: BASE }));

describe('AuthSession', () => {
	it('starts anonymous and registers, which logs in', async () => {
		const auth = session();
		expect(auth.status).toBe('checking');
		await auth.refresh();
		expect(auth).toMatchObject({ status: 'ready', user: null });

		expect(await auth.register({ username: 'Ada', password: 'correct horse' })).toEqual({
			ok: true
		});
		expect(auth.user).toEqual({ username: 'Ada' });
		expect(bodies).toEqual([{ username: 'Ada', password: 'correct horse' }]);
	});

	it('reports a taken username', async () => {
		await session().register({ username: 'Ada', password: 'correct horse' });
		const other = session();
		expect(await other.register({ username: 'ADA', password: 'another one' })).toEqual({
			ok: false,
			error: 'This username is already taken'
		});
		expect(other.user).toBeNull();
	});

	it('logs in, rejects a wrong password with the server message, and logs out', async () => {
		await session().register({ username: 'Ada', password: 'correct horse' });
		current = null;
		const auth = session();

		expect(await auth.login({ username: 'Ada', password: 'wrong' })).toEqual({
			ok: false,
			error: 'Invalid username or password'
		});
		expect(auth.user).toBeNull();
		expect(await auth.login({ username: 'ada', password: 'correct horse' })).toEqual({
			ok: true
		});
		expect(auth.user).toEqual({ username: 'Ada' });

		expect(await auth.logout()).toEqual({ ok: true });
		expect(auth.user).toBeNull();
		await auth.refresh();
		expect(auth.user).toBeNull();
	});

	it('restores the session of a returning visitor', async () => {
		current = 'Ada';
		const auth = session();
		await auth.refresh();
		expect(auth).toMatchObject({ status: 'ready', user: { username: 'Ada' } });
	});

	it('treats logging out an expired session as logged out', async () => {
		const auth = session();
		auth.user = { username: 'Ada' };
		expect(await auth.logout()).toEqual({ ok: true });
		expect(auth.user).toBeNull();
	});

	it('explains an unavailable account database, rate limiting and network failures', async () => {
		server.use(
			http.get(`${BASE}/api/auth/session`, () =>
				HttpResponse.json(
					{ error: 'Accounts are temporarily unavailable' },
					{ status: 503 }
				)
			),
			http.post(`${BASE}/api/auth/login`, () =>
				HttpResponse.json(
					{ error: 'Too many attempts; try again in a minute' },
					{ status: 429 }
				)
			),
			http.post(`${BASE}/api/auth/register`, () => HttpResponse.error())
		);
		const auth = session();
		await auth.refresh();
		expect(auth.status).toBe('unavailable');
		expect(await auth.login({ username: 'Ada', password: 'x' })).toEqual({
			ok: false,
			error: 'Too many attempts; try again in a minute'
		});
		expect(await auth.register({ username: 'Ada', password: 'correct horse' })).toEqual({
			ok: false,
			error: 'Could not reach the server. Check your connection.'
		});
	});
});

describe('auth form schemas', () => {
	it('repeat the registration rules and only require login fields', () => {
		expect(loginSchema.safeParse({ username: ' ', password: '' }).success).toBe(false);
		expect(loginSchema.safeParse({ username: 'a', password: 'b' }).success).toBe(true);
		const errors = (input: object) =>
			registerSchema
				.safeParse(input)
				.error?.issues.map((issue) => `${issue.path}: ${issue.message}`);
		expect(
			errors({ username: 'ab', password: 'correct horse', confirm: 'correct horse' })
		).toEqual(["username: Use 3 to 32 letters, digits, '.', '_' or '-'."]);
		expect(errors({ username: 'ada lovelace', password: 'short', confirm: 'short' })).toEqual([
			"username: Use 3 to 32 letters, digits, '.', '_' or '-'.",
			'password: Use 8 to 128 characters.'
		]);
		expect(
			errors({ username: 'ada', password: 'correct horse', confirm: 'correct house' })
		).toEqual(['confirm: The passwords do not match.']);
		expect(
			errors({ username: ' ada ', password: 'correct horse', confirm: 'correct horse' })
		).toBe(undefined);
	});
});
