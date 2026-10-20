---
id: QUAL-017
title: Smoke-test the Docker Compose stack through Caddy on main and nightly
status: REVIEW
priority: P1
type: quality
depends_on: [DEC-016, OPS-006, QUAL-016]
human_gate: true
created: 2026-10-20
updated: 2026-10-20
---
# Smoke-test the Docker Compose stack through Caddy on main and nightly

## Objective

DEC-016 Q1 C. `test:stack` (Testcontainers, `vite preview`) stays the
real-stack e2e layer. The production images and Caddy's `/api` proxy have no
automated check: OPS-006 verifies `docker compose up --build` by hand. This
card adds a small Playwright smoke against the compose stack. `human_gate`:
the CI run needs a push. Skill: `tcc-test`.

## Confirmed entry points

- `compose.yaml` (`db`, `backend`, `web`), `deploy/web.Dockerfile`,
  `deploy/Caddyfile`, `Dockerfile`; runbook
  `tcc/07 - Operations/Docker Compose Stack.md`.
- `frontend/tests-stack/support.ts`: `joinStudy`, `seedStudy` (API seeding).
- `.github/workflows/ci.yml` after QUAL-016 (triggers, nightly `schedule`).

## Scope

- A test override (`compose.test.yaml`, proposed name): fresh `db` volume,
  test-only secrets, `web` published on a local port; no change to
  `compose.yaml` behaviour.
- A Playwright config and one or a few specs (proposed:
  `frontend/playwright.compose.config.ts`, `tests-compose/`) through the
  `web` origin: register and log in, run one PokemonGen1 query, open one
  study page after API seeding. Offline guard as in the other suites.
- A command (proposed `npm --prefix frontend run test:compose`) that brings
  the stack up, runs the specs and tears it down with its volume.
- A CI job on pushes to `main` and the nightly schedule only, uploading its
  Playwright report.
- Operational Map rows (command, CI) and the runbook.

## Out of scope

- Replacing `test:stack` or moving its specs (DEC-012 stays).
- Wikidata, deploy, a registry, the university server.

## Acceptance criteria

- [x] Locally, the command passes from a clean Docker state and leaves no
  container or volume behind.
- [x] Breaking the Caddy `/api` proxy (verified once, reverted) fails the
  smoke and does not fail `test:stack`.
- [ ] On GitHub, the job runs on `main` and nightly, not on pull requests or
  other branches.

## Validation

Focused: the proposed `test:compose` command. Closing: the CI row of the
Operational Map plus `docker compose up --build` per the runbook.

## Execution log

- 2026-10-20: `compose.test.yaml` (db data in tmpfs, images tagged `:test`),
  `deploy/compose-test.env` (throwaway password, `WEB_PORT=18097`,
  production mode, admin `stack-admin`, attempt limit 1000; used with
  `--env-file`, so `.env` is not read; the script also drops those names from
  its environment). `frontend/scripts/test-compose.mjs` (`npm run
  test:compose`): `up --build --detach --wait` as project `easyquery-test`,
  Playwright `playwright.compose.config.ts`, logs on failure, always `down
  --volumes --remove-orphans`. `compose.yaml` unchanged.
- `tests-compose/smoke.e2e.ts` (4 tests, offline guard from tests-stack):
  `/health` = `{status: ok, database: ready}`, `/api/endpoints`,
  `/openapi.json`, Caddy's `nosniff` header, deep link served by the SPA
  fallback and redirected to login; registration through `/login` with an
  `HttpOnly` `Secure` cookie, reload keeps the session, logout gives 401; the
  saved Fire query through Upload Query, Run Query (`Stage 1 of 2: ?pokemon`,
  `?speed` being the value-variable stage) with the seven captured
  candidates as a multiset; `seedStudy` through the admin API, `/study` lists
  three tasks, the task is answered correctly. Uses EditorPage and TaskPage
  (QUAL-013) without the e2e hook, which the production build lacks.
- Fixed in my own spec while running it: a 33-character username (limit 32),
  a call to the e2e hook, a stage count that ignored the value-variable
  stage, and reading candidates before they loaded. No product change.
- CI: job `compose-smoke` on pushes to `main`, the schedule and manual runs
  only; uploads `compose-playwright-report` unless cancelled and
  `compose-test-results` on failure. actionlint clean.
- Acceptance (local): passed twice in a row; afterwards no container or
  volume with the `easyquery-test` label (network removed too). With
  `/api/*` removed from the Caddy `@backend` matcher, all 4 smoke tests
  failed and `test:stack` passed 20; reverted.
- Docs: runbook section, Operational Map (Compose row, command, CI and
  packaging gates).
- REVIEW (human gate): confirm on GitHub that the job runs on `main` and
  nightly and not on pull requests or other branches.
- GitHub evidence: `compose-smoke` green on `main` in runs 39509582323 and
  39513553250 and skipped on the pushes of `t10-red-contract` and
  `t10-red-screenshot` (other branches). Still to see: a pull request run
  skips it and the nightly run runs it.
- Commit: completion commit for this task.
