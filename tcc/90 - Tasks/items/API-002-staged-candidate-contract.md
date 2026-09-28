---
id: API-002
title: Specify additive typed and bounded staged-candidate API
status: DONE
priority: P1
type: documentation
depends_on: [DEV-001, DEC-008, INV-002]
human_gate: true
created: 2026-09-27
updated: 2026-09-28
---
# Specify additive typed and bounded staged-candidate API

## Objective

Define the request/response contract needed for one stage of ordered query
exploration before backend or frontend implementation.

## Evidence and relevant files

[[../../03 - Backend/API v1]]; `src/main/kotlin/com/example/sparqlqueryeasy/http/HttpModule.kt`;
`src/main/kotlin/com/example/sparqlqueryeasy/http/OpenApiModule.kt`;
`src/main/kotlin/com/example/sparqlqueryeasy/http/QueryHttpModels.kt`;
[[../../04 - Frontend/Two Variable Exploration Contract]].

## Exact scope

Specify an additive route or approved equivalent: graph patterns, projection,
prior typed bindings, bounded page/cursor, endpoint, typed RDF candidate,
display label, duplicate policy, response limits, validation, errors, and
local/remote behavior. Include examples for IRI, typed/language literal,
predicate, unbound, empty, and stale/invalid input. Define how a hover preview
can request the *next* variable without requesting every pair eagerly.

## Explicitly out of scope

Changing the captured `/api/query` response, implementing the route, live
Wikidata calls, authentication policy, or unbounded raw SPARQL.

## Dependencies

DEV-001, DEC-008, INV-002; this is a human contract gate before BE-001.

## Acceptance criteria

- [x] Method, path, typed schemas, limits, statuses and errors are approved.
- [x] Backward compatibility and OpenAPI 3.1 update requirements are explicit.
- [x] Deterministic local and recorded-remote test examples are documented.

## Verification commands

```sh
rg -n 'post\(|GeneralQueryHttpRequest|PropertyDtoResponse' src/main/kotlin/com/example/sparqlqueryeasy/http
git diff --check
```

## Expected documentation updates

[[../../03 - Backend/API v1]]; [[../../04 - Frontend/Request Flows]];
[[../../04 - Frontend/Two Variable Exploration Contract]].

## Risks

An untyped value or missing request bound can make previews misleading or
expensive. Approval is required for any externally observable API addition.

## Execution log

- 2026-09-27: Planned only; exact route intentionally undecided.
- 2026-09-28: Approved with DEC-008 (user selected the full typed chain).
  Specified `POST /api/query/stage` in API v1: typed IRI/literal terms,
  bindings via server-rendered VALUES, limit 1..50, offset 0..10000,
  `hasMore`, 400/404/502 envelope, filterType 4/5 rejected, OpenAPI inventory
  grows to nine operations. Fixtures are implemented in BE-001/BE-002.
