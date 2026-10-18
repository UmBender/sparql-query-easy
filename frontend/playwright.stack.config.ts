import { defineConfig } from '@playwright/test';

/**
 * The new app on the real stack (FE-046, QUAL-007): the built Ktor
 * distribution on 18096 and the e2e build served by `vite preview`, which
 * proxies the API to it (same origin), plus an empty embedded PostgreSQL on
 * 54329 for accounts. Offline: built-in and uploaded local graphs only.
 */
const API = 18096;
const DB = 54329;
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
			// AUTH-003: an empty embedded PostgreSQL (StackPostgres, test classpath) for the accounts;
			// SIGTERM to the process group lets its shutdown hook stop PostgreSQL.
			command: [
				'cd ..',
				'GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew installDist writeStackPostgresClasspath --no-daemon -q',
				'rm -f build/stack-postgres.ready',
				`{ java -cp "$(cat build/stack-postgres.classpath)" com.example.sparqlqueryeasy.persistence.StackPostgresKt ${DB} build/stack-postgres.ready & }`,
				'while [ ! -f build/stack-postgres.ready ]; do sleep 0.5; done',
				`EASYQUERY_DB_URL=jdbc:postgresql://127.0.0.1:${DB}/postgres EASYQUERY_DB_USER=postgres EASYQUERY_DB_PASSWORD=postgres ./build/install/sparql-query-easy-kotlin/bin/sparql-query-easy-kotlin -P:ktor.deployment.host=127.0.0.1 -P:ktor.deployment.port=${API}`
			].join(' && '),
			url: `${target}/health`,
			reuseExistingServer: false,
			timeout: 300_000,
			gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 }
		},
		{
			command: `API_TARGET=${target} npx vite build --mode e2e --minify false && API_TARGET=${target} npx vite preview --port ${WEB} --strictPort`,
			port: WEB,
			reuseExistingServer: false,
			timeout: 300_000
		}
	]
});
