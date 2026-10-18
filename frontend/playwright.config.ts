import { defineConfig } from '@playwright/test';

// New-app suite only; the legacy suite keeps testDir frontend-tests at the repository root.
export default defineConfig({
	testDir: 'tests',
	testMatch: '**/*.e2e.ts',
	// One browser at a time, like the legacy suite: parallel Firefox instances time out here.
	workers: 1,
	fullyParallel: false,
	webServer: {
		command: 'npx vite build --mode e2e --minify false && npm run preview',
		port: 4173
	},
	use: { baseURL: 'http://localhost:4173', browserName: 'firefox', headless: true }
});
