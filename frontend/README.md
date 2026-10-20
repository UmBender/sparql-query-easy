# SPARQL EasyQuery frontend

SvelteKit 3 (Svelte 5 runes, strict TypeScript, Vite) built as a static SPA
with adapter-static (DEC-011), the project's only frontend since FE-049. See the
root README for running both side by side.

| Command              | Purpose                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| `npx npm@11 ci`      | Install from `package-lock.json` (npm 10 reads it as out of sync)                                     |
| `npm run dev`        | Dev server on 5173; proxies `/api`, `/health`, `/openapi.json` to Ktor on 8080                        |
| `npm run build`      | Static SPA in `build/` (`index.html` fallback)                                                        |
| `npm run check`      | svelte-check                                                                                          |
| `npm run lint`       | Prettier check, ESLint and the raw-color check (`scripts/check-raw-colors.mjs`)                       |
| `npm run tokens`     | Rewrite `src/lib/design/tokens.generated.css` after editing `tokens.ts`                               |
| `npm test`           | Vitest (`src/**/*.spec.ts`), then Playwright (`tests/*.e2e.ts`, offline)                              |
| `npm run test:stack` | Playwright `tests-stack/` against the built Ktor (PokemonGen1, uploaded Turtle, live `/openapi.json`) |

Layout: `src/lib/domain` (pure TypeScript), `src/lib/stores`, `src/lib/api`,
`src/lib/components` (`ui/` for shadcn-svelte), `src/lib/features/<feature>`,
`src/routes`. Import library code with `#lib/...` and a `.js` extension.

Design tokens (FE-041): every color, size and layer lives in
`src/lib/design/tokens.ts`. `css.ts` emits them as CSS variables
(`tokens.generated.css`, mapped to Tailwind utilities in `theme.css`, dark
palette on `.dark`), and `cytoscape.ts` builds the graph stylesheets from the
same values. Raw hex colors outside `src/lib/design/` fail `npm run lint`.

Domain (FE-042): `src/lib/domain/` is the framework-free query model. `graph.ts`
holds the typed, immutable `QueryGraph` (node kinds, typed RDF terms) and keeps
Cytoscape's element order (`order.spec.ts` compares it with headless
Cytoscape); `operations.ts` reproduces each legacy edit; `query.ts` maps the
graph to the legacy request bodies through the verbatim ports in `legacy/`;
`saved-format.ts` is the versioned file format (`formatVersion: 1`, Zod).
`request-parity.spec.ts` requires the requests to equal `fixtures/legacy/`;
`npm run test:coverage` enforces 90% line and branch coverage of the domain.

Store and API (FE-043): `src/lib/stores/query-store.svelte.ts` is the one rune
store (graph, selection, endpoint, limit, stage order, funnel preview; every
edit through a domain operation and `commit`). `src/lib/api/` holds the typed
client, the TanStack Query cache and the OpenAPI snapshot (see its README).

Editor (FE-044): `src/lib/features/editor/`. `query-editor.svelte` is the page.
FE-053: other pages reuse it with optional props: `initial` (a saved query),
`endpoint` and `lockEndpoint` (field disabled, Upload Triples hidden, the
store keeps the endpoint), `panel` and `actions` snippets, and `onready`,
which receives that editor's own `QueryStore` (read `store.document` to
submit). `/` passes none;
`graph-canvas.svelte` renders `viewElements(store.graph)` (`graph-view.ts`,
pure) into Cytoscape and turns gestures into store or controller actions;
`editor-controller.svelte.ts` holds the action lists, connections, results
table, View SPARQL and search. e2e builds (`vite build --mode e2e`) expose
`window.__easyquery` (`store`, `controller`, `view`, `viewElements`) for
the Playwright tests, like the legacy page's global `cy`.

Base components (FE-050) live in `src/lib/components/ui/`: the shadcn-svelte
primitives (button, input, select, dialog, tooltip, sonner toasts, …) plus
`icon-button`, `combobox`, `chip` (numbered stage chip), `count-badge`,
`panel`, `rating-scale` and `field`. `/styleguide` shows every token group
and component in both themes. Component tests (`*.svelte.spec.ts`) run in
Firefox through Vitest browser mode; `tests/styleguide.e2e.ts` runs axe on
`/styleguide` in both themes.

Accounts (AUTH-003): `src/lib/features/auth/` holds the session store
(`authSession`, from `GET /api/auth/session`; nothing in browser storage),
the Superforms/Zod login and registration form and the toolbar's account
control; the page is `/login`. The editor works without an account. The Vite
proxy keeps the `Host` header so Ktor's same-origin check on account routes
passes in development and `vite preview`.

Protected pages (AUTH-004): `route-guard.ts` lists them (`/study`). The root
layout hides such a page until the session is known and sends an anonymous
visitor to `/login?next=<page>`; after login, `next` is followed only when it
is a path of this app. The app has one TanStack Query cache
(`appQueryClient`, provided by the root layout); it is cleared when the
logged-in user goes away (logout, an expired session, another user logging
in). The login form's component test (`auth-form.svelte.spec.ts`) replaces
SvelteKit's `$app/*` modules and turns on Superforms' Storybook mode.

Which layer to use, fixtures and screenshot updates: the testing guide,
`tcc/08 - Quality/Testing Guide.md` (DOC-004).

Test layers (QUAL-007): `src/lib/api/mock-routes.ts` holds the API mock
responses typed from `schema.d.ts`; Vitest serves them through MSW
(`mswHandlers`), the Playwright suites through `page.route`
(`tests/support/mock-api.ts`). `tests/visual.e2e.ts` compares canvas
screenshots (labels and overlays hidden, so font rendering does not matter)
and runs axe on the editor in both themes. `tests/screens.e2e.ts` (QUAL-014) takes
full-page screenshots of every main route (`tests/support/screens.ts`) in
both themes, text included; it runs only in the pinned Playwright image
(`npm run test:screens`, Docker), where fonts render the same on every
machine, and is excluded from `npm test`. Refresh deliberately with
`npm run test:screens -- --update-snapshots`. `tests/a11y.e2e.ts` (QUAL-015)
runs axe on the same routes in both themes; any violation fails.
Both Playwright suites drive the editor, a proposed task and the
questionnaires through the page objects in `tests/support/pages/`
(QUAL-013); canvas gestures find nodes by id through the e2e hook, at any
zoom and pan. `.github/workflows/ci.yml` runs
the Kotlin gate, check, lint and Vitest on every push, and the Playwright
suites (`test:e2e`, `test:screens`, `test:stack`) on pull requests, `main`
and nightly (QUAL-016); each suite's HTML report is kept as the
`playwright-reports` artifact.

Shared test helpers (QUAL-012, `src/lib/testing/`, test-only):
`createTestStore` (a QueryStore with a fixed clock, optionally from a saved
query or a graph), `renderWithProviders` (a component inside a fresh
svelte-query client and the tooltip provider), `mockFetch` (answers `fetch`
from MSW handlers in either Vitest project), `loadFixture(name)` (a
`fixtures/legacy/` scenario's requests, responses, SPARQL and export) and
`fixtureHandlers(name)` (MSW handlers replaying its captured responses in
order). `fixtures.spec.ts` checks every fixture against the OpenAPI snapshot
with Zod schemas built from it (`openapi-shapes.ts`); a mismatch names the
file, index and field.

Playwright is pinned to the root suite's version so both share the installed
browsers. npm 10 fails while resolving new dependencies (`edgesOut` error in
peer resolution); add or update packages with `npx npm@11 install ...`.
Install with `npx npm@11 ci` too: npm 10 reports this lockfile as out of sync.
