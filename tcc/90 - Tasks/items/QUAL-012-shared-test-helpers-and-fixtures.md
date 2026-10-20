---
id: QUAL-012
title: Share test helpers and serve legacy fixtures by name through MSW, checked against the API types
status: DONE
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

- [x] A component test renders a component that uses svelte-query with one
  helper call and no hand-made provider.
- [x] `loadFixture('fire-speed-at-least-90')` (or any existing scenario name)
  returns typed parts; an unknown name fails with the list of names.
- [x] One integration spec drives the typed client against
  `fixtureHandlers(name)` and gets the captured response.
- [x] Changing a field type in one response fixture makes the shape check
  fail, naming the file and field (kept as a permanent test on a copy, so
  no fixture file is touched).

## Validation

Focused: `npx --prefix frontend vitest run --project server src/lib/testing`.
Closing: the new frontend gate from the Operational Map.

## Execution log

- 2026-10-20: `frontend/src/lib/testing/`: `fixtures.ts` (`loadFixture`,
  `FIXTURE_NAMES`; Vite `import.meta.glob`, so the browser project loads the
  fixtures too), `fixture-handlers.ts` (`fixtureHandlers(name, base)`: the
  captured responses per method and path in order, 500 once exhausted; named
  in the plural because it returns one handler per route), `mock-fetch.ts`
  (`mockFetch(...handlers)` through MSW `getResponse`), `openapi-shapes.ts`
  (Zod `fromJSONSchema` over the OpenAPI snapshot; union failures name the
  deepest field and enum values), `store.ts` (`createTestStore`,
  `testClock`, `TEST_NOW`), `render.ts` + `test-providers.svelte`
  (`renderWithProviders`). Specs: `fixtures.spec.ts` (every scenario's shapes,
  a changed field type, an unknown route, an enum value),
  `fixture-handlers.spec.ts`, `store.spec.ts`, `render.svelte.spec.ts`
  (`finish-study.svelte`, which calls `useQueryClient()`, invalidates its own
  client; the fixture glob works in Firefox).
- Migrated: `query-store.spec.ts`, `query-store-history.spec.ts` (fixed
  clock), `client.spec.ts`, `request-parity.spec.ts` (`loadFixture`).
- Contract finding: every request with `filterType: null` failed its schema.
  The snapshot declared `type: ["integer","null"]` with `enum: [0..6]`, and
  JSON Schema rejects a value missing from `enum`. The server accepts null
  (`Int? = null`) and the legacy page sent it, so the published document was
  wrong, not the fixtures. `QueryHttpModels.kt` now lists `"null"` in both
  `@JsonSchema.Enum`s; `OpenApiRoutesTest` expects it; snapshot and
  `schema.d.ts` regenerated (types unchanged except the hash); API v1 notes
  it. No runtime behaviour changed. After the fix all 24 scenarios match.
- Limitation: the snapshot's object schemas allow unknown properties, so an
  extra fixture field is not reported; only types, required fields and enums
  are checked.
- Validation: `npm run check`, `npm run lint` pass; `npm test`: Vitest server
  232, component 25, Playwright 84 passed, domain coverage 99.08% lines /
  91.78% branches; Kotlin `ktlintCheck detekt test` passed (287 tests);
  `npm run test:stack` 20 passed (live `/openapi.json` equals the snapshot);
  docs check.
- QUAL-007 is still REVIEW only for its first GitHub run; this card was
  executed on the user's explicit request to implement T10.
- Commit: completion commit for this task.
