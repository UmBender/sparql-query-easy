/** Shared steps of the real-stack suites (STUDY-003…007). */
import { readFileSync } from 'node:fs';
import { expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';

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

/** Valid answers to the shipped placeholder profile questionnaire (v1). */
export const PROFILE_ANSWERS = {
	sparql_familiarity: 'heard_of',
	query_languages: ['sql'],
	programming_years: 4,
	data_comfort: 4
};

/**
 * What every participant does before the proposed tasks open, through the API: accept the current consent text
 * (STUDY-008) and, unless `profile` is false, answer the profile questionnaire (STUDY-010). The session in
 * `request` must be the participant's.
 */
export async function joinStudy(request: APIRequestContext, profile = true): Promise<void> {
	const consent = await request.get('/api/study/consent');
	expect(consent.status(), 'read consent').toBe(200);
	const { version } = ((await consent.json()) as { data: { version: number } }).data;
	const accepted = await request.post('/api/study/consent', { data: { version } });
	expect(accepted.status(), 'accept consent').toBe(200);
	if (!profile) return;
	const answered = await request.post('/api/study/forms/profile/responses', {
		data: { version: 1, answers: PROFILE_ANSWERS }
	});
	expect(answered.status(), 'answer the profile').toBe(201);
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

/** A saved query file the stack tests load into an editor. */
export const FIRE_SPEED = new URL(
	'../src/lib/domain/fixtures/fire-speed-at-least-90.query.json',
	import.meta.url
);

/** Creates a task through the admin API (the session in `request` must be an admin's). */
export async function createTask(
	request: APIRequestContext,
	key: string,
	title: string,
	reference: { graph: unknown; query: unknown },
	extra: { startingGraph?: unknown; statement?: string } = {}
): Promise<void> {
	const response = await request.post('/api/admin/tasks', {
		data: { key, title, statement: `${title}.`, endpoint: 'PokemonGen1', reference, ...extra }
	});
	expect(response.status(), `create task ${key}`).toBe(201);
}

const PK = 'http://easyquery.example.org/pokemon#';
const typePattern = (type: string) => ({
	subject: '?pokemon',
	predicate: `<${PK}hasType>`,
	object: `<${PK}${type}>`,
	filterType: null
});

/** The Fire-type speed ≥ 90 request the editor derives from FIRE_SPEED (fixtures/legacy). */
export const FIRE_SPEED_QUERY = {
	variableName: '?pokemon',
	where: [
		typePattern('FireType'),
		{ subject: '?pokemon', predicate: `<${PK}speed>`, object: '?speed', filterType: null }
	],
	variableFilters: [{ variableName: '?speed', filterType: 2, value: '90' }]
};

/**
 * STUDY-003 test data, created through the admin API as `stack-admin` in its own context: the participant
 * joins the study (`joinStudy`), then three PokemonGen1 tasks (Water, then Fire with speed ≥ 90 starting from the drawn Fire query, then Grass) in a
 * new group with `participant` in it. Returns the task keys in group order.
 */
export async function seedStudy(browser: Browser, participant: string): Promise<string[]> {
	const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
	const graph = JSON.parse(readFileSync(FIRE_SPEED, 'utf8'));
	const admin = await browser.newContext();
	try {
		await loginAs(admin.request, participant);
		await joinStudy(admin.request);
		await admin.request.post('/api/auth/logout', { data: {} });
		await loginAs(admin.request, 'stack-admin');
		const keys = [`water-${stamp}`, `fire-fast-${stamp}`, `grass-${stamp}`];
		await createTask(admin.request, keys[0], 'All Water Pokémon', {
			graph,
			query: { variableName: '?pokemon', where: [typePattern('WaterType')] }
		});
		await createTask(
			admin.request,
			keys[1],
			'Fast Fire Pokémon',
			{ graph, query: FIRE_SPEED_QUERY },
			{
				startingGraph: graph,
				statement: 'Find the Fire-type Pokémon with speed of at least 90.'
			}
		);
		await createTask(admin.request, keys[2], 'All Grass Pokémon', {
			graph,
			query: { variableName: '?pokemon', where: [typePattern('GrassType')] }
		});
		const group = await admin.request.post('/api/admin/groups', {
			data: { name: `Group ${stamp}` }
		});
		expect(group.status()).toBe(201);
		const id = ((await group.json()) as { data: { id: number } }).data.id;
		expect(
			(
				await admin.request.put(`/api/admin/groups/${id}/tasks`, { data: { tasks: keys } })
			).ok()
		).toBe(true);
		expect(
			(
				await admin.request.post(`/api/admin/groups/${id}/members`, {
					data: { username: participant }
				})
			).ok()
		).toBe(true);
		return keys;
	} finally {
		await admin.close();
	}
}
