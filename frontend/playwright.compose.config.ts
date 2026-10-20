import { defineConfig } from '@playwright/test';

/**
 * QUAL-017: the smoke of the Docker Compose stack (db, backend, web) through
 * Caddy on 127.0.0.1:18097 (deploy/compose-test.env). The stack is started and
 * removed by scripts/test-compose.mjs (`npm run test:compose`), not here.
 */
export default defineConfig({
	testDir: 'tests-compose',
	testMatch: '**/*.e2e.ts',
	workers: 1,
	fullyParallel: false,
	reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/compose' }]],
	outputDir: 'test-results/compose',
	use: {
		baseURL: 'http://localhost:18097',
		browserName: 'firefox',
		headless: true,
		serviceWorkers: 'block'
	}
});
