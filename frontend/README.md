# SPARQL EasyQuery frontend

SvelteKit 3 (Svelte 5 runes, strict TypeScript, Vite) built as a static SPA
with adapter-static, next to the legacy `sparql/index2.html` (DEC-011). See the
root README for running both side by side.

| Command         | Purpose                                                                        |
| --------------- | ------------------------------------------------------------------------------ |
| `npm ci`        | Install from `package-lock.json`                                               |
| `npm run dev`   | Dev server on 5173; proxies `/api`, `/health`, `/openapi.json` to Ktor on 8080 |
| `npm run build` | Static SPA in `build/` (`index.html` fallback)                                 |
| `npm run check` | svelte-check                                                                   |
| `npm run lint`  | Prettier check and ESLint                                                      |
| `npm test`      | Vitest (`src/**/*.spec.ts`), then Playwright (`tests/*.e2e.ts`, offline)       |

Layout: `src/lib/domain` (pure TypeScript), `src/lib/stores`, `src/lib/api`,
`src/lib/components` (`ui/` for shadcn-svelte), `src/lib/features/<feature>`,
`src/routes`. Import library code with `#lib/...` and a `.js` extension.

Playwright is pinned to the root suite's version so both share the installed
browsers. npm 10 fails while resolving new dependencies (`edgesOut` error in
peer resolution); add or update packages with `npx npm@11 install ...`.
`npm ci` works with either version.
