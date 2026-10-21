#!/usr/bin/env node
// OPS-008: start compose.yaml in the HTTPS modes `auto` and `proxy` (local is
// QUAL-017's test:compose) as throwaway projects easyquery-https-<mode> with
// the compose.test.yaml override (tmpfs database, `:test` images) and
// deploy/test/https-<mode>.env instead of .env, check them with curl, then
// remove each project whatever the result. Needs Docker with Compose v2.24+
// and curl. Usage: node scripts/check-https-modes.mjs [auto] [proxy]
import { spawnSync } from 'node:child_process';

const repository = new URL('..', import.meta.url).pathname;
const modes = process.argv.slice(2).length ? process.argv.slice(2) : ['auto', 'proxy'];
// The env files decide these; a value exported in the shell would win over them.
const env = { ...process.env };
for (const name of Object.keys(env)) if (/^(POSTGRES_|EASYQUERY_|WEB_|EDGE_)/.test(name)) delete env[name];

const run = (command, args, options = {}) => spawnSync(command, args, { encoding: 'utf8', env, ...options });

function compose(mode) {
	const files = ['compose.yaml', 'compose.test.yaml', ...(mode === 'proxy' ? ['deploy/test/compose.edge.yaml'] : [])];
	return [
		'compose',
		`--project-name=easyquery-https-${mode}`,
		`--project-directory=${repository}`,
		`--env-file=${repository}deploy/test/https-${mode}.env`,
		...files.map((file) => `--file=${repository}${file}`)
	];
}

/** One request without following redirects: status, lower-case headers and body. */
function request(url, { method = 'GET', headers = {}, body, curl = [] } = {}) {
	const args = ['--silent', '--show-error', '--insecure', '--include', '--request', method, ...curl];
	for (const [name, value] of Object.entries(headers)) args.push('--header', `${name}: ${value}`);
	if (body !== undefined) args.push('--header', 'Content-Type: application/json', '--data', JSON.stringify(body));
	const result = run('curl', [...args, url]);
	if (result.status !== 0) throw new Error(`curl ${url}: ${result.stderr.trim()}`);
	const [head, ...rest] = result.stdout.split('\r\n\r\n');
	const [statusLine, ...lines] = head.split('\r\n');
	const responseHeaders = {};
	for (const line of lines) {
		const at = line.indexOf(':');
		const name = line.slice(0, at).trim().toLowerCase();
		responseHeaders[name] = [responseHeaders[name], line.slice(at + 1).trim()].filter(Boolean).join('\n');
	}
	return { status: Number(statusLine.split(' ')[1]), headers: responseHeaders, body: rest.join('\r\n\r\n') };
}

let failures = 0;
function check(name, condition, detail = '') {
	console.log(`${condition ? 'ok  ' : 'FAIL'} ${name}${condition || !detail ? '' : ` (${detail})`}`);
	if (!condition) failures += 1;
}

const credentials = (username) => ({ username, password: 'https-check-password-1' });

function checkAuto() {
	const origin = 'https://easyquery.localhost:18543';
	const curl = ['--resolve', 'easyquery.localhost:18543:127.0.0.1', '--resolve', 'easyquery.localhost:18180:127.0.0.1'];
	const health = request(`${origin}/health`, { curl });
	check('HTTPS /health reports a ready database', health.status === 200 && health.body.includes('"ready"'), health.body);
	const page = request(`${origin}/login`, { curl });
	check('HTTPS serves the SPA fallback', page.status === 200 && /<!doctype html>/i.test(page.body), String(page.status));
	check('HSTS header on HTTPS', /max-age=31536000/.test(page.headers['strict-transport-security'] ?? ''));
	const endpoints = request(`${origin}/api/endpoints`, { curl });
	check('HTTPS proxies /api', endpoints.status === 200, String(endpoints.status));
	const plain = request('http://easyquery.localhost:18180/login', { curl });
	check(
		'HTTP redirects to HTTPS',
		[301, 308].includes(plain.status) && (plain.headers.location ?? '').startsWith('https://easyquery.localhost'),
		`${plain.status} ${plain.headers.location}`
	);
	const registered = request(`${origin}/api/auth/register`, {
		method: 'POST',
		headers: { Origin: origin },
		body: credentials('https-auto-user'),
		curl
	});
	const cookie = registered.headers['set-cookie'] ?? '';
	check('registration over HTTPS passes the same-origin check', registered.status === 201, registered.body);
	check('session cookie is Secure and HttpOnly', /Secure/i.test(cookie) && /HttpOnly/i.test(cookie), cookie);
	const untrusted = run('curl', ['--silent', ...curl, `${origin}/health`]);
	check("certificate comes from Caddy's internal CA (not trusted by curl)", untrusted.status !== 0);
}

function checkProxy() {
	const edge = 'http://localhost:18191';
	const direct = 'http://localhost:18190';
	const viaEdge = (client, path, body) =>
		request(`${edge}${path}`, { method: 'POST', headers: { Origin: edge, 'X-Test-Client': client }, body });
	const health = request(`${edge}/health`);
	check('/health through the proxy reports a ready database', health.status === 200 && health.body.includes('"ready"'), health.body);
	const registered = viaEdge('203.0.113.7', '/api/auth/register', credentials('https-proxy-user'));
	check('registration through the proxy passes the same-origin check', registered.status === 201, registered.body);
	const wrong = credentials('https-proxy-user');
	wrong.password = 'not-the-password-1';
	const statuses = [1, 2, 3].map(() => viaEdge('203.0.113.7', '/api/auth/login', wrong).status);
	check('the attempt limit counts the client named by the trusted proxy', statuses.join() === '401,401,429', statuses.join());
	const other = viaEdge('203.0.113.8', '/api/auth/login', wrong).status;
	check('another client behind the proxy has its own limit', other === 401, String(other));
	const forged = [1, 2, 3, 4].map(
		(n) =>
			request(`${direct}/api/auth/login`, {
				method: 'POST',
				headers: { Origin: direct, 'X-Forwarded-For': `198.51.100.${n}` },
				body: wrong
			}).status
	);
	check('a forged X-Forwarded-For from an untrusted address is ignored', forged.join() === '401,401,401,429', forged.join());
}

for (const mode of modes) {
	if (!['auto', 'proxy'].includes(mode)) throw new Error(`Unknown mode ${mode}: use auto or proxy`);
	console.log(`== ${mode}`);
	const args = compose(mode);
	try {
		const up = run('docker', [...args, 'up', '--build', '--detach', '--wait', '--wait-timeout=600'], { stdio: 'inherit' });
		if (up.status !== 0) {
			run('docker', [...args, 'logs', '--no-color', '--tail=100'], { stdio: 'inherit' });
			throw new Error(`The ${mode} stack did not become healthy`);
		}
		if (mode === 'auto') checkAuto();
		else checkProxy();
	} catch (error) {
		failures += 1;
		console.error(error instanceof Error ? error.message : error);
	} finally {
		if (failures) run('docker', [...args, 'logs', '--no-color', '--tail=60', 'web'], { stdio: 'inherit' });
		run('docker', [...args, 'down', '--volumes', '--remove-orphans'], { stdio: 'inherit' });
	}
}
console.log(failures ? `${failures} check(s) failed` : 'All HTTPS mode checks passed');
process.exit(failures ? 1 : 0);
