import { defineConfig } from '@playwright/test';

/**
 * The new app on the real stack (FE-046, QUAL-007): the built Ktor
 * distribution on 18096 and the e2e build served by `vite preview`, which
 * proxies the API to it (same origin). Offline: uploaded local Turtle only.
 */
const API = 18096;
const WEB = 4174;
const target = `http://127.0.0.1:${API}`;

export default defineConfig({
	testDir: 'tests-stack',
	testMatch: '**/*.e2e.ts',
	workers: 1,
	fullyParallel: false,
	use: {
		baseURL: `http://localhost:${WEB}`,
		browserName: 'firefox',
		headless: true,
		serviceWorkers: 'block'
	},
	webServer: [
		{
			command: `cd .. && GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew installDist --no-daemon -q && ./build/install/sparql-query-easy-kotlin/bin/sparql-query-easy-kotlin -P:ktor.deployment.host=127.0.0.1 -P:ktor.deployment.port=${API}`,
			url: `${target}/health`,
			reuseExistingServer: false,
			timeout: 300_000
		},
		{
			command: `API_TARGET=${target} npx vite build --mode e2e --minify false && API_TARGET=${target} npx vite preview --port ${WEB} --strictPort`,
			port: WEB,
			reuseExistingServer: false,
			timeout: 300_000
		}
	]
});
