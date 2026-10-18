---
id: OPS-007
title: Start only PostgreSQL for local development and reach it from ./gradlew run
status: BACKLOG
priority: P2
type: operations
depends_on: [OPS-006, BE-005]
human_gate: false
created: 2026-10-18
updated: 2026-10-18
---
# Start only PostgreSQL for local development and reach it from ./gradlew run

## Objective

T6 brief (2026-10-18): a local dev setup with PostgreSQL only. `compose.yaml`
(OPS-006) already defines `db`, but it publishes no host port, so a backend
started with `./gradlew run` cannot reach it. Today, accounts in local dev
need a hand-made PostgreSQL.

## Entry points

`compose.yaml` (`db` service, `db-data` volume, `POSTGRES_*` from `.env`),
`.env.example`, `README.md` "Run locally",
`tcc/07 - Operations/Docker Compose Stack.md`, `config/AppSettings.kt`
(`EASYQUERY_DB_URL/USER/PASSWORD/POOL_SIZE`).

## Scope

- Add a `compose.dev.yaml` override that publishes `db` on
  `127.0.0.1:${DB_PORT:-5432}` only. Start it with
  `docker compose -f compose.yaml -f compose.dev.yaml up -d --wait db`.
  It reuses the existing service, image and volume, so `compose.yaml` keeps
  its definition.
- Add commented local values for `EASYQUERY_DB_URL/USER/PASSWORD` to
  `.env.example`, matching the dev database. Commit no real secret.
- Document start, stop and reset in the README and the runbook.

## Out of scope

- Production deploy, TLS and backups (OPS-002/004/005).
- Changing the test database (DEC-012).
- Any new tables. Those come from the tasks that own them.

## Acceptance criteria

- [ ] On an empty volume, the command above starts only `db`, healthy, on
      127.0.0.1. `./gradlew run` with the documented variables migrates it
      (Flyway V1, V2), and register/login works.
- [ ] Without the override, `docker compose up` still publishes no database
      port (`docker compose config` shows it).
- [ ] `./gradlew run` without database variables still serves query routes.

## Validation

Manual runbook check (commands and outputs recorded in the log), plus
`docker compose -f compose.yaml -f compose.dev.yaml config`. Documentation
checks only; there is no product code change.
