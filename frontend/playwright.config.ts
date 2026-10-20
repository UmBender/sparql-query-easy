import { defineConfig } from '@playwright/test';

// Offline browser suite with the mocked API; tests-stack/ runs against the real backend.
export default defineConfig({
	testDir: 'tests',
	testMatch: '**/*.e2e.ts',
	// Full-page screenshots run only in the pinned image (npm run test:screens, QUAL-014).
	testIgnore: 'screens.e2e.ts',
	// One browser at a time, like the legacy suite: parallel Firefox instances time out here.
	workers: 1,
	fullyParallel: false,
	// QUAL-016: CI keeps every run's HTML report as an artifact.
	reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/e2e' }]],
	webServer: {
		command: 'npx vite build --mode e2e --minify false && npm run preview',
		port: 4173
	},
	use: { baseURL: 'http://localhost:4173', browserName: 'firefox', headless: true }
});
