#!/usr/bin/env node
// OPS-009 restore drill: start the compose stack as the throwaway project
// easyquery-drill-a (compose.test.yaml: tmpfs database, `:test` images) with
// backups every minute into a temporary directory, seed an account, consent,
// a profile answer, a study task and an attempt through the API, wait for a
// scheduled dump and its age-encrypted copy, then restore the plain dump and
// the encrypted one into a fresh project easyquery-drill-b with
// scripts/restore-backup.sh and compare every table. Also checks retention on
// dummy files. Removes both projects and the directory whatever the result.
// Needs Docker with Compose v2.24+. Usage: node scripts/check-backup-restore.mjs
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repository = new URL('..', import.meta.url).pathname;
const work = mkdtempSync(join(tmpdir(), 'easyquery-drill-'));
const backups = join(work, 'backups');
const files = ['compose.yaml', 'compose.test.yaml', 'deploy/test/compose.backup-test.yaml'];
const base = 'http://127.0.0.1:18200';
const env = { ...process.env };
for (const name of Object.keys(env))
	if (/^(POSTGRES_|EASYQUERY_|WEB_|BACKUP_|COMPOSE_|AGE_)/.test(name)) delete env[name];

const run = (command, args, options = {}) =>
	spawnSync(command, args, { encoding: 'utf8', env, cwd: repository, ...options });
function must(result, what) {
	if (result.status !== 0) throw new Error(`${what} failed:\n${result.stdout ?? ''}${result.stderr ?? ''}`);
	return result.stdout ?? '';
}
const project = (name) => ({
	...env,
	COMPOSE_PROJECT_NAME: `easyquery-drill-${name}`,
	COMPOSE_FILE: files.join(':'),
	COMPOSE_ENV_FILES: join(work, `${name}.env`)
});
const compose = (name, args, options = {}) => run('docker', ['compose', ...args], { env: project(name), ...options });

let failures = 0;
function check(name, condition, detail = '') {
	console.log(`${condition ? 'ok  ' : 'FAIL'} ${name}${condition || !detail ? '' : ` (${detail})`}`);
	if (!condition) failures += 1;
}

/** A tiny API client with one session cookie. */
function client() {
	let cookie = '';
	return async (method, path, body) => {
		const response = await fetch(`${base}${path}`, {
			method,
			headers: { ...(cookie && { Cookie: cookie }), ...(body !== undefined && { 'Content-Type': 'application/json' }) },
			body: body === undefined ? undefined : JSON.stringify(body)
		});
		const set = response.headers.getSetCookie().find((line) => line.startsWith('easyquery'));
		if (set) cookie = set.split(';')[0];
		const text = await response.text();
		return { status: response.status, json: text ? JSON.parse(text) : undefined };
	};
}
async function expectStatus(promise, status, what) {
	const response = await promise;
	if (response.status !== status) throw new Error(`${what}: ${response.status} ${JSON.stringify(response.json)}`);
	return response.json;
}

const PK = 'http://easyquery.example.org/pokemon#';
const graph = JSON.parse(
	readFileSync(join(repository, 'frontend/src/lib/domain/fixtures/fire-speed-at-least-90.query.json'), 'utf8')
);
const waterQuery = {
	variableName: '?pokemon',
	where: [{ subject: '?pokemon', predicate: `<${PK}hasType>`, object: `<${PK}WaterType>`, filterType: null }]
};
const credentials = (username) => ({ username, password: 'restore drill password' });

