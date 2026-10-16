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

## Proposed amendment (2026-10-16, pending user confirmation)

The T1 brief duplicates this card (conflict rule DUPLICATE). It does not
change the approved scope above; it adds the T1 items this card lacks.
Apply only after the user confirms.

Additional scope:

- `lint` script (ESLint + Prettier check) beside `dev`, `build`, `check`, `test`.
- Folder layout: `src/lib/domain` (pure TS), `src/lib/stores`, `src/lib/api`,
  `src/lib/components`, `src/lib/features/<feature>`, `src/routes`
  (empty folders keep a short README or `.gitkeep`).
- Playwright installed and configured inside `frontend/` with one passing
  offline smoke test (the page renders; `/health` stubbed, QUAL-003 egress
  rule). The legacy configs keep `testDir: frontend-tests`, so the suites stay
  separate. Real e2e/visual/a11y layers stay in QUAL-007.
- Tailwind CSS and shadcn-svelte installed with their default setup only;
  tokens, theme and component styling stay in FE-041 (FE-041 then configures
  instead of installing).
- Root `README.md`: a section on running the legacy page and the new app side
  by side (Ktor on 8080 serving `index2.html`, Vite dev server proxying to it).

Additional acceptance criteria:

- [ ] From a clean clone, `npm --prefix frontend ci` followed by `build`,
      `check`, `lint` and `test` all pass (Vitest and Playwright examples).
- [ ] The folder layout above exists and `svelte-check` reports no errors.
- [ ] Tailwind utility classes render on the placeholder page; no tokens or
      custom theme are defined yet.
- [ ] The README side-by-side section is followed verbatim and both
      frontends load at the same time.
