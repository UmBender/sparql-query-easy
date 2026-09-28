# Frontend Evolution Audit

DEV-001, 2026-09-28. Analysis only: no application code, dependency or bundler
was changed. At audit time, follow-up cards remained BACKLOG.

## Incremental Option B follow-up (2026-09-28)

The user selected a bounded Option B step and deferred a full frontend port.
`sparql/query-calculations.js` now owns pure filter construction, distinct
variable discovery and parallel-predicate detection. `sparql/index2.html`
retains Cytoscape, event handling and global adapters; browser assets remain
unbundled and are served by Ktor. `tsconfig.frontend.json` checks only the new
module with TypeScript 5.9.3, JSDoc, `checkJs` and `noEmit`; no runtime TypeScript
artifact or Vite build exists. `npm run test:query` executes DOM-free tests and
`npm run check:frontend-types` runs the static check.

The checked shape distinguishes optional graph fields and a numeric or null
filter result, so an incompatible query-item field or return type is a static
error inside the module. The existing inline Cytoscape adapter, HTTP response
shapes, asynchronous preview state and menu lifecycle are still unchecked.
Extending Option B will require typed adapters/API DTOs and a deliberate
packaging decision if a bundler is introduced. Type checking is not evidence
of race safety. Browser tests now fail on unexpected external requests and
serve pinned local Materialize CSS and deterministic Intro styling fixtures;
production still references
CDN assets and remains a separate offline-packaging decision.

Source files: `sparql/query-calculations.js`, `sparql/index2.html`,
`tsconfig.frontend.json`, `package.json`, `frontend-tests/query-calculations.unit.mjs`,
`frontend-tests/index2.spec.mjs`, `build.gradle.kts`.

## Size review for agent-sized edits (FE-018, 2026-09-28)

Analysis only; no application code changed. `sparql/index2.html` grew from
1,558 lines (`beb7058`) to 3,001 lines / 144 KB (`6b5df75`), about 36k tokens
(estimate: bytes ÷ 4). Each FE card since FE-002 added 20–330 lines to this one
file, so an agent must read or search the whole page even for a menu or CSS
change. The pure modules (`query-calculations.js`, `query-stages.js`, 383
lines) are the only parts with DOM-free tests and type checks.

| Lines | Region | Coupling |
|---|---|---|
| 12–499 | Inline CSS, one comment header per UI area | None; plain `<link>` move |
| 502–807 | Markup: toolbar, canvas, panel, possible-graph window, modals | Needed by tests and Materialize init |
| 820–1284 | Config, globals, utilities, modals, API calls, graph operations | Top-level functions; tests call `runQuery`, `getQuery`, `seeSparqlQuery`, `getElementInfo`, `getRelationshipValue`, `addNewVariable` on `window` |
| 1285–1434 | Variable registry bridge, stage-order blocks, panel | Uses `window.queryStages` |
| 1435–1899 | Staged exploration and possible-graph window | Timer, `AbortController`, stage cache |
| 1900–2086 | Node factory, connection discovery, change-value modal | Top-level functions |
| 2089–2999 | `DOMContentLoaded`: Materialize, uploads, autocomplete, Cytoscape init, node menu (≈345), edge menu (≈120), Alt+drag, selection | Closure locals such as `selectedMenuNodeId`, `pendingConnection`, `predicateChoices` shared by menus |

No function is unused. `possibleGraphStyle()` repeats the main Cytoscape base
node/edge style literally. `possibleGraphState()`, `nodeActions()`,
`edgeActions()` and `nextPredicateVariableName()` are mainly data decisions
mixed with timers or DOM. 15 inline `onclick` attributes depend on globals.

**Recommendation:** continue Option A/B with files split by responsibility,
not by line count. Top-level code moves to ordered classic
`<script src>` files first, so global functions and the `window` contract used
by tests and inline handlers stay unchanged without a bridge. Every new file
must be added to the `processResources` include list in `build.gradle.kts` and
to the packaged-resource test; the Playwright server already serves any file
under `sparql/`. No bundler or framework is needed for this.

