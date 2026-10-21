#!/usr/bin/env node
// QUAL-014: run tests/screens.e2e.ts inside mcr.microsoft.com/playwright at the
// pinned @playwright/test version, so fonts and Firefox are the same on every
// machine and in CI. The repository is mounted with its installed node_modules;
// the container has no network (the suite is offline anyway). Extra arguments go
// to `playwright test`, e.g. `npm run test:screens -- --update-snapshots`; a
// `--config=` argument replaces the screens config (DOC-006 `help:screens`).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { userInfo } from 'node:os';

const frontend = new URL('..', import.meta.url).pathname;
const repository = new URL('../..', import.meta.url).pathname;
const version = JSON.parse(readFileSync(`${frontend}package.json`, 'utf8')).devDependencies[
	'@playwright/test'
];
const image = `mcr.microsoft.com/playwright:v${version}-noble`;
const { uid, gid } = userInfo();
const args = process.argv.slice(2);
const config =
	args.find((arg) => arg.startsWith('--config=')) ?? '--config=playwright.screens.config.ts';

const result = spawnSync(
	'docker',
	[
		'run',
		'--rm',
		'--ipc=host',
		'--network=none',
		// No SELinux relabelling of the mounted repository (Fedora).
		'--security-opt=label=disable',
		`--user=${uid}:${gid}`,
		'--env=HOME=/tmp',
		'--env=CI',
		`--volume=${repository}:/work`,
		'--workdir=/work/frontend',
		image,
		'npx',
		'playwright',
		'test',
		config,
		...args.filter((arg) => arg !== config)
	],
	{ stdio: 'inherit' }
);
if (result.error) {
	console.error(`test:screens needs Docker and the image ${image}: ${result.error.message}`);
	process.exit(1);
}
process.exit(result.status ?? 1);
