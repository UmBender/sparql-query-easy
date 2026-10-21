# Testing Guide

Which test layer to use for a change, how to run each one from a fresh
clone, and how to add fixtures and refresh screenshots (DOC-004, T10). The
command list in [[../06 - Development/Operational Map]] stays canonical;
this guide explains when to use each command. Coverage history and RDF parity
rules are in [[Quality and Compatibility]].

## Prerequisites

| Need | For |
|---|---|
| JDK 21 | Kotlin gate, `test:stack` (builds Ktor) |
| Node 22 and `npx npm@11` | frontend (npm 10 fails on this lockfile's peer resolution) |
| Firefox for Playwright: `(cd frontend && npx playwright install firefox)` | component tests and every Playwright suite |
| Docker | Kotlin persistence tests and `test:stack` (Testcontainers `postgres:17-alpine`), `test:screens` (the pinned Playwright image), `test:compose` (Compose v2.24+) |

From a fresh clone:

```sh
(cd frontend && npx --yes npm@11 ci && npx playwright install firefox)
```

No test calls Wikidata or any other external service. The browser suites
fail on a request that leaves the app's origin (`frontend/tests/support/offline.ts`).

## Layers

| Layer | Use it for | Where | Command |
|---|---|---|---|
| Kotlin unit, HTTP, capture and OpenAPI tests | backend behaviour, routes, JSON errors, SPARQL generation, persistence | `src/test/kotlin/` | `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon` |
| Frontend domain unit (Vitest, node) | pure query-graph logic and request mapping; keeps 90% line and branch coverage of `src/lib/domain/` | `frontend/src/**/*.spec.ts` | `npm --prefix frontend run test:coverage` |
| Store tests (Vitest, node) | `QueryStore` actions, history, derived values | `src/lib/stores/*.spec.ts`, built with `createTestStore` | same as above |
| Component tests (Vitest browser mode, Firefox) | one Svelte component's rendering and interaction | `frontend/src/**/*.svelte.spec.ts`, rendered with `renderWithProviders` | `(cd frontend && npx vitest run --project client)` |
| Integration with a mocked API (MSW) | the typed client or a component against realistic responses | `mswHandlers()` (default typed routes), `fixtureHandlers(name)` (a legacy scenario's captured responses), `mockFetch(...)` in the browser project | part of the two Vitest commands |
| Contract | frontend types vs the Ktor OpenAPI document; fixtures vs the documented shapes | Kotlin `FrontendOpenApiSnapshotTest`, `src/lib/api/api-contract.spec.ts`, `src/lib/testing/fixtures.spec.ts`, live spec in `tests-stack/pokemon.e2e.ts` | Kotlin gate and `test:coverage` |
| Offline end to end (Playwright) | user flows in the browser with the typed mock API: editor, filters, funnel, exploration, auth, study pages, canvas screenshots, axe on every main route | `frontend/tests/*.e2e.ts`, page objects in `tests/support/pages/` | `npm --prefix frontend run test:e2e` (part of `npm --prefix frontend test`) |
| Screen screenshots | page layout and colours of every main route in both themes | `frontend/tests/screens.e2e.ts`, routes in `tests/support/screens.ts` | `npm --prefix frontend run test:screens` |
| Real stack (Playwright) | flows that need Ktor and PostgreSQL: accounts, study, staged queries on PokemonGen1 and uploaded Turtle | `frontend/tests-stack/` | `npm --prefix frontend run test:stack` |
| Compose smoke (Playwright) | the production images and Caddy's proxy: health, login cookie, one query, one task | `frontend/tests-compose/` | `npm --prefix frontend run test:compose` |

`npm --prefix frontend test` runs `test:coverage`, the component tests and
`test:e2e` in that order. The frontend closing gate is `check`, `lint` and
`test`; add `test:screens` when a page, component, style or token changes,
`test:stack` when API calls, accounts, saved queries or exploration change,
and `test:compose` when Compose, an image or the Caddyfile changes
(Operational Map, closing gates).

Pick the lowest layer that can fail for the defect. A browser test that
repeats a domain unit oracle adds time, not safety. Compare unordered result
rows as multisets; keep order only where the contract has ORDER BY.

## Test helpers

- `createTestStore({ document?, graph?, ...options })`
  (`src/lib/testing/store.ts`): a store with a fixed clock, so ids are
  `?node_<TEST_NOW + n>`.
- `renderWithProviders(Component, props)` (`render.ts`): the component in a
  fresh svelte-query client and the tooltip provider; returns
  `{ screen, client }`.
- `mockFetch(...handlers)` (`mock-fetch.ts`): answers `fetch` from MSW
  handlers in either Vitest project; an unhandled request rejects.
- `loadFixture(name)`, `FIXTURE_NAMES` (`fixtures.ts`) and
  `fixtureHandlers(name, base?)` (`fixture-handlers.ts`).
- Playwright: `EditorPage`, `TaskPage`, `QuestionnairePage`
  (`tests/support/pages/`); `EditorPage` finds nodes by id through the e2e
  hook (`window.__easyquery`, present in the `e2e` build only), at any zoom
  and pan. `mockApi(page)` serves the typed routes and records requests;
  `override(path, respond)` replaces one path's answer.

## Adding a fixture

- **Legacy wire fixtures** (`fixtures/legacy/`) are a frozen
  characterization corpus. The capture harness was removed with the legacy
  page (FE-049), so no new legacy scenario can be recorded. Read them with
  `loadFixture`; never edit one to make a test pass. A shape mismatch reported
  by `fixtures.spec.ts` is an API or oracle difference to investigate.
- **A saved query** for domain, component or e2e tests: add
  `frontend/src/lib/domain/fixtures/<name>.query.json` in the versioned
  format; `saved-format.spec.ts` requires that saving it again gives the same
  bytes.
- **A default mock response**: add a `route(method, path, respond)` to
  `frontend/src/lib/api/mock-routes.ts`. It is typed from `schema.d.ts`, so
  a wrong shape fails `npm run check`, and `mock-routes.spec.ts` requires the
  route to be in the OpenAPI snapshot. Per-test data goes in an
  `api.override(...)` typed with `components['schemas'][...]`, as in
  `tests/support/screens.ts`, rather than in the shared defaults.
- **A Turtle graph for the real stack**: `frontend/tests-stack/fixtures/*.ttl`,
  uploaded through `/api/local-database` in the test.
- **Study data on the real stack or Compose**: seed it through the API with
  `loginAs`, `joinStudy` and `seedStudy` (`tests-stack/support.ts`), never with
  SQL.

## Updating API types

After a route or schema change in Kotlin:

```sh
UPDATE_FRONTEND_OPENAPI=1 GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew test --tests 'com.example.sparqlqueryeasy.http.FrontendOpenApiSnapshotTest' --no-daemon
npm --prefix frontend run api:types
```

Without these steps the Kotlin snapshot test and `api-contract.spec.ts`
fail, so contract drift cannot reach `main`.

## Updating screenshots

Refresh baselines only for an intended visual change, then review every
changed PNG in the diff before committing.

- Screen screenshots (text included), rendered in
  `mcr.microsoft.com/playwright:v<@playwright/test version>-noble`, so they
  match on every machine and in CI:
  `npm --prefix frontend run test:screens -- --update-snapshots`.
  Failures leave expected, actual and diff images in
  `frontend/test-results/screens/`.
- Canvas screenshots (labels and overlays hidden, host browser):
  `(cd frontend && npx playwright test visual --update-snapshots)`.
- Vitest browser-mode failure screenshots (`__screenshots__/`) are not
  baselines; they are git-ignored.

## What CI runs

`.github/workflows/ci.yml` (DEC-016, QUAL-016, QUAL-017):

| Job | Push to another branch | Pull request, push to `main`, nightly, manual |
|---|---|---|
| `kotlin` (Kotlin gate with the OpenAPI snapshot contract) | yes | yes |
| `frontend-fast` (legacy-free check, check, lint, `test:coverage`, component tests) | yes | yes |
| `frontend-browser` (`test:e2e`, `test:screens`, `test:stack`) | no | yes |
| `compose-smoke` (`test:compose`) | no | push to `main`, nightly and manual only |

Every Playwright suite writes an HTML report under
`frontend/playwright-report/<suite>/`; CI uploads them as artifacts on every
run, and the raw `test-results/` on failure.

## Source files

`frontend/package.json`, `frontend/vite.config.ts`, `frontend/playwright*.config.ts`,
`frontend/src/lib/testing/`, `frontend/tests/support/`, `frontend/scripts/test-screens.mjs`,
`frontend/scripts/test-compose.mjs`, `.github/workflows/ci.yml`.
