---
id: BE-006
title: List the selectable endpoints over GET /api/endpoints
status: DONE
priority: P2
type: backend
depends_on: []
human_gate: false
created: 2026-10-16
updated: 2026-10-17
---
# List the selectable endpoints over GET /api/endpoints

## Objective

T4 backend gap. The T4 brief asks the typed client for an "endpoints list";
no route returns one today. The legacy page uses a free-text field
(`#input-endpoint-sparql`, default `CampeonatoBrasileiro2023`) and the ids
live as constants in
`application/endpoints/EndpointContextResolver.kt` (`BRASILEIRAO_ENDPOINT_ID`,
`POKEMON_ENDPOINT_ID`, Wikidata marker). Skill: `tcc-backend`.

## Scope

- Additive `GET /api/endpoints` returning `DataResponse` with
  `[{ id, label, kind: "local" | "remote" }]` built from the same constants
  the resolver uses (one source, no duplicated literals).
- OpenAPI `describe` metadata; `OpenApiRoutesTest` operation inventory grows
  from eight to nine.
- Document in [[../../03 - Backend/API v1]].

## Out of scope

Changing how existing routes resolve endpoints; uploaded-graph ids (in-memory,
DEC-005); a remote endpoint allow-list (DEC-004/SEC-001); any legacy page
change.

## Dependencies

None. FE-043 does not wait for it: it uses a hand-written constant list until
this lands.

## Acceptance criteria

- [x] `GET /api/endpoints` lists `CampeonatoBrasileiro2023`, `PokemonGen1`
      and Wikidata; every listed local id is accepted by the existing query
      routes (route test).
- [x] `/openapi.json` documents the route; the drift test passes.
- [x] Existing routes and the legacy browser suite are unchanged.

## Validation

Focused: the new route test and `OpenApiRoutesTest`. Closing gate:
`./gradlew ktlintCheck detekt test` (Operational Map, Kotlin).

## Execution log

- 2026-10-16: Planned from the T4 brief; no code changed.
- 2026-10-17: Added `SELECTABLE_ENDPOINTS` (with `WIKIDATA_ENDPOINT_URL`, now
  also the source of `DEFAULT_ENDPOINT_URL`) beside the resolver constants,
  `GET /api/endpoints` returning `DataResponse<List<EndpointHttpItem>>`
  with `kind` `local`/`remote`, its OpenAPI `describe`, and
  `EndpointsRoutesTest` (exact body; every local id runs
  `POST /api/query/count`). `OpenApiRoutesTest` inventory now has the
  route. Documented in [[../../03 - Backend/API v1]]. Validation:
  `./gradlew ktlintFormat`, then `ktlintCheck detekt test` (35 test
  classes, no failures). Legacy page unchanged. Completion commit for this
  task.
