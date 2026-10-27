#!/usr/bin/env node
// STUDY-013: load the Brasileirão 2023 practice tasks (DOC-009 questions) into
// a running EasyQuery through the admin API, so a participant account can solve
// them like a tester. Idempotent: an existing task is updated, the group
// "Demo Brasileirão 2023" is reused, the participant is registered or logged in
// and moved into that group. PokemonGen1 tasks and groups are not touched.
//
//   EASYQUERY_DEMO_ADMIN=… EASYQUERY_DEMO_ADMIN_PASSWORD=… \
//   EASYQUERY_DEMO_PARTICIPANT=… EASYQUERY_DEMO_PARTICIPANT_PASSWORD=… \
//   npm --prefix frontend run demo:seed -- [--base-url=http://127.0.0.1:8080]
//
// The admin username must be listed in EASYQUERY_ADMIN_USERNAMES of the backend.
import { readFileSync } from 'node:fs';

/**
 * @typedef {{ username: string, password: string }} Account
 * @typedef {{ key: string, title: string, statement: string, endpoint: string,
 *   graph: unknown, query: unknown, answers: string[] }} DemoTask
 * @typedef {{ group: string, tasks: DemoTask[] }} DemoStudy
 */

export const DEMO_STUDY_FILE = new URL(
	'../src/lib/domain/fixtures/demo-study/brasileirao-2023.json',
	import.meta.url
);

/** @returns {DemoStudy} */
export function readDemoStudy() {
	return JSON.parse(readFileSync(DEMO_STUDY_FILE, 'utf8'));
}

/** A cookie-carrying JSON client for one account. */
class Session {
	/** @param {string} baseUrl */
	constructor(baseUrl) {
		this.baseUrl = baseUrl.replace(/\/$/, '');
		this.cookie = '';
	}

	/**
	 * @param {string} method
	 * @param {string} path
	 * @param {unknown} [body]
	 * @returns {Promise<{ status: number, body: any }>}
	 */
	async call(method, path, body) {
		/** @type {Record<string, string>} */
		const headers = { Accept: 'application/json' };
		if (body !== undefined) headers['Content-Type'] = 'application/json';
		if (this.cookie) headers.Cookie = this.cookie;
		const response = await fetch(`${this.baseUrl}${path}`, {
			method,
			headers,
			body: body === undefined ? undefined : JSON.stringify(body)
		});
		const session = response.headers
			.getSetCookie()
			.find((value) => value.startsWith('easyquery_session='));
		if (session) this.cookie = session.split(';')[0];
		const text = await response.text();
		return { status: response.status, body: text ? JSON.parse(text) : null };
	}

	/**
	 * Registers the account, or logs in when the username is taken.
	 * @param {Account} account
	 * @returns {Promise<string>} the role
	 */
	async signIn(account) {
		const credentials = { username: account.username, password: account.password };
		let reply = await this.call('POST', '/api/auth/register', credentials);
		if (reply.status === 409) reply = await this.call('POST', '/api/auth/login', credentials);
		if (reply.status !== 200 && reply.status !== 201)
			throw new Error(
				`Sign-in of ${account.username} failed (${reply.status}): ${JSON.stringify(reply.body)}`
			);
		return reply.body.data.role;
	}
}

/**
 * @param {{ status: number, body: any }} reply
 * @param {string} what
 */
function expectOk(reply, what) {
	if (reply.status < 200 || reply.status > 299)
		throw new Error(`${what} failed (${reply.status}): ${JSON.stringify(reply.body)}`);
	return reply.body?.data;
}

/**
 * Creates or updates the demo tasks and group and puts the participant in it.
 * Fails when a stored expected result does not have the note's answer count.
 * @param {{ baseUrl: string, admin: Account, participant: Account, study?: DemoStudy,
 *   log?: (line: string) => void }} options
 * @returns {Promise<{ groupId: number, keys: string[] }>}
 */
export async function seedDemoStudy({
	baseUrl,
	admin,
	participant,
	study = readDemoStudy(),
	log = () => {}
}) {
	const member = new Session(baseUrl);
	await member.signIn(participant);
	log(`participant ${participant.username} ready`);

	const session = new Session(baseUrl);
	if ((await session.signIn(admin)) !== 'admin')
		throw new Error(
			`${admin.username} is not an admin: add it to EASYQUERY_ADMIN_USERNAMES and restart the backend.`
		);

	for (const task of study.tasks) {
		const body = {
			key: task.key,
			title: task.title,
			statement: task.statement,
			endpoint: task.endpoint,
			reference: { graph: task.graph, query: task.query }
		};
		const created = await session.call('POST', '/api/admin/tasks', body);
		if (created.status === 409)
			expectOk(
				await session.call('PUT', `/api/admin/tasks/${task.key}`, body),
				`update ${task.key}`
			);
		else expectOk(created, `create ${task.key}`);
		await session.call('POST', `/api/admin/tasks/${task.key}/reactivate`, {});
	}
	const summaries = expectOk(await session.call('GET', '/api/admin/tasks'), 'list tasks');
	for (const task of study.tasks) {
		const summary = summaries.find(
			(/** @type {{ key: string }} */ item) => item.key === task.key
		);
		if (summary?.expectedCount !== task.answers.length)
			throw new Error(
				`${task.key}: the reference returns ${summary?.expectedCount} results, the note expects ${task.answers.length}`
			);
		log(`task ${task.key}: ${summary.expectedCount} expected results`);
	}

	const groups = expectOk(await session.call('GET', '/api/admin/groups'), 'list groups');
	let group = groups.find((/** @type {{ name: string }} */ item) => item.name === study.group);
	if (!group)
		group = expectOk(
			await session.call('POST', '/api/admin/groups', { name: study.group }),
			'create group'
		);
	const keys = study.tasks.map((task) => task.key);
	expectOk(
		await session.call('PUT', `/api/admin/groups/${group.id}/tasks`, { tasks: keys }),
		'set group tasks'
	);
	expectOk(
		await session.call('POST', `/api/admin/groups/${group.id}/members`, {
			username: participant.username
		}),
		'add participant'
	);
	log(
		`group "${study.group}" (${group.id}): ${keys.length} tasks, member ${participant.username}`
	);
	return { groupId: group.id, keys };
}

/** @param {string} name */
function required(name) {
	const value = process.env[name];
	if (!value) throw new Error(`Set ${name}.`);
	return value;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const baseUrl =
		process.argv
			.find((argument) => argument.startsWith('--base-url='))
			?.slice('--base-url='.length) ?? 'http://127.0.0.1:8080';
	try {
		await seedDemoStudy({
			baseUrl,
			admin: {
				username: required('EASYQUERY_DEMO_ADMIN'),
				password: required('EASYQUERY_DEMO_ADMIN_PASSWORD')
			},
			participant: {
				username: required('EASYQUERY_DEMO_PARTICIPANT'),
				password: required('EASYQUERY_DEMO_PARTICIPANT_PASSWORD')
			},
			log: (line) => console.log(line)
		});
		console.log(`Done. Log in at ${baseUrl}/login as the participant and open /study.`);
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	}
}
