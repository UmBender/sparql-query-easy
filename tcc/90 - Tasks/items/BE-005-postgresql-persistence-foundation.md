---
id: BE-005
title: Add PostgreSQL persistence with Exposed, HikariCP and Flyway migrations at startup
status: DONE
priority: P1
type: backend
depends_on: [DEC-003]
human_gate: false
created: 2026-10-16
updated: 2026-10-18
---
# Add PostgreSQL persistence with Exposed, HikariCP and Flyway migrations at startup

## Objective

T6. Foundation for users, sessions, submissions and questionnaires. Skill:
`tcc-backend`.

## Scope

- Dependencies: PostgreSQL JDBC, HikariCP, Exposed, Flyway.
- Settings from env/`.env` (`AppSettings.kt`, `.env.example`): URL, user,
  password, pool size; no secret committed.
- Flyway runs at startup before routes serve; a first empty-schema migration.
- A repository boundary owned by the application layer; Exposed stays in an
  infrastructure package.
- Anonymous query use is public (Authentication Contract), so the query
  routes keep working when the database is unavailable; only auth and study
  routes report the failure.
- Tests against a local PostgreSQL without network access (e.g.
  Testcontainers with a local Docker image, or embedded PostgreSQL); choose
  one and record it in the Operational Map.

## Acceptance criteria

- [x] Fresh database: migrations apply at startup; a second start is a no-op.
- [x] Missing/invalid database configuration fails with a clear message.
- [x] Existing Kotlin gate stays green; query routes unchanged.

## Result

- `persistence/PostgresDatabase.kt`: Hikari pool, Flyway `db/migration`
  (`V1__baseline.sql`, empty) at startup, Exposed transactions on the IO
  dispatcher. `DatabaseConnector` owns it as an HTTP-owned resource and
  retries an unavailable database at most every 5 s on use.
- `application/persistence/`: `PersistenceStatus` and
  `PersistenceUnavailableException` for AUTH-001 and study features.
- `AppSettings`: `EASYQUERY_ENVIRONMENT`, `EASYQUERY_DB_URL/USER/PASSWORD/
  POOL_SIZE`; production requires a URL; the password is not in `toString`.
- Tests: embedded PostgreSQL 17 (`io.zonky.test`), recorded in the
  Operational Map. Gate: ktlintCheck, detekt, test (180, 0 failures),
  installDist and a smoke with an unreachable database and with production
  missing its URL.

## Proposed follow-ups (2026-10-18)

The T6 brief was compared with this card, and its done work is unchanged.
These are T6 criteria the card did not cover, proposed as follow-up cards
rather than reopening it:

- Health route reports DB connectivity: BE-007 (done 2026-10-18).
- Local dev PostgreSQL-only setup reachable from `./gradlew run`: OPS-007 (done 2026-10-18).
- Integration tests against Testcontainers contradict the embedded choice
  above: DEC-012 chose Testcontainers (2026-10-18); QUAL-011 implements it.
- The repository pattern with an example table and tests already exists as
  `V2__accounts.sql`, `PostgresAccountStore` and `AuthRoutesTest` (AUTH-001).

## Note (2026-10-18, QUAL-011)

Per DEC-012, the test database moved from embedded PostgreSQL to
`postgres:17-alpine` through Testcontainers (QUAL-011). The work above stays
as written; the current test setup is in the Operational Map.
