---
id: OAPI-000
title: Decide the Swagger and OpenAPI publication contract
status: BLOCKED
priority: P0
type: decision
depends_on: [DEC-001]
human_gate: true
created: 2026-09-21
updated: 2026-09-21
---
# Decide the Swagger and OpenAPI publication contract

## Objective

Define how Kotlin will own and expose its approved Swagger/OpenAPI
documentation before adding dependencies or public routes.

## Evidence and relevant files

- C# registers Swashbuckle and exposes its default Swagger UI/spec routes.
- Kotlin 3.5.1 has no Swagger/OpenAPI dependency or route.
- `tcc/03 - Backend/API v1.md` already documents eight application routes and
  their payload/error contracts.
- Official Ktor support can serve a checked-in OpenAPI document through
  `ktor-server-swagger`, or generate metadata from routes through newer
  compiler/runtime APIs. Generation adds experimental/compiler coupling and
  must not be assumed silently.

## Exact scope

Decide and record:

1. recommended source of truth: reviewed static OpenAPI 3.1 document, or
   generated routing metadata;
2. canonical paths for Swagger UI and raw JSON/YAML specification;
3. local-only versus production exposure and the authentication requirement;
4. documented server URLs without hard-coding an undecided production domain;
5. auth security scheme representation coordinated with `AUTH-000`;
6. whether `/health`, static assets, and internal diagnostics appear;
7. how CI detects drift between routes, serialized DTOs, and the specification.

## Explicitly out of scope

- Adding plugins, specifications, or routes.
- Changing application route behavior to fit documentation.
- Choosing a production domain.

## Dependencies

- `DEC-001` approves adding Swagger/OpenAPI.
- Coordinate security-scheme and public/private exposure decisions with
  `AUTH-000`; neither decision task depends on the other so they can be
  reviewed together.

## Acceptance criteria

- [ ] All seven numbered choices are approved and recorded.
- [ ] The decision names the authoritative specification source and version.
- [ ] Swagger/spec exposure and authentication policy are explicit for local
      development and production.
- [ ] `OAPI-001` is updated to match the approved decision.

## Verification commands

```sh
rg -n 'get\(|post\(|route\(' src/main/kotlin/com/example/sparqlqueryeasy/http
rg -n -i 'swagger|openapi' build.gradle.kts src tcc MIGRATION.md
git diff --check
```

## Expected documentation updates

- `tcc/09 - Decisions/OpenAPI and Swagger Contract.md`
- `tcc/09 - Decisions/Open Decisions.md`
- `tcc/03 - Backend/API v1.md`
- `tcc/90 - Tasks/TASKS.md`

## Risks

Generated inference may omit semantic validation, defaults, multipart details,
or exact error variants. A public interactive UI can expose protected schemas
or send authenticated requests if its security policy is not deliberate.

## Execution log

- 2026-09-21: Created after comparing C# Swashbuckle, current Kotlin routes,
  the hand-reviewed API contract, and official Ktor Swagger/OpenAPI options.
  Recommended direction is a reviewed static OpenAPI 3.1 specification served
  by Swagger UI, subject to human approval.

## Source files

- `Sparql.QueryEasy/Program.cs`
- `Sparql.QueryEasy/Properties/launchSettings.json`
- `build.gradle.kts`
- `src/main/kotlin/com/example/sparqlqueryeasy/http/HttpModule.kt`
- `tcc/03 - Backend/API v1.md`
- [Ktor Swagger UI](https://ktor.io/docs/server-swagger-ui.html)
- [Ktor OpenAPI](https://ktor.io/docs/server-openapi.html)
