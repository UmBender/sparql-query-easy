---
id: OPS-007
title: Start only PostgreSQL for local development and reach it from ./gradlew run
status: DONE
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

- [x] On an empty volume, the command above starts only `db`, healthy, on
      127.0.0.1. `./gradlew run` with the documented variables migrates it
      (Flyway V1, V2), and register/login works.
- [x] Without the override, `docker compose up` still publishes no database
      port (`docker compose config` shows it).
- [x] `./gradlew run` without database variables still serves query routes.

## Validation

Manual runbook check (commands and outputs recorded in the log), plus
`docker compose -f compose.yaml -f compose.dev.yaml config`. Documentation
checks only; there is no product code change.

## Result (2026-10-18)

- `compose.dev.yaml` publishes only `db` on
  `127.0.0.1:${DB_PORT:-5432}`. `compose.yaml` is unchanged.
- `.env.example`: commented `EASYQUERY_DB_URL/USER/PASSWORD` for the dev
  database, plus `DB_PORT`. No secret is committed.
- Docs: README "Run locally" (a new optional database step), the runbook
  section "Development database (OPS-007)" (start, stop, reset, shell, the
  shared volume, and not to use the override for the full stack), and the
  Operational Map compose row.

### Runbook check (Docker 29.8.2, Compose 5.6)

To keep the user's `.env` and the real `easyquery_db-data` volume untouched,
the check ran as project `-p easyquery-ops007` with a scratch `--env-file`
(random password, `DB_PORT=15432`). It was removed afterwards with `down -v`.

- `config` with the override: only `db` gains
  `127.0.0.1:15432->5432`. `config` of `compose.yaml` alone: `db` has no
  ports, and only `web` publishes `127.0.0.1:8080`.
- `up -d --wait db` on an absent volume: only `db` runs, `healthy`, on
  `127.0.0.1:15432`.
- `./gradlew run` with `EASYQUERY_DB_URL=jdbc:postgresql://127.0.0.1:15432/easyquery`
  and the user and password: `EasyQuery: database migrations applied`,
  `flyway_schema_history` holds `1 baseline` and `2 accounts`, and `/health`
  returns `{"status":"ok","database":"ready"}`. Register (201), session
  (the user), logout (204) and login (200) all work.
- BE-007 end to end: `stop db` changed `/health` to `unavailable` within the
  5 s interval, and `start db` changed it back to `ready`. Every poll
  answered 200 in about 10 ms.
- `./gradlew run` with empty database variables: `/health` returns
  `not-configured`, `POST /api/query/count` (PokemonGen1) returns 200 with
  295, and register returns 503 `Accounts are temporarily unavailable`.
