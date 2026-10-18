---
id: QUAL-011
title: Run the persistence and real-stack tests on Testcontainers PostgreSQL
status: DONE
priority: P2
type: quality
depends_on: [DEC-012, BE-005]
human_gate: false
created: 2026-10-18
updated: 2026-10-18
---
# Run the persistence and real-stack tests on Testcontainers PostgreSQL

## Objective

DEC-012 (user choice B, 2026-10-18): tests that need PostgreSQL run against
the production image `postgres:17-alpine` through Testcontainers instead of
embedded PostgreSQL. This is behavior-preserving for the product: only test
infrastructure, the build and the docs change. Skill: `tcc-test`
(`tcc-backend` for the Gradle/Kotlin side).

## Confirmed entry points

- `src/test/kotlin/.../persistence/TestPostgres.kt`: one embedded server per
  JVM, `freshDatabase()` (a new database per caller), `unreachable()`.
  Used by `PostgresDatabaseTest` and `http/AuthRoutesTest`.
- `src/test/kotlin/.../persistence/StackPostgres.kt`: a `main` for
  `test:stack`. Arguments are the port (54329) and a ready file. It runs
  until SIGTERM.
- `build.gradle.kts`: `io.zonky.test:embedded-postgres:2.2.2` and its
  binaries BOM; `writeStackPostgresClasspath` (AUTH-003).
- `frontend/playwright.stack.config.ts`: starts `StackPostgresKt` with
  `java -cp`, waits for the ready file, and passes the database on port 54329
  to Ktor.
- `.github/workflows/ci.yml`: `./gradlew ktlintCheck detekt test` and
  `npm run test:stack` on `ubuntu-24.04`.
- The Operational Map persistence row says "no Docker or network".

## Scope

- Replace the zonky dependencies with Testcontainers PostgreSQL (the current
  release, pinned). It must support Docker Engine 29, the local version
  (29.8.2); check this first, because older Testcontainers releases reject
  the newer Docker API.
- `TestPostgres`: one `postgres:17-alpine` container per test JVM. Keep the
  `freshDatabase()` and `unreachable()` API, so the callers don't change.
- `StackPostgres`: start the same image and keep the ready-file handshake
  that `playwright.stack.config.ts` waits on. Either bind the agreed port or
  write the mapped JDBC URL into the ready file and read it in the config.
  Pick one and record it. The container must be removed when the process
  stops (SIGTERM, Ctrl+C), with no container left behind after `test:stack`.
- Without Docker, the suites fail with a clear message naming Docker. They
  are not skipped silently.
- CI: confirm the runners' Docker works with Testcontainers, and pre-pull
  `postgres:17-alpine` in a separate step so a pull failure is reported
  separately from test failures.
- Docs: the Operational Map persistence and real-stack rows, the README
  requirements (Docker is needed for the Kotlin tests and `test:stack`), and
  a dated note on BE-005 and AUTH-003. Their done work stays as written.

## Out of scope

- Production or compose changes, the BE-007 health field, the OPS-007 dev
  database.
- New tables, migrations or test cases beyond what the switch needs.
- The opt-in live integration source set (`integrationTest`).

## Acceptance criteria

- [x] No `io.zonky` reference remains in the build or the sources.
- [x] `PostgresDatabaseTest` and `AuthRoutesTest` pass on Testcontainers with
      the same assertions: migrations V1 and V2 on a fresh database, the
      second start a no-op, unavailable-database behavior, accounts and
      sessions.
- [x] `npm --prefix frontend run test:stack` passes (8 tests), and
      `docker ps -a` shows no leftover test container afterwards.
- [x] With Docker stopped, `./gradlew test` fails with a message that names
      Docker.
- [x] The CI workflow change is ready. Like QUAL-007, the first GitHub run
      waits for a push you authorize.

## Validation

Focused: `./gradlew test --tests '*PostgresDatabaseTest' --tests '*AuthRoutesTest'`.
Closing gate (Operational Map): Kotlin `ktlintCheck detekt test`, plus
`npm --prefix frontend run test:stack`. The oracle is the unchanged
assertions in the existing tests.

## Result (2026-10-18)

- `org.testcontainers:testcontainers-postgresql:2.0.5` replaces the zonky
  artifacts; it works with the local Docker Engine 29.8.2.
- `TestPostgres.kt` has a shared `startPostgresContainer()`: one
  `postgres:17-alpine` per test JVM, with a fresh database per
  `freshDatabase()`. The `unreachable()` API is unchanged. The container is
  stopped by a shutdown hook and by Ryuk. It fails first with a message
  naming Docker when Docker is unreachable.
- Stack handshake decision: Docker picks the host port, and `StackPostgres`
  writes the JDBC URL into `build/stack-postgres.ready`, which
  `playwright.stack.config.ts` passes as `EASYQUERY_DB_URL`. Port 54329 is
  no longer used.
- CI: each job pulls `postgres:17-alpine` in its own step before the tests.
- Docs: Operational Map (persistence, accounts, CI and real-stack rows),
  README verification (Docker requirement), dated notes on BE-005 and AUTH-003.
- Validation: focused `PostgresDatabaseTest` (4) and `AuthRoutesTest` (13);
  Kotlin `ktlintCheck detekt test` (204, the FE-049 count); `test:stack`
  (8 passed, with no `postgres:17-alpine` container and no ready file left
  afterwards); docs check. No-Docker check: the Docker socket was hidden in a
  private mount namespace (`unshare -rm`, tmpfs over `/run`), and the two
  container-backed `PostgresDatabaseTest` cases failed with the Docker
  message. Setting `DOCKER_HOST` to a bad socket is not enough, because
  Testcontainers falls back to `/var/run/docker.sock`.
- Pending: the first GitHub run of the changed workflow waits for an
  authorized push.
