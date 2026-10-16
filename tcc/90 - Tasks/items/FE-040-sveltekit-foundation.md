---
id: FE-040
title: Scaffold the SvelteKit app in frontend/ beside the legacy page
status: BACKLOG
priority: P1
type: frontend
depends_on: [DEC-011]
human_gate: false
created: 2026-10-16
updated: 2026-10-16
---
# Scaffold the SvelteKit app in frontend/ beside the legacy page

## Objective

T1 of the migration ([[DEC-011-frontend-stack-decision]]). A developer runs the
new app next to the legacy page and reaches the Ktor API through it. Skill:
`tcc-frontend`.

## Scope

- `frontend/`: SvelteKit + adapter-static (SPA fallback), Svelte 5, strict
  TypeScript, Vite, ESLint/Prettier, Vitest with one passing test.
- Vite dev proxy for `/api`, `/health`, `/openapi.json` to `localhost:8080`.
- One page that shows the backend health from `/health`.
- npm scripts (proposed): `dev`, `build`, `check` (svelte-check), `test`.
- Operational Map: new paths and the proposed new-app gate.
- Root `.dockerignore`/`.gitignore` exclude `frontend/node_modules` and build output.

Excluded: design system (FE-041), domain (FE-042), production serving
(OPS-006), any change to `sparql/`, `build.gradle.kts` or Ktor.

## Acceptance criteria

- [ ] `npm --prefix frontend run build` emits a static SPA; `check` and `test` pass.
- [ ] With Ktor running, the dev page shows `{"status":"ok"}` through the proxy (no CORS).
- [ ] Legacy gates unchanged: `npm run test:browser` still passes.

## Validation

New-app commands above (proposed until this card adds them); legacy
`npm run test:browser`; docs check.
