---
id: FE-040
title: Scaffold the SvelteKit app in frontend/ beside the legacy page
status: DONE
priority: P1
type: frontend
depends_on: [DEC-011]
human_gate: false
created: 2026-10-16
updated: 2026-10-17
---
# Scaffold the SvelteKit app in frontend/ beside the legacy page

## Objective

T1 of the migration ([[DEC-011-frontend-stack-decision]]). A developer runs the
new app next to the legacy page and reaches the Ktor API through it. Skill:
`tcc-frontend`.

## Scope

- `frontend/`: SvelteKit + adapter-static (SPA fallback), Svelte 5, strict
  TypeScript, Vite, ESLint/Prettier, Vitest with one passing test.
- Folder layout: `src/lib/domain` (pure TS), `src/lib/stores`, `src/lib/api`,
  `src/lib/components`, `src/lib/features/<feature>`, `src/routes`
  (empty folders keep a short README or `.gitkeep`).
- Playwright configured inside `frontend/` with one passing offline smoke test
  (the page renders; `/health` stubbed, QUAL-003 egress rule). The legacy
  configs keep `testDir: frontend-tests`, so the suites stay separate.
- Tailwind CSS and shadcn-svelte installed with their default setup only;
  FE-041 owns tokens, theme and component styling.
- Vite dev proxy for `/api`, `/health`, `/openapi.json` to `localhost:8080`.
- One page that shows the backend health from `/health`.
- npm scripts (proposed): `dev`, `build`, `check` (svelte-check), `lint`
  (ESLint + Prettier check), `test`.
- Root `README.md`: a section on running the legacy page and the new app side
  by side (Ktor on 8080 serving `index2.html`, Vite dev server proxying to it).
- Operational Map: new paths and the proposed new-app gate.
- Root `.dockerignore`/`.gitignore` exclude `frontend/node_modules` and build output.

Excluded: design tokens and theme (FE-041), domain (FE-042), production
serving (OPS-006), real e2e/visual/a11y layers (QUAL-007), any change to
`sparql/`, `build.gradle.kts` or Ktor.

## Acceptance criteria

- [x] From a clean clone, `npm --prefix frontend ci` followed by `build`,
      `check`, `lint` and `test` all pass (Vitest and Playwright examples);
      `build` emits a static SPA.
- [x] The folder layout above exists and `svelte-check` reports no errors.
- [x] Tailwind utility classes render on the placeholder page; no tokens or
      custom theme are defined yet.
- [x] With Ktor running, the dev page shows `{"status":"ok"}` through the proxy (no CORS).
- [x] The README side-by-side section is followed verbatim and both
      frontends load at the same time.
- [x] Legacy gates unchanged: `npm run test:browser` still passes.

## Validation

New-app commands above (proposed until this card adds them); legacy
`npm run test:browser`; docs check.

## Execution log

- 2026-10-16: User confirmed the T1 brief additions (lint script, folder
  layout, Playwright smoke test, Tailwind/shadcn-svelte install, README
  section) and they were merged into scope; FE-041 narrowed to match.
- 2026-10-17: Scaffolded with `sv@1.1.1` (SvelteKit 3, Svelte 5,
  TypeScript, Vite 8, Prettier, ESLint, Vitest, Playwright, Tailwind 4,
  adapter-static with `index.html` fallback) and `shadcn-svelte@1.7.0 init`
  (default preset, neutral base colour, `#lib` aliases). SvelteKit 3 uses
  `#lib/...` subpath imports with a `.js` extension instead of `$lib`.
  Playwright is pinned to 1.63.0 to share the root suite's browsers. npm 10
  fails while resolving new dependencies (`edgesOut`); dependencies are added
  with `npx npm@11 install`, and `npm ci` works with npm 10. Validation:
  `check`, `lint`, `test` (2 Vitest cases and the offline Playwright smoke)
  and `npm --prefix frontend ci` pass; a live run with Ktor on 8080 and Vite
  on 5173 showed `{"status":"ok"}` through the proxy while `index2.html`
  loaded. Legacy `npm run test:browser`: 122 passed, 1 intermittent
  failure in the unchanged `QUAL-005 each node kind offers exactly its
  actions` test (failed 1 of 3 repeats; background requests counted after
  the baseline), not caused by this card.
