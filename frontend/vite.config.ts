import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// SPA fallback: every unknown path serves index.html (DEC-011).
			adapter: adapter({ fallback: 'index.html' })
		})
	],
	// Same origin in development: the browser calls Vite, which forwards these paths to Ktor.
	server: {
		proxy: Object.fromEntries(
			['/api', '/health', '/openapi.json'].map((path) => [path, 'http://localhost:8080'])
		)
	},
	test: {
		expect: { requireAssertions: true },
		// FE-042: the framework-free domain keeps at least 90% line and branch coverage.
		coverage: {
			provider: 'v8',
			include: ['src/lib/domain/**/*.ts'],
			exclude: ['src/lib/domain/**/*.spec.ts', 'src/lib/domain/legacy/oracle-assert.ts'],
			reporter: ['text-summary', 'text'],
			thresholds: { lines: 90, branches: 90 }
		},
		projects: [
			{
				// Component tests (*.svelte.spec.ts) run in Firefox, like the Playwright suites.
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						headless: true,
						instances: [{ browser: 'firefox' }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
