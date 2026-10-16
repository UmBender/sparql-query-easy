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

## Proposed amendment from the T4 brief (2026-10-16, pending user confirmation)

The T4 brief duplicates this card (conflict rule DUPLICATE), except undo/redo
(D-T4b below). Approved scope above is unchanged; apply only after the user
confirms.

- The store exposes `$derived` validation errors (from the FE-042 validate
  operation), active filters and funnel steps (with their on/off state).
- Client covers run (`/api/query`), count, numeric-profile, entity search,
  stage and the endpoints list. The endpoints list uses a hand-written
  constant (`CampeonatoBrasileiro2023`, `PokemonGen1`, Wikidata) until BE-006
  exposes it, then switches to the generated type.
- OpenAPI: `/openapi.json` already exists (OAPI-001, DONE), so no backend
  subtask is needed for the spec; hand-written types only where a schema gap
  is recorded.
- svelte-query wrappers for count, numeric-profile and search: query keys
  derived from the request payload (cache hit on an identical request),
  `staleTime` set, and typing-driven calls (search, suggestions) debounced.
- [ ] Store tests cover each `$derived` value after the actions that change it.
- [ ] Wrapper tests (fake timers + MSW): N keystrokes within the debounce
      window send one search request; repeating an identical count/profile
      request is served from cache without a second request.
- `depends_on` adds QUAL-010 (request field documentation).

## Pending decision D-T4b: undo/redo (CONTRADICTS)

This card says "undo is out of scope"; the T4 brief puts undo/redo in the
store.

- Option A: keep undo/redo out of the migration. Affects nothing now; the
  legacy page has no undo either, so parity is unaffected.
- Option B: add undo/redo as a follow-up card (FE-052, depends on FE-043):
  history of immutable `QueryGraph` snapshots per user action (not per
  preview toggle or selection), bounded depth, cleared on load/new query;
  keyboard shortcuts land with the canvas (FE-044). FE-043 itself stays as
  approved.
- Option C: put undo/redo directly into FE-043. Same behavior as B, larger
  first store slice.
- Recommendation: **B**. Immutable domain operations make snapshots cheap,
  and a separate card keeps FE-043 small and independently testable.
