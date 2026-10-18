---
id: FE-043
title: Own the QueryGraph in one rune store and call the API through a typed client
status: BACKLOG
priority: P1
type: frontend
depends_on: [FE-042, QUAL-010]
human_gate: false
created: 2026-10-16
updated: 2026-10-16
---
# Own the QueryGraph in one rune store and call the API through a typed client

## Objective

T4, part 2. Skill: `tcc-frontend`.

## Scope

- One `.svelte.ts` store holding the `QueryGraph`, selection and endpoint;
  every change goes through domain operations. It exposes `$derived`
  validation errors (from the FE-042 validate operation), active filters and
  funnel steps with their on/off state.
- Undo/redo is not part of this card; FE-052 adds it on top (D-T4b).
- Types generated from `/openapi.json` (e.g. openapi-typescript), checked in
  or generated at build. The spec already exists (OAPI-001), so no backend
  spec subtask is needed; hand-written types only where a schema gap is
  recorded.
- A thin typed client mapping `DataResponse`/`ErrorResponse` and the
  400/404/502 contract for run (`/api/query`), relationships, stage, count,
  numeric-profile, entity search, sparql, upload and the endpoints list.
  The endpoints list is a hand-written constant (`CampeonatoBrasileiro2023`,
  `PokemonGen1`, Wikidata) until BE-006 exposes `GET /api/endpoints`.
- @tanstack/svelte-query wrappers. For count, numeric-profile and search:
  query keys derived from the request payload (cache hit on an identical
  request), `staleTime` set, and typing-driven calls (search, suggestions)
  debounced.
- Record any OpenAPI schema gap found while generating (fix in Ktor only if
  additive and documented in [[../../03 - Backend/API v1]]).

## Fixture scenarios (QUAL-009)

Field-level request shapes: [[../../04 - Frontend/Legacy Wire Format]] (QUAL-010).

Client and wrapper tests reuse captured responses (`*.response.json`) as MSW bodies. See `fixtures/legacy/README.md` and [[../../04 - Frontend/Frontend Parity Checklist]].

## Acceptance criteria

- [ ] Store tests: actions produce the expected `QueryGraph`.
- [ ] Store tests cover each `$derived` value after the actions that change it.
- [ ] Client tests with MSW: success and each error status map correctly.
- [ ] Wrapper tests (fake timers + MSW): N keystrokes within the debounce
      window send one search request; repeating an identical count/profile
      request is served from cache without a second request.
- [ ] A contract test fails when the generated types drift from `/openapi.json`.

## Execution log

- 2026-10-16: Merged the T4 amendment ($derived values, client coverage,
  cached and debounced wrappers, QUAL-010 dependency) after user
  confirmation; D-T4b = B moved undo/redo to FE-052. No code changed.
