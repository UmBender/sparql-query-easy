---
id: FE-043
title: Own the QueryGraph in one rune store and call the API through a typed client
status: BACKLOG
priority: P1
type: frontend
depends_on: [FE-042]
human_gate: false
created: 2026-10-16
updated: 2026-10-16
---
# Own the QueryGraph in one rune store and call the API through a typed client

## Objective

T4, part 2. Skill: `tcc-frontend`.

## Scope

- One `.svelte.ts` store holding the `QueryGraph`, selection and endpoint;
  every change goes through domain operations; undo is out of scope.
- Types generated from `/openapi.json` (e.g. openapi-typescript), checked in
  or generated at build; a thin typed client mapping `DataResponse`/
  `ErrorResponse` and the 400/404/502 contract.
- @tanstack/svelte-query hooks for search, relationships, query, stage,
  count, numeric-profile, sparql, upload.
- Record any OpenAPI schema gap found while generating (fix in Ktor only if
  additive and documented in [[../../03 - Backend/API v1]]).

## Acceptance criteria

- [ ] Store tests: actions produce the expected `QueryGraph`.
- [ ] Client tests with MSW: success and each error status map correctly.
- [ ] A contract test fails when the generated types drift from `/openapi.json`.
