---
id: QUAL-007
title: Add the new frontend test layers and a GitHub Actions CI for all gates
status: DONE
priority: P1
type: quality
depends_on: [FE-040, FE-043]
human_gate: false
created: 2026-10-16
updated: 2026-10-18
---
# Add the new frontend test layers and a GitHub Actions CI for all gates

## Objective

T10. Skill: `tcc-test`. Deployment stays in OPS-005/OPS-006.

## Scope

- New app: Vitest browser mode, MSW handlers from the OpenAPI types, contract
  test against `/openapi.json`, Playwright e2e on the real stack with
  PokemonGen1, screenshot tests, @axe-core/playwright; all offline (QUAL-003
  egress rule).
- `.github/workflows/ci.yml`: Kotlin gate, legacy browser and query suites,
  new-app check/test/e2e; no deploy, no secrets.
- Operational Map: the new commands and closing gates.

## Acceptance criteria

- [x] Each layer has at least one passing test and runs in CI (passing locally with the exact CI commands; first GitHub run pending a push).
- [x] A deliberately failing test fails CI (verified once, then reverted). Locally verified: a broken assertion in `mock-routes.spec.ts` made `npm test` exit 1. The GitHub run needs a human push.

## Execution log

- 2026-10-18: Layers. Vitest browser mode (existing `*.svelte.spec.ts`).
  `frontend/src/lib/api/mock-routes.ts`: API mock responses typed from
  `schema.d.ts` (drift fails `npm run check`), served by MSW in Vitest
  (`mswHandlers`, `mock-routes.spec.ts`: every route documented in the
  snapshot and answering every client call) and by `page.route` in Playwright
  (`tests/support/mock-api.ts` now uses them). Contract: `api-contract.spec.ts`
  and Kotlin `FrontendOpenApiSnapshotTest` (existing), plus
  `tests-stack/pokemon.e2e.ts` comparing Ktor's live `/openapi.json` with the
  snapshot. Real stack with PokemonGen1: the same test loads
  `fire-speed-at-least-90.query.json` and requires the staged candidates to
  equal the legacy capture (multiset). Screenshots: `tests/visual.e2e.ts`
  (canvas only, labels and overlays hidden so fonts do not matter). axe on the
  editor in both themes; fixes: sr-only `h1`, the toolbar form is a labelled
  landmark ("Query controls"), the badge layer has `role="group"` for its
  label; open Bits tooltips (portalled outside landmarks) are excluded.
- CI: `.github/workflows/ci.yml` (kotlin, legacy, frontend jobs; read-only
  token, no secrets, no deploy; reports uploaded on failure). Frontend installs
  with `npx npm@11 ci` (npm 10 reads the lockfile as out of sync; README
  corrected).
- Gate fixes found while running the CI commands: the legacy
  `playwright.config.mjs` picked up the Ktor-backed `fixtures-capture/`
  specs (24 failures with `npm run test:browser`), now ignored; QUAL-005
  "each node kind offers exactly its actions" raced the debounced funnel/badge
  counts from building the graph (2 extra `/api/query/count`), now waits for
  requests to settle (10/10 repeated runs).
- Validation (local, exact CI commands): Kotlin unchanged since the last
  green gate (reused); legacy `test:query` 70, `check:frontend-types`,
  `test:browser` 132, `test:e2e` 4; frontend check, lint, `npm test` (155
  Vitest server, 4 component, 73 Playwright), `test:stack` 6; docs check.
- REVIEW: the workflow has not run on GitHub (push not authorized in this
  session). After the first push, confirm the three jobs pass, and once that a
  deliberately failing test turns the run red. Screenshot baselines were
  generated on Fedora; if Ubuntu's Firefox canvas differs, regenerate them from
  the CI artifact.
- 2026-10-20 (QUAL-016): closed on GitHub. `main` pushed with the user's
  authorization; run 39513553250 green in every job after the
  `PostgresDatabaseTest` backoff fix. A snapshot-only field rename failed
  `kotlin` and `frontend-fast` (run 39509870303); a colour-token change
  failed `test:screens` on PR #2 (run 39516869500). Both throwaway branches
  deleted. The canvas baselines generated on Fedora passed on Ubuntu, so no
  regeneration was needed.
