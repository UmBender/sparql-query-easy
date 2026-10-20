---
id: QUAL-012
title: Share test helpers and serve legacy fixtures by name through MSW, checked against the API types
status: BACKLOG
priority: P1
type: quality
depends_on: [QUAL-007]
human_gate: false
created: 2026-10-20
updated: 2026-10-20
---
# Share test helpers and serve legacy fixtures by name through MSW, checked against the API types

## Objective

T10 unit, component and integration gaps. QUAL-007 built the layers; tests
still build stores, query clients and fixture paths by hand. Skill:
`tcc-test`.

## Confirmed entry points

- `frontend/vite.config.ts`: Vitest projects `server` and `client`.
- `frontend/src/lib/api/mock-routes.ts`: OpenAPI-typed mock responses,
  served by MSW (`mswHandlers`) and by `tests/support/mock-api.ts`.
- `frontend/src/lib/api/client.spec.ts:23`: loads
  `fixtures/legacy/<name>.response.json` with an inline `new URL(...)`.
- `fixtures/legacy/` (QUAL-008/009, the "T2 fixtures"): request, response
  and SPARQL per scenario; `scripts/check-legacy-fixture-fields.mjs` checks
  fields against Legacy Wire Format, not against `schema.d.ts`.
- `src/routes/+layout.svelte`, `features/editor/query-editor-harness.svelte`:
  the only `QueryClientProvider` uses.

## Scope

- `frontend/src/lib/testing/` (test-only): a store factory (fresh
  QueryGraph store, optional initial graph and endpoint), a component render
  helper that wraps a fresh svelte-query `QueryClient` (retries off), and
  `loadFixture(name)` returning the typed request/response/SPARQL of one
  `fixtures/legacy/` scenario.
- MSW handlers built from fixtures: `fixtureHandler(name)` answers the
  fixture's route with its captured response; existing `mock-routes.ts`
  defaults stay.
- A Vitest check that every `fixtures/legacy/*.response.json` and
  `*.request.json` parses with a schema derived from `schema.d.ts` for its
  route (unknown fixture route or shape mismatch fails).
- Move existing specs that hand-build these objects to the helpers where
  the change is mechanical.

## Out of scope

- New fixtures or recapture (the capture harness was removed in FE-049).
- Editing a fixture to make it pass: a mismatch is investigated as an API or
  oracle difference (AGENTS: never change goldens to silence failures).
- Playwright helpers (QUAL-013).

## Acceptance criteria

- [ ] A component test renders a component that uses svelte-query with one
  helper call and no hand-made provider.
- [ ] `loadFixture('fire-speed-at-least-90')` (or any existing scenario name)
  returns typed parts; an unknown name fails with the list of names.
- [ ] One integration spec drives the typed client against
  `fixtureHandler(name)` and gets the captured response.
- [ ] Changing a field type in one response fixture makes the shape check
  fail, naming the file and field (verified once, reverted).

## Validation

Focused: `npx --prefix frontend vitest run --project server src/lib/testing`.
Closing: the new frontend gate from the Operational Map.
