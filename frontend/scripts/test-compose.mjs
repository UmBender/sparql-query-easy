#!/usr/bin/env node
// QUAL-017: build and start compose.yaml with the compose.test.yaml override as
// the project easyquery-test (fresh tmpfs database, deploy/compose-test.env),
// run the Playwright smoke in tests-compose/ through Caddy, then remove the
// project's containers, network and volumes whatever the result. Needs Docker
// with Compose v2.24 or newer. Extra arguments go to `playwright test`.
import { spawnSync } from 'node:child_process';

const repository = new URL('../..', import.meta.url).pathname;
const frontend = new URL('..', import.meta.url).pathname;
// deploy/compose-test.env decides these; a value exported in the shell would win over it.
const env = { ...process.env };
for (const name of [
	'POSTGRES_DB',
	'POSTGRES_USER',
	'POSTGRES_PASSWORD',
	'WEB_PORT',
	'EASYQUERY_ENVIRONMENT',
	'EASYQUERY_ADMIN_USERNAMES',
	'EASYQUERY_AUTH_ATTEMPTS_PER_MINUTE',
	'EASYQUERY_EXTREME_RESULT_LIMIT'
])
	delete env[name];
const compose = [
	'compose',
	'--project-name=easyquery-test',
	`--project-directory=${repository}`,
	`--env-file=${repository}deploy/compose-test.env`,
	`--file=${repository}compose.yaml`,
	`--file=${repository}compose.test.yaml`
];
const run = (command, args, options = {}) =>
	spawnSync(command, args, { stdio: 'inherit', env, ...options });

let status = 1;
try {
	const up = run('docker', [
		...compose,
		'up',
		'--build',
		'--detach',
		'--wait',
		'--wait-timeout=600'
	]);
	if (up.error) throw new Error(`test:compose needs Docker Compose: ${up.error.message}`);
	if (up.status !== 0) {
		run('docker', [...compose, 'logs', '--no-color', '--tail=200']);
		throw new Error('The compose stack did not become healthy');
	}
	const smoke = run(
		'npx',
		['playwright', 'test', '--config=playwright.compose.config.ts', ...process.argv.slice(2)],
		{ cwd: frontend }
	);
	status = smoke.status ?? 1;
	if (status !== 0)
		run('docker', [...compose, 'logs', '--no-color', '--tail=100', 'web', 'backend']);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
} finally {
	run('docker', [...compose, 'down', '--volumes', '--remove-orphans']);
}
process.exit(status);
