---
id: BE-007
title: Report database connectivity on GET /health without failing the query API
status: DONE
priority: P2
type: backend
depends_on: [BE-005, DEC-009]
human_gate: false
created: 2026-10-18
updated: 2026-10-18
---
# Report database connectivity on GET /health without failing the query API

## Objective

T6 brief (2026-10-18): a health route that reports DB connectivity. This was
the part of T6 that BE-005 did not cover. Skill: `tcc-backend`.

Expected examples:

- No `EASYQUERY_DB_URL`: `200 {"status":"ok","database":"not-configured"}`
- Migrated and reachable: `200 {"status":"ok","database":"ready"}`
- Configured but unreachable: `200 {"status":"ok","database":"unavailable"}`

## Entry points and contracts

- `application/HealthService.kt` (`HealthResponse(status)`),
  `http/HttpModule.kt` (`get("/health")`, `documentHealth()`).
- `application/persistence/Persistence.kt` (`PersistenceStatus`:
  `NotConfigured`, `Ready`, `Unavailable`) and `DatabaseConnector`, which
  retries an unavailable database at most every 5 s.
- [[../../09 - Decisions/Current Contracts]] Health row, from DEC-009:
  `200 {"status":"ok"}`.
- Callers that must keep working: `Dockerfile` HEALTHCHECK and the compose
  `backend` healthcheck (`curl --fail /health`), the `web` service waits for
  that, and the frontend warm-up (P-01) only checks for success.

## Scope

- Add a `database` field (`ready` | `not-configured` | `unavailable`). This
  is additive: `status` and the 200 code stay as DEC-009 approved them.
- Keep 200 when the database is down. Anonymous query routes work without a
  database (Authentication Contract), and a non-2xx answer would mark the
  container unhealthy and keep `web` from starting.
- Read the status through `DatabaseConnector` so a health poll never retries
  faster than the existing 5 s limit. The response must not include
  connection details, hosts or error text.
- Update the OpenAPI doc, then refresh `frontend/src/lib/api/openapi.json`
  (`UPDATE_FRONTEND_OPENAPI=1`) and `schema.d.ts` (`npm run api:types`).
- Record the additive field in Current Contracts and in API v1.

## Out of scope

- A separate readiness route, or a non-200 code for the database state.
- Changing compose or Docker healthchecks.
- Showing the database state in the UI.

## Acceptance criteria

- [x] Route tests for the three states assert 200 and the exact body. The
      unavailable case uses an unreachable URL.
- [x] Polling `/health` while the database is down does not reconnect more
      than once every 5 s (asserted through the connector's clock or counter).
- [x] The OpenAPI validation test, `FrontendOpenApiSnapshotTest` and
      `api-contract.spec.ts` pass with the refreshed snapshot.
- [x] The existing query-route and compatibility tests are unchanged and green.

## Validation

Focused: `./gradlew test --tests '*Health*'` (proposed filter; use the
actual test class). Closing gate: Kotlin `ktlintCheck detekt test`, plus the
frontend `npm test` because the API snapshot changes (Operational Map).

## Result (2026-10-18)

- `HealthResponse` gains `database` (`DatabaseHealth` enum: `ready`,
  `not-configured`, `unavailable`). The answer stays `200` with
  `status: "ok"`, and no host, URL or error text is exposed.
- `DatabaseConnector.poll()` returns the last known status without waiting.
  A connection attempt can take the 5 s connect timeout, which equals the
  Dockerfile HEALTHCHECK `--timeout=5s`, so a blocking retry could have marked
  the container unhealthy. When the 5 s interval is due, one check runs on a
  background virtual thread: a reconnection (with migrations) while there is
  no pool, else `isValid` on a pooled connection. A database lost after
  startup therefore turns `unavailable` and later returns to `ready`. The
  next poll shows the result. `require()` and `connect()` keep their
  behavior.
- `HttpDependencies.health` defaults to `not-configured`; the production
  wiring uses `HealthService(database::poll)`.
- Tests: `HealthRoutesTest` (the three exact bodies; polling while the
  database is down retries once per interval) and `PostgresDatabaseTest`
  (a poll never waits; a dropped database turns unavailable, and recreating
  it turns ready). `OpenApiRoutesTest` asserts the enum. `ApplicationTest`
  and the `HTTP-HEALTH-001` assertion in `RetirementSuccessCompatibilityTest`
  now check `status: "ok"` and the two keys. Through `module()` the database
  value depends on the local `.env`. The C# capture is unchanged.
- Snapshot `frontend/src/lib/api/openapi.json` and `schema.d.ts` were
  refreshed, and the frontend health mocks now carry `database`.
- Docs: API v1, Current Contracts (Health row), Local JVM and Container
  Runtime.
- Validation: Kotlin `ktlintCheck detekt test` (210); frontend check, lint,
  `npm test` (162 server, 4 component, 79 Playwright); `test:stack` (8).