async function seed() {
	const participant = client();
	await expectStatus(participant('POST', '/api/auth/register', credentials('drill-participant')), 201, 'register participant');
	const { version } = (await expectStatus(participant('GET', '/api/study/consent'), 200, 'read consent')).data;
	await expectStatus(participant('POST', '/api/study/consent', { version }), 200, 'accept consent');
	await expectStatus(
		participant('POST', '/api/study/forms/profile/responses', {
			version: 1,
			answers: { sparql_familiarity: 'heard_of', query_languages: ['sql'], programming_years: 4, data_comfort: 4 }
		}),
		201,
		'answer the profile'
	);
	const admin = client();
	await expectStatus(admin('POST', '/api/auth/register', credentials('drill-admin')), 201, 'register admin');
	await expectStatus(
		admin('POST', '/api/admin/tasks', {
			key: 'drill-water',
			title: 'All Water Pokémon',
			statement: 'All Water Pokémon.',
			endpoint: 'PokemonGen1',
			reference: { graph, query: waterQuery }
		}),
		201,
		'create task'
	);
	const group = (await expectStatus(admin('POST', '/api/admin/groups', { name: 'Drill group' }), 201, 'create group')).data;
	await expectStatus(admin('PUT', `/api/admin/groups/${group.id}/tasks`, { tasks: ['drill-water'] }), 200, 'assign task');
	const member = await admin('POST', `/api/admin/groups/${group.id}/members`, { username: 'drill-participant' });
	if (member.status >= 300) throw new Error(`add member: ${member.status}`);
	await expectStatus(participant('GET', '/api/study/tasks/drill-water'), 200, 'open task');
	const attempt = await participant('POST', '/api/study/tasks/drill-water/submissions', { graph, query: waterQuery });
	if (attempt.status >= 300) throw new Error(`submit attempt: ${attempt.status} ${JSON.stringify(attempt.json)}`);
}

/** md5 of every public table's rows in a stable order, one "table:hash" per table. */
function snapshot(name) {
	const sql = `SELECT string_agg(c.relname || ':' || (xpath('/row/h/text()', query_to_xml(format(
		'select md5(coalesce(string_agg(t::text, ''|'' order by t::text), '''')) as h from %I t', c.relname),
		false, true, '')))[1]::text, ' ' ORDER BY c.relname)
		FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'`;
	return must(compose(name, ['exec', '-T', 'db', 'psql', '-U', 'easyquery', '-d', 'easyquery', '-At', '-c', sql]), 'snapshot').trim();
}
const inBackup = (name, script) => must(compose(name, ['exec', '-T', 'backup', 'sh', '-c', script]), script).trim();

async function verifyRestored(label, expected) {
	const restored = snapshot('b');
	check(`${label}: every table equals the source`, restored === expected, `${restored} != ${expected}`);
	const participant = client();
	const login = await participant('POST', '/api/auth/login', credentials('drill-participant'));
	check(`${label}: the participant logs in`, login.status === 200, String(login.status));
	const consent = await participant('GET', '/api/study/consent');
	check(`${label}: the consent is kept`, JSON.stringify(consent.json).includes('"accepted'), JSON.stringify(consent.json));
	const attempts = await participant('GET', '/api/study/submissions?task=drill-water');
	check(`${label}: the attempt is kept`, attempts.status === 200 && attempts.json.data.length === 1, JSON.stringify(attempts.json));
}

function writeEnv(name, schedule, recipient) {
	const path = join(work, `${name}.env`);
	writeFileSync(
		path,
		[
			'POSTGRES_PASSWORD=restore-drill-only',
			'WEB_PORT=18200',
			'EASYQUERY_ENVIRONMENT=production',
			'EASYQUERY_ADMIN_USERNAMES=drill-admin',
			'EASYQUERY_AUTH_ATTEMPTS_PER_MINUTE=1000',
			`BACKUP_DIR=${backups}`,
			`BACKUP_OFFSITE_DIR=${join(backups, 'offsite')}`,
			`BACKUP_SCHEDULE=${schedule}`,
			`BACKUP_AGE_RECIPIENT=${recipient}`,
			''
		].join('\n')
	);
}

