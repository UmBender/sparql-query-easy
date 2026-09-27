# OpenAPI and Swagger Contract

Status: **Approved on 2026-09-27**

## Decision

The Kotlin/Ktor application owns a code-generated **OpenAPI 3.1** contract.
Route descriptions and schemas live with the Ktor routing code so adding or
changing a route requires updating the executable contract in the same change.

- Swagger UI is served at `/swagger`.
- The JSON OpenAPI document is served at `/openapi.json`.
- Both endpoints are available in development and production.
- Both endpoints and all application routes are public until authentication is
  implemented. The document has no security scheme or security requirement in
  this phase.
- No production server URL is hard-coded before its domain is chosen. Relative
  requests therefore use the host serving the document.
- The eight application operations are documented: `/`, `/health`,
  `/api/local-database`, and the five `/api/query` operations.
- Packaged frontend assets are not modeled as individual API operations.
- Automated tests fetch and validate the generated document, assert OpenAPI
  version and public exposure, compare its operation inventory with the known
  route contract, and inspect representative request/response schemas.

## Future authentication seam

`AUTH-000` remains deferred until user testing is planned. When it is approved,
the implementation must add the chosen OpenAPI security scheme centrally and
attach requirements to the protected Ktor routes without changing unrelated
request or response schemas. Swagger UI may remain public, but whether its
"Try it out" requests authenticate is part of the future cookie/token and CSRF
decision.

## Consequences

- The generated contract reduces manual route drift, but inference alone is
  insufficient: semantic details, failures, defaults, and multipart fields
  remain explicit route metadata and are protected by tests.
- Public production documentation intentionally exposes the API shape. It does
  not grant access control and must be revisited with `AUTH-000`.
- Publishing Swagger does not require wildcard CORS because the UI and API are
  served by the same Ktor origin.

## Source files

- `build.gradle.kts`
- `src/main/kotlin/com/example/sparqlqueryeasy/http/HttpModule.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/http/QueryHttpModels.kt`
- `tcc/03 - Backend/API v1.md`
- `tcc/90 - Tasks/items/OAPI-000-swagger-contract-decision.md`
- `tcc/90 - Tasks/items/OAPI-001-ktor-swagger-openapi.md`
