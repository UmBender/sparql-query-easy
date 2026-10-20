---
id: DEC-016
title: Decide how the T10 brief changes the test and CI contract of QUAL-007
status: BLOCKED
priority: P1
type: decision
depends_on: [QUAL-007]
human_gate: true
created: 2026-10-20
updated: 2026-10-20
---
# Decide how the T10 brief changes the test and CI contract of QUAL-007

## Objective

The T10 brief (2026-10-20, test infrastructure and CI) restates QUAL-007
(REVIEW: all layers built and green locally, first GitHub run pending a
push). Most of the brief is already done or is an additive gap
(QUAL-012 to QUAL-015, DOC-004). Three points make a different decision from
QUAL-007 or DEC-012. The user chooses for each. QUAL-016 (CI) waits for this
card; nothing else does.

## Already decided, not reopened

- Vitest `server` (node) and `client` (browser mode, Firefox) projects;
  offline browser suites (QUAL-003 `tests/support/offline.ts`).
- Contract: `FrontendOpenApiSnapshotTest` keeps `src/lib/api/openapi.json`
  equal to Ktor's spec; `schema.d.ts` carries the snapshot's SHA-256 and
  `api-contract.spec.ts` fails on drift; `tests-stack/pokemon.e2e.ts`
  compares the live `/openapi.json` with the snapshot (QUAL-007, FE-043).
- PostgreSQL in tests is `postgres:17-alpine` through Testcontainers
  (DEC-012, QUAL-011). PokemonGen1 is the deterministic dataset; no live
  Wikidata in ordinary gates.
- GitHub Actions in `.github/workflows/ci.yml`; no deploy, no secrets.

## Evidence (2026-10-20)

- `frontend/playwright.stack.config.ts` (`npm run test:stack`): builds Ktor,
  starts `StackPostgres` (Testcontainers) and the distribution on 18096, and
  serves the e2e build through `vite preview` with `API_TARGET`. It does not
  use `compose.yaml` or Caddy. Study data is seeded through the API
  (`seedStudy`, `joinStudy` in `tests-stack/support.ts`), not SQL.
- `compose.yaml` (OPS-006): `db`, `backend`, `web` (Caddy); checked by hand
  with `docker compose up --build` per the runbook; no automated test.
- `ci.yml`: triggers `push` to `main`, `pull_request`, `workflow_dispatch`;
  no `schedule`. Jobs `kotlin` and `frontend`; the frontend job runs check,
  lint, `npm test` (Vitest, build, Playwright with screenshots and axe) and
  `test:stack` on every trigger. `frontend/test-results/` is uploaded only on
  failure; `playwright-report/` is never uploaded.
- axe: `tests/styleguide.e2e.ts`, `tests/visual.e2e.ts`,
  `tests-stack/study-participant.e2e.ts` and `study-questionnaires.e2e.ts`
  expect **no violations of any impact**.
- `main` is 69 commits ahead of `origin/main`; the workflow has never run on
  GitHub.

## Conflicts and open questions

| # | T10 brief | Current record | Affects if changed |
|---|---|---|---|
| Q1 | E2E "against the full stack started by docker compose with a test database and seed data" | QUAL-007/QUAL-011: `test:stack` starts Testcontainers PostgreSQL, the Ktor distribution and `vite preview`; data seeded through the API | Runner time, Docker Compose on the CI runner, the Caddy proxy and same-origin cookies under test, a seed mechanism, the `test:stack` command in the Operational Map |
| Q2 | lint/check/unit/integration/contract "on every push"; e2e, visual and a11y "on merges to main or nightly" | QUAL-007: every gate on every push to `main` and every pull request | Whether a pull request can merge without e2e, screenshots and axe; push triggers on other branches; a `schedule` trigger |
| Q3 | "serious violations fail the run" | All axe checks fail on any violation | Whether minor/moderate violations become allowed |

## Options and recommendation

- **Q1 stack.** A: keep `test:stack` as the only real-stack e2e layer.
  B: replace it with Playwright against `docker compose` using a test
  override (fresh `db` volume, seed through the API), as the brief says.
  C: keep `test:stack` for every pull request and add a separate
  compose-based run of a small smoke subset (login, one PokemonGen1 query,
  one study page through Caddy) on `main` and nightly (recommended: DEC-012
  stays intact and the fast layer keeps its speed, while the production
  images and the Caddy `/api` proxy finally get an automated check; B would
  re-litigate DEC-012 for every e2e run). B or C creates a new card for the
  compose run.
- **Q2 CI tiers.** A: keep every gate on every pull request and push to
  `main`, add a nightly `schedule` and run the fast job (check, lint, Vitest,
  contract) on pushes to any branch (recommended: no change can merge
  unchecked; the repository is small enough that the full gate is affordable
  per PR). B: the brief's tiers literally: the fast job on every push, e2e,
  visual and a11y only on `main` and nightly.
- **Q3 axe threshold.** A: keep failing on every violation (recommended: it
  already passes and satisfies "serious violations fail"). B: fail only on
  `serious` and `critical`, report the rest.

## Decision

Pending the user's answers to Q1–Q3.
