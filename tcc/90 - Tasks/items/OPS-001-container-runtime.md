---
id: OPS-001
title: Define container and JVM runtime packaging
status: DONE
priority: P2
type: operations
depends_on: [API-001, DATA-001]
human_gate: false
created: 2026-09-16
updated: 2026-09-27
---
# Define container and JVM runtime packaging

## Objective
Provide a repeatable local JVM/container package for Kotlin/Ktor, independent
of the C# project, without making production deployment decisions.

## Evidence and relevant files
`build.gradle.kts`; `src/main/resources/application.conf`;
`Sparql.QueryEasy/futebol_completo.ttl` (historical source, Git commit `0f20091`);
`.github/archived-workflows/master_sparql-query-easy.yml` (the original .NET
workflow was active during OPS-001 and archived afterward).

## Scope
Container design, non-secret runtime configuration, health check, resource asset packaging, and local verification.

## Out of scope
Deployment to any environment, production domain/TLS/CORS, security policy,
image publication, AWS resources, monitoring or backup.

## Dependencies
`API-001` documents the current HTTP contract. `DATA-001` approves the exact
built-in dataset bytes. `SEC-001` remains a gate for **production use**, not
for a loopback-only package; the user's 2026-09-27 request explicitly defers
deployment. OPS-002 through OPS-004 retain their future operational gates.

## Acceptance criteria
- [x] Kotlin distribution and Docker build inputs contain the approved Turtle
  bytes and static frontend without reading the C# project.
- [x] The local Gradle quality gate and distribution build pass.
- [x] The distribution answers `/health` and serves the frontend locally.
- [x] Runtime design, commands, limits, and future OPS decisions are documented.
- [x] Container build/health is verified with the local Docker daemon.

## Verification commands
`GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat ktlintCheck detekt test installDist --no-daemon`;
`sha256sum src/main/resources/futebol_completo.ttl build/resources/main/futebol_completo.ttl`;
local distribution `/health` smoke; optional `docker build` and health check.

## Expected documentation updates
[[../../07 - Operations/Local JVM and Container Runtime]],
[[../../06 - Development/Development Environment]], `README.md`,
`MIGRATION.md`, and [[../../05 - Migration/CSharp Retirement Readiness]].

## Risks
Bundled Turtle asset and JVM version compatibility.

## Execution log
- 2026-09-16: Backlog; no container artifact exists.
- 2026-09-27: User approved local packaging without deployment. Split local
  build from production security policy; the latter remains under `SEC-001`.
  Copied the approved C# Turtle bytes to a Kotlin-owned resource, removed the
  Gradle dependency on the C# tree, added a hash regression, and added local
  container design and runtime documentation.
- 2026-09-27: `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew
  ktlintFormat ktlintCheck detekt test installDist --no-daemon` passed. The
  sandbox initially blocked Gradle's lock-service socket; the approved
  outside-sandbox retry passed. `sha256sum` matched the C# source, Kotlin
  source, and Gradle resource; extracting the distribution JAR resource gave
  the same SHA-256. The distribution's `/health`, `/index2.html`,
  `/openapi.json`, and `/swagger` returned HTTP 200 locally.
- 2026-09-27: `docker build -t sparql-query-easy:local .` passed. A temporary
  loopback-only container returned `200` for health, frontend, and OpenAPI;
  Docker reported `healthy` and UID/GID `10001:10001`. The test container was
  stopped and removed. No image was pushed or deployed.
- 2026-09-27: Changed `Dockerfile`, `.dockerignore`, `build.gradle.kts`,
  `src/main/resources/futebol_completo.ttl`, the classpath-source comment and
  hash regression test, `README.md`, `MIGRATION.md`, `MIGRATION_REPORT.md`,
  `remaining.md`, project/backend/migration/development/operations/decision
  vault notes, OPS-001/MIG-002 cards, task index, blockers, and run log.
  `git diff --check` passed. Existing QUAL-001 and unrelated work was preserved.
