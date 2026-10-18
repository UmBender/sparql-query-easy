# SPARQL EasyQuery frontend

SvelteKit 3 (Svelte 5 runes, strict TypeScript, Vite) built as a static SPA
with adapter-static, next to the legacy `sparql/index2.html` (DEC-011). See the
root README for running both side by side.

| Command          | Purpose                                                                         |
| ---------------- | ------------------------------------------------------------------------------- |
| `npm ci`         | Install from `package-lock.json`                                                |
| `npm run dev`    | Dev server on 5173; proxies `/api`, `/health`, `/openapi.json` to Ktor on 8080  |
| `npm run build`  | Static SPA in `build/` (`index.html` fallback)                                  |
| `npm run check`  | svelte-check                                                                    |
| `npm run lint`   | Prettier check, ESLint and the raw-color check (`scripts/check-raw-colors.mjs`) |
| `npm run tokens` | Rewrite `src/lib/design/tokens.generated.css` after editing `tokens.ts`         |
| `npm test`       | Vitest (`src/**/*.spec.ts`), then Playwright (`tests/*.e2e.ts`, offline)        |

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

Editor (FE-044): `src/lib/features/editor/`. `query-editor.svelte` is the page;
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

Playwright is pinned to the root suite's version so both share the installed
browsers. npm 10 fails while resolving new dependencies (`edgesOut` error in
peer resolution); add or update packages with `npx npm@11 install ...`.
`npm ci` works with either version.
