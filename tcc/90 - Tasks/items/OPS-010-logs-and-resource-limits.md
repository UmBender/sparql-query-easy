---
id: OPS-010
title: Write readable backend logs, rotate container logs and cap service resources
status: DONE
priority: P2
type: operations
depends_on: [DEC-017, OPS-006, QUAL-017]
human_gate: false
created: 2026-10-20
updated: 2026-10-20
---
# Write readable backend logs, rotate container logs and cap service resources

## Objective

T11 logs and limits, as a follow-up to OPS-006 (EXTENDS). Restart policies
exist (`unless-stopped`). The backend has no SLF4J provider, so Ktor and the
app log nothing (OPS-004 finding, 2026-10-07); Docker's default `json-file`
log grows without limit; no service has a memory or CPU cap. Limits follow
DEC-017 Q6. Alerting stays OPS-004. Skill: `tcc-backend`.

## Confirmed entry points

`build.gradle.kts` (no logging backend), `src/main/resources/`,
`PostgresDatabase.kt` (`System.err.println` startup lines), `compose.yaml`,
`Dockerfile` (JVM options), `.env.example`.

## Scope

- A logging backend (proposed Logback) writing one line per event to stdout:
  startup, migrations, request method/path/status/duration, upstream errors.
  Never log passwords, session ids, cookies or questionnaire answers; level
  from `.env`.
- Compose `logging` options for every service (proposed `json-file`,
  `max-size` 10m, `max-file` 3).
- Per-service memory/CPU limits from `.env` with defaults (DEC-017 Q6); the
  JVM sizes its heap from the container limit.
- Runbook: where logs are, how to follow one service, how to read a failure.

## Out of scope

- Metrics, alerting, log shipping, uptime checks (OPS-004).
- Changing any HTTP response or JSON contract.

## Acceptance criteria

- [x] `docker compose logs backend` shows startup, migrations and one line
  per request; a failed login and a `502` from an upstream are visible
  without secrets.
- [x] `docker inspect` shows the log rotation and limits on every service;
  the stack starts and `test:compose` passes within the default limits.
- [x] Kotlin gate stays green; no golden or contract change.

## Validation

Focused: a Kotlin test that the request log line omits cookies and
passwords (proposed); `docker inspect` of the running stack. Closing: Kotlin
gate (`./gradlew ktlintCheck detekt test`), Compose row and
`npm --prefix frontend run test:compose`.

## Execution log

- 2026-10-20: DEC-017 Q6 A. `logback-classic` 1.5.18 and
  `ktor-server-call-logging` 3.5.1; `src/main/resources/logback.xml` (stdout,
  UTC, app level `EASYQUERY_LOG_LEVEL`, libraries WARN except Flyway's
  command INFO); `http/RequestLogging.kt` installed first in
  `Application.module`: `<status> <method> <path> <ms> ms`, path only,
  `/health` skipped; `reportDatabaseStartup` uses the logger with the same
  text; `src/test/resources/logback-test.xml` keeps tests at WARN.
  `compose.yaml`: `x-logging` (json-file 10m × 3, from `.env`) and memory/CPU
  limits on all four services (db/backend 1 GiB, web/backup 256 MiB, CPU 0 =
  none), backend `EASYQUERY_LOG_LEVEL` and
  `JAVA_OPTS=-XX:MaxRAMPercentage=75`. `.env.example`, runbook section,
  Operational Map. No HTTP response or contract changed.
- Checks: `RequestLoggingTest` (2: the 401 and 502 lines match
  `<status> <method> <path> <n> ms` and contain no password, cookie,
  authorization or query string; `/health` not logged). Running stack
  (`easyquery-ops010`, removed): Flyway lines, `EasyQuery: database
  migrations applied`, `401 POST /api/auth/login 496 ms`, `502 POST
  /api/query/count 204 ms` (unreachable endpoint); no `password`, `secret`
  or session cookie in the backend log; `docker inspect` shows the memory
  caps and `max-size:10m max-file:3` on every service; `docker stats`
  backend 252 MiB, db 93 MiB, web 57 MiB, backup < 1 MiB.
- Gates: `./gradlew ktlintCheck detekt test` passed (289 tests);
  `test:stack` 20 passed; `test:compose` 4 passed.
- Commit: completion commit for this task.
