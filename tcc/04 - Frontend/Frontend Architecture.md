# Frontend Architecture

The SvelteKit app in `frontend/` (DEC-011) is the only frontend since FE-049.
It is a static SPA (adapter-static, `index.html` fallback) served on the API's
origin: by Caddy in the Compose stack (OPS-006) or by Vite in development,
both proxying `/api`, `/health`, `/openapi.json` (and `/swagger` in Compose)
to Ktor. Ktor serves no page. Commands and layout details: `frontend/README.md`.
The retired page is described in [[Legacy Page Architecture (retired)]].

## Layers

| Layer | Path | Responsibility |
|---|---|---|
| Design tokens | `src/lib/design/` | Every color, size and layer (`tokens.ts` → CSS variables, Tailwind theme, Cytoscape stylesheets); raw colors elsewhere fail lint (FE-041) |
| Domain | `src/lib/domain/` | Framework-free `QueryGraph` with Cytoscape's element order, the legacy edit operations, request mapping (checked against `fixtures/legacy/`), validation, endpoints, the versioned saved format; `legacy/` holds verbatim ports of the retired page's pure modules with their oracle suites and the vendored Cytoscape build used by `order.spec.ts` (FE-042) |
| Store | `src/lib/stores/query-store.svelte.ts` | The one rune store: graph, selection, endpoint, limit, stage order, funnel preview, undo/redo; every edit goes through a domain operation and `commit` (FE-043, FE-052) |
| API | `src/lib/api/` | Typed client from the OpenAPI snapshot (`schema.d.ts`), TanStack Query cache, typed mock routes for tests (FE-043, QUAL-007) |
| Components | `src/lib/components/ui/` | shadcn-svelte primitives and project components; `/styleguide` (FE-050) |
| Features | `src/lib/features/` | `editor` (page shell, Cytoscape canvas as a pure view, action menus, results, View SPARQL), `filters`, `exploration` (staged Run Query, possible graph), `funnel` (funnel panel, badges), `utilities` (upload, load/export, tour), `auth` (session store, login form, account control) |
| Routes | `src/routes/` | `/` (query editor), `/login` (AUTH-003), `/styleguide` |

## State and interaction

Cytoscape renders `viewElements(store.graph)` and turns gestures into store or
controller actions; it never owns query state. Query behavior (node kinds and
their actions, connections, filters, staged exploration, funnel and badges)
follows the retired page row by row, see [[Frontend Parity Checklist]] and
[[Two Variable Exploration Contract]]. Intended differences are recorded on
the FE-049 card.

## API integration

The client calls the routes of [[../03 - Backend/API v1]] with relative URLs.
Request bodies come from the domain's mapping, which equals the captured
legacy requests (`request-parity.spec.ts`). Accounts use the HttpOnly session
cookie; the page only learns the user from `GET /api/auth/session`
([[../09 - Decisions/Authentication Contract]]).

## Tests

Vitest (domain, store, client with MSW, session store), Vitest browser mode
(components), offline Playwright with the typed mocks (behavior, screenshots,
axe), and `test:stack` against the built Ktor with embedded PostgreSQL. See
[[../08 - Quality/Quality and Compatibility]].

## Source files

- `frontend/README.md`
- `frontend/src/lib/`
- `frontend/src/routes/`
- `deploy/Caddyfile`
