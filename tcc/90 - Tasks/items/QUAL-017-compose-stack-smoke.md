---
id: QUAL-017
title: Smoke-test the Docker Compose stack through Caddy on main and nightly
status: BACKLOG
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

- [ ] Locally, the command passes from a clean Docker state and leaves no
  container or volume behind.
- [ ] Breaking the Caddy `/api` proxy (verified once, reverted) fails the
  smoke and does not fail `test:stack`.
- [ ] On GitHub, the job runs on `main` and nightly, not on pull requests or
  other branches.

## Validation

Focused: the proposed `test:compose` command. Closing: the CI row of the
Operational Map plus `docker compose up --build` per the runbook.
