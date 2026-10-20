import { defineConfig } from '@playwright/test';

/**
 * The new app on the real stack (FE-046, QUAL-007): the built Ktor
 * distribution on 18096 and the e2e build served by `vite preview`, which
 * proxies the API to it (same origin), plus an empty PostgreSQL container
 * (Testcontainers, QUAL-011; needs Docker) for accounts. No external SPARQL:
 * built-in and uploaded local graphs only.
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
			// AUTH-003, QUAL-011: an empty PostgreSQL container (StackPostgres, test classpath) for the
			// accounts; it writes its JDBC URL to the ready file. SIGTERM to the process group lets its
			// shutdown hook stop the container. AUTH-005: `stack-admin` registers as an admin. The study suites
			// (STUDY-003…007) log in many users from one address, so the attempt limit is raised.
			command: [
				'cd ..',
				'GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew installDist writeStackPostgresClasspath --no-daemon -q',
				'rm -f build/stack-postgres.ready',
				`{ java -cp "$(cat build/stack-postgres.classpath)" com.example.sparqlqueryeasy.persistence.StackPostgresKt build/stack-postgres.ready & }`,
				'while [ ! -f build/stack-postgres.ready ]; do sleep 0.5; done',
				`EASYQUERY_DB_URL="$(cat build/stack-postgres.ready)" EASYQUERY_DB_USER=postgres EASYQUERY_DB_PASSWORD=postgres EASYQUERY_ADMIN_USERNAMES=stack-admin EASYQUERY_AUTH_ATTEMPTS_PER_MINUTE=1000 ./build/install/sparql-query-easy-kotlin/bin/sparql-query-easy-kotlin -P:ktor.deployment.host=127.0.0.1 -P:ktor.deployment.port=${API}`
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
