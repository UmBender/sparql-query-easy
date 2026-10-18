---
id: DEC-012
title: Decide whether persistence tests keep embedded PostgreSQL or move to Testcontainers
status: BLOCKED
priority: P2
type: decision
depends_on: [BE-005]
human_gate: true
created: 2026-10-18
updated: 2026-10-18
---
# Decide whether persistence tests keep embedded PostgreSQL or move to Testcontainers

## Objective

The T6 brief (2026-10-18) asks that integration tests run against
Testcontainers PostgreSQL. BE-005 (DONE) chose embedded PostgreSQL 17
(`io.zonky.test:embedded-postgres`) and recorded it in the Operational Map.
The two contradict, so the user chooses one. Nothing changes until then.

## Evidence

- `build.gradle.kts`: `io.zonky.test:embedded-postgres:2.2.2` with the
  `embedded-postgres-binaries-bom:17.10.0` binaries (a Maven artifact).
- `src/test/kotlin/.../persistence/TestPostgres.kt`: used by
  `PostgresDatabaseTest` and `AuthRoutesTest`.
- `src/test/kotlin/.../persistence/StackPostgres.kt`: the empty database for
  `npm --prefix frontend run test:stack` (FE-046), started from the test
  classpath through `writeStackPostgresClasspath`.
- AGENTS.md: ordinary tests must not call external services. The Operational
  Map says the embedded binaries need no Docker or network.
- Production runs `postgres:17-alpine` (compose.yaml, OPS-006).

## Options

| | A. Keep embedded PostgreSQL (current) | B. Switch to Testcontainers |
|---|---|---|
| Needs to run tests | JDK only | A running Docker daemon in dev and CI |
| Network | None after Gradle resolves the artifact | Pulls `postgres:17-alpine` the first time (cache it or pre-pull it in CI) |
| Matches production | Same major version (17), different build | The exact production image |
| Work | None | Replace `TestPostgres`, rework `StackPostgres` and `writeStackPostgresClasspath` for `test:stack`, add Docker to the CI jobs, update the Operational Map and the BE-005/AUTH-001 notes |
| Affects | — | `./gradlew test`, `test:stack`, `.github/workflows` (QUAL-007), every later persistence task (AUTH, STUDY-001/002) |

## Recommendation

A, keep embedded PostgreSQL. It already covers migrations, accounts and the
real-stack suite with zero failures, needs no Docker, and keeps normal gates
offline. Testcontainers would only add the exact production image. If that
matters later (for example a PostgreSQL extension the embedded build lacks),
add one opt-in Testcontainers smoke outside the normal gate rather than
moving every test.

## Acceptance criteria

- [ ] The user picks A or B (or the opt-in variant). Record the choice in
      Open Decisions and the Operational Map.
- [ ] On B: create one implementation card that depends on this one.