| Card | Slice | Estimated effect |
|---|---|---|
| FE-019 | Move inline CSS to `index2.css` | −488 lines, no JS change |
| FE-020 | Move top-level script (820–2086) to ordered classic files: core/API, stage order, exploration, graph nodes | Page ≈1,250 lines; largest file ≈470 |
| FE-021 | Move pure possible-graph, menu-action and naming decisions into checked modules; share one base Cytoscape style | New unit tests; less duplicated style |
| FE-022 | Move node/edge menus and connection preview out of `DOMContentLoaded` into a controller that owns its state | Page ≈330 lines (markup + includes) |

Acceptance for each slice: identical browser suite, `npm run test:query`,
`npm run check:frontend-types` where modules change, and the Gradle packaged-
resource test. Rollback is reverting that slice's commit. Expected end state:
no application file above about 500 lines, and each FE card touches one or two
responsibility files plus markup.

## Evidence and concentration

Confirmed: `sparql/index2.html` is 2,221 lines. Inline application JavaScript
starts at line 629; DOMContentLoaded initialization starts at 1337. The file
combines styles, markup, filters, API calls, result application and graph/menu
listeners. Line count describes concentration, not a performance measurement.
Globals include `cy`, `searches`, `trData` and the menu controller. Inline HTML
handlers and browser tests call functions such as `runQuery` via `window`.

Confirmed: jQuery 2.1.1 is loaded and `$.ajax` is used for query, relationship,
upload and search requests. Materialize, Intro.js and cytoscape-html-label are
external scripts; Cytoscape is local. External Materialize/Intro CSS and Google
icon fonts remain. Playwright stubs the external JavaScript but has no general
external-request failure guard. This confirms the previously noted offline
limitation by source inspection; no new browser run was made for this audit.

Confirmed: `build.gradle.kts` copies six named frontend files into classpath
`frontend`; Ktor serves that directory via `staticResources`. The test server
serves source files and synthetic API responses independently of Ktor. There
is no configured application bundler, type checker or pure-JS unit-test script.

## Four evaluation scenarios

| Scenario | Concrete change pressure |
|---|---|
| FE-009 numbered reorder menu | Stable variable identity/order should be calculated independently of drawing and event handlers |
| FE-006 hover candidate preview | Query signature, temporary binding, request cancellation and stale-response rejection need explicit state ownership |
| Fixed predicate-result bug | `getQuery` must choose edge binding, not node replacement; tests assert unchanged topology/metadata |
| Fixed parallel-predicate bug | `hasParallelPredicateVariables` must reject parallel alternatives without mistaking them for a chain; tests assert no API call |

The last two are historical fixes in current code, not newly observed failures.
Current multi-variable support remains a foundation: exactly two opens the
panel without requests; larger counts fall through legacy projection choice.
Do not convert this finding into a behavior change during extraction.

## Options (qualitative estimates, not benchmarks)

| Criterion | A: small native JS modules, existing UI | B: modules plus TypeScript/JSDoc checking and optional Vite | C: component-framework rewrite |
|---|---|---|---|
| Initial scope | Extract query calculations, bridge current globals, package new files | A plus compiler/config/types and build artifact integration if Vite chosen | Rework toolbar/menus/state/lifecycle and much browser initialization |
| Context per task | Query or menu module plus entry adapter | Similar modules with explicit type contracts | Components plus graph adapter, store and build system |
| Locality | Good if responsibilities, not arbitrary line chunks, define modules | Better checks at module boundaries | UI locality possible; graph still needs an adapter |
| Pure tests | Node can exercise detached graph-data calculations | Same, plus static checking | Domain must still be extracted separately |
| Bug prevention | Identity/state invariants tested explicitly | Can detect type mismatches; runtime races still need tests | Component lifecycle helps ownership only if used correctly; not a race guarantee |
| Cytoscape ownership | One bootstrap owns `cy`; controllers attach/detach named listeners | Same owner with typed boundary | Framework owns UI DOM; dedicated canvas adapter owns Cytoscape, not both |
| API alignment | Contract fixtures checked against DTO/route tests | Types help locally; still need DTO/OpenAPI boundary checks | Same contract work remains |
| Ktor/offline operation | Add JS resources to Gradle; keep same-origin static serving | If bundled, copy generated assets and resolve manifest; localize dependencies separately | Requires new artifact/asset integration and dependency policy |
| Thesis schedule | Lowest estimated transition cost for FE-008/009 | Useful after extraction if type errors or asset complexity justify it | Highest estimated transition cost without evidence current features need it |

