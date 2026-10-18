import { defineConfig } from '@playwright/test';

// New-app suite only; the legacy suite keeps testDir frontend-tests at the repository root.
export default defineConfig({
	testDir: 'tests',
	testMatch: '**/*.e2e.ts',
	webServer: { command: 'npm run build && npm run preview', port: 4173 },
	use: { baseURL: 'http://localhost:4173', browserName: 'firefox', headless: true }
});
