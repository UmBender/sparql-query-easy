---
id: BE-005
title: Add PostgreSQL persistence with Exposed, HikariCP and Flyway migrations at startup
status: BACKLOG
priority: P1
type: backend
depends_on: [DEC-003]
human_gate: false
created: 2026-10-16
updated: 2026-10-16
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

- [ ] Fresh database: migrations apply at startup; a second start is a no-op.
- [ ] Missing/invalid database configuration fails with a clear message.
- [ ] Existing Kotlin gate stays green; query routes unchanged.