Finalists are A and incremental B. Native modules require correct JS MIME
types and do not automatically export names onto `window`; retain a narrow
bridge for current handlers while extracting. See [MDN modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules).
TypeScript can check existing JavaScript with `checkJs`/JSDoc, allowing a
limited pilot without converting all files. See [TypeScript JavaScript checking](https://www.typescriptlang.org/docs/handbook/type-checking-javascript-files.html).
Vite's backend integration uses build artifacts/manifest and a distinct dev
entry; adopting it would require deliberate Gradle/Ktor packaging changes.
See [Vite backend integration](https://vite.dev/guide/backend-integration).
These docs established mechanisms, not tested compatibility with this project
at audit time; dependency selection occurred only in the follow-up above.
C is not a finalist because
the four scenarios do not demonstrate a need to replace the rendering stack.

## Recommended boundaries and first delivery

Proposed direction: A first; consider a small B type-checking pilot later.
Keep the present graph owner and UI, extract pure query/variable calculations,
then isolate the asynchronous preview controller as part of FE-006. Do not
replace jQuery merely because it implements Ajax.

```mermaid
flowchart LR
  Boot[Bootstrap and Cytoscape owner] --> Actions[Node and edge controllers]
  Actions --> Query[Pure graph to query calculations]
  Actions --> State[UI and stage state]
  State --> Transport[API client]
  Transport --> Render[Results and preview renderer]
  Render --> Actions
```

The bootstrap owns `cy` and registers/disposes controllers once. Pure query
code receives graph data, never DOM references. Controllers own menu focus
and attach/detach their named listeners. Transport accepts query signature
and cancellation; stage state rejects responses whose signature is obsolete.
The renderer displays results, while explicit actions apply accepted changes
to the graph. B would retain these boundaries with checked types. C would
replace UI ownership but still need this Cytoscape and asynchronous boundary.

First cards: QUAL-003 closes browser egress; FE-011 extracts only query data
calculations for FE-008/009; FE-012 evaluates a narrow JS type-checking pilot.
Each has an independent oracle and local commit. Acceptance for the extraction
is identical query payloads and graph behavior, pure calculation tests, browser
gate and packaged-resource smoke. Rollback is reverting the extraction commit,
retaining untouched captures and tests. No wholesale framework migration is
authorized. DEC-008 still decides staged-query product behavior.

## Source files

- `sparql/index2.html`: `buildFilters`, `extractVariableName`, `runQuery`,
  `getQuery`, `replacePredicateVariable`, `hasParallelPredicateVariables`,
  DOMContentLoaded, `predicateChoiceRequestId`, Cytoscape listeners.
- `frontend-tests/index2.spec.mjs`, `frontend-tests/cdn-stubs.mjs`,
  `frontend-tests/server.mjs`, `playwright.config.mjs`, `package.json`.
- `build.gradle.kts`; `src/main/kotlin/com/example/sparqlqueryeasy/http/HttpModule.kt`.
- `tcc/90 - Tasks/items/FE-006-second-variable-assumption-and-preview.md`;
  `tcc/90 - Tasks/items/FE-009-reorderable-query-block-menu.md`.