try {
	writeEnv('a', '* * * * *', '');
	must(compose('a', ['build', 'backup']), 'build backup image');
	const keys = must(run('docker', ['run', '--rm', 'easyquery-backup:test', 'age-keygen']), 'age-keygen');
	const recipient = keys.match(/public key: (age1\w+)/)[1];
	const identity = join(work, 'drill.agekey');
	writeFileSync(identity, keys);
	chmodSync(identity, 0o600);
	writeEnv('a', '* * * * *', recipient);
	writeEnv('b', '0 0 1 1 *', recipient);

	// Retention on dummy files: one dump per day from 1 September to 20 October 2026 plus a second on the 20th.
	const names = [];
	for (let day = new Date(Date.UTC(2026, 8, 1)); day <= new Date(Date.UTC(2026, 9, 20)); day.setUTCDate(day.getUTCDate() + 1))
		names.push(`easyquery-${day.toISOString().slice(0, 10).replaceAll('-', '')}T021700Z.dump`);
	names.push('easyquery-20261020T150000Z.dump', 'notes.txt', '.partial-easyquery-20261020T160000Z.dump');
	const left = must(
		run('docker', ['run', '--rm', '-v', `${join(work, 'prune')}:/p:z`, 'easyquery-backup:test', 'sh', '-c',
			`cd /p && touch ${names.map((n) => `'${n}'`).join(' ')} && easyquery-prune /p >/dev/null && ls -A /p`]),
		'retention'
	).trim().split('\n').sort();
	const expected = ['14', '15', '16', '17', '18', '19'].map((d) => `easyquery-202610${d}T021700Z.dump`)
		.concat(['easyquery-20261004T021700Z.dump', 'easyquery-20261011T021700Z.dump', 'easyquery-20261020T150000Z.dump', '.partial-easyquery-20261020T160000Z.dump', 'notes.txt'])
		.sort();
	check('retention keeps the newest dump of 7 days and 4 weeks, nothing else matching', JSON.stringify(left) === JSON.stringify(expected), left.join(' '));

	must(compose('a', ['up', '--build', '--detach', '--wait', '--wait-timeout=600']), 'start project a');
	await seed();
	const source = snapshot('a');
	let listing = '';
	for (let second = 0; second < 90 && !/\.dump\.age/.test(listing); second += 5) {
		spawnSync('sleep', ['5']);
		listing = inBackup('a', 'ls -l /backups /offsite');
	}
	check('the schedule writes a dump and an encrypted off-host copy', /easyquery-\d{8}T\d{6}Z\.dump\.age/.test(listing), listing);
	check('dumps are readable by their owner only', !/^-(?!rw-------)/m.test(listing), listing);
	check('the off-host copy is not a readable dump', inBackup('a', 'pg_restore --list /offsite/*.age >/dev/null 2>&1 && echo readable || echo encrypted') === 'encrypted');
	const dump = inBackup('a', 'ls /backups | grep -E "^easyquery-.*\\.dump$" | sort | tail -1');
	check('the database did not change while backing up', snapshot('a') === source);
	const failed = inBackup('a', 'before=$(ls -A /backups | sort); PGPASSWORD=wrong easyquery-backup 2>&1; echo "exit=$?"; [ "$before" = "$(ls -A /backups | sort)" ] && echo unchanged');
	check('a failed dump is logged and leaves the directory unchanged', /FAILED/.test(failed) && /exit=1/.test(failed) && /unchanged/.test(failed), failed);
	must(compose('a', ['down', '--volumes', '--remove-orphans']), 'stop project a');

	must(compose('b', ['up', '--detach', '--wait', '--wait-timeout=600']), 'start fresh project b');
	check('the fresh project starts with an empty, migrated database', snapshot('b') !== source);
	must(run('sh', ['scripts/restore-backup.sh', dump], { env: project('b') }), 'restore the plain dump');
	await verifyRestored('plain dump', source);
	const logs = must(compose('b', ['logs', '--no-color', 'backend']), 'logs');
	check('the backend started on the restored database', /database migrations applied/.test(logs));

	must(run('sh', ['scripts/restore-backup.sh', `${dump}.age`, identity], { env: project('b') }), 'restore the encrypted copy');
	await verifyRestored('encrypted copy with the private key', source);
} catch (error) {
	failures += 1;
	console.error(error instanceof Error ? error.message : error);
	for (const name of ['a', 'b']) compose(name, ['logs', '--no-color', '--tail=40', 'backup', 'backend'], { stdio: 'inherit' });
} finally {
	for (const name of ['a', 'b']) compose(name, ['down', '--volumes', '--remove-orphans']);
	// The dumps belong to root inside the container.
	run('docker', ['run', '--rm', '-v', `${work}:/w:z`, 'easyquery-backup:test', 'sh', '-c', 'rm -rf /w/backups /w/prune']);
	run('rm', ['-rf', work]);
}
console.log(failures ? `${failures} check(s) failed` : 'Backup and restore drill passed');
process.exit(failures ? 1 : 0);
