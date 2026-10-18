# Frontend Parity Checklist

QUAL-006. Every behavior of the legacy page `index2.html` (retired in FE-049
on 2026-10-18, when every row below was `new`) that the
SvelteKit app (`frontend/`, [[../90 - Tasks/items/DEC-011-frontend-stack-decision]])
must reproduce before cutover (FE-049). Each row names the legacy tests that
pin the behavior (titles in `frontend-tests/index2.spec.mjs` unless another
file is named), the target card, and the new-app check that proves parity.
Behavior parity lives here; request parity is the `fixtures/legacy/` corpus
(QUAL-008–QUAL-010), named in the Scenario column where a row sends requests.

Status: `legacy` = pinned only in the legacy suite; `new: …` = the new-app
check that passes (Playwright files in `frontend/tests/`, Vitest specs in
`frontend/src/`). The legacy test titles name the retired suite
(`frontend-tests/`, in git history before the FE-049 commit).

## Toolbar, page and utilities

| ID | Behavior | Legacy tests | Target | Scenario | Status |
|---|---|---|---|---|---|
| P-01 | API warm-up `GET /health` on load | `SPARQL preview and query execution use …` (server log); FE-040 smoke | FE-044 | — | new: `editor.e2e.ts` P-01, `smoke.e2e.ts` |
| P-02 | Search nodes: 400 ms debounce, `POST /api/query/search`, choosing a result adds an IRI node | `autocomplete callback adds the selected search result …` | FE-044 | — (search is outside the corpus) | new: `editor.e2e.ts` P-02 |
| P-03 | A chosen search result already related to graph nodes is added with the discovered relation (probe `POST /api/query`, `?predicate`, limit 1, both directions; the legacy page also probed edge ids, the new app probes nodes only) | `QUAL-006 a search result already related to a node is added …` | FE-044 | — | new: `editor.e2e.ts` P-03 |
| P-04 | Limit field (default 150) feeds every request `limit` | `the first stage requests typed candidates …`, `QUAL-005 the node-kind graph sends one filter per relation` | FE-043/FE-044 | all | new: `editor.e2e.ts` P-04 P-05 |
| P-05 | Endpoint field (default `CampeonatoBrasileiro2023`); an edit closes exploration and refreshes funnel/badges | `an endpoint change during exploration closes the panel …`, `the badge ignores a stale count after an endpoint edit` | FE-044 | — | new: `editor.e2e.ts` P-04 P-05 ; `exploration.e2e.ts` E-04 (endpoint closes exploration) |
| P-06 | New Query clears the canvas | `QUAL-006 New Query clears every node and relation` | FE-044 | — | new: `editor.e2e.ts` P-06 P-07 P-14 |
| P-07 | Add Variable / Add Value Variable | `SPARQL preview and query execution …`, `FE-037 Add Value Variable adds a value variable …` | FE-044 | — | new: `editor.e2e.ts` P-06 P-07 P-14 |
| P-08 | Auto Layout: when on, adding nodes runs the cose layout | `QUAL-006 Auto Layout decides whether adding a node runs the cose layout` | FE-048 | — | new: `utilities.e2e.ts` P-08 (layout runs on add, not on toggle) |
| P-09 | Upload Triples: `POST /api/local-database` multipart `ttlFile`, endpoint field takes the returned id | `Turtle upload replaces the endpoint …`; e2e `ordered-exploration.spec.mjs` | FE-048 | `upload-local-graph` | new: `utilities.e2e.ts` P-09 |
| P-10 | Export Query / Upload Query (legacy: `cy.json()`; new app: versioned format only, D6b) | `QUAL-006 Export Query downloads the graph and Upload Query restores it` | FE-048 | — | new: `utilities.e2e.ts` P-10 (file `easyquery-query.json`, `formatVersion` 1; old `query_exported.json` refused with an explanation, D6b) |
| P-11 | View SPARQL: `POST /api/query/sparql`, modal with Copy | `SPARQL preview and query execution …`, `FE-034 View SPARQL, legacy Run query and the badge use the value variable filter` | FE-046 | `view-sparql-only` | new: `editor.e2e.ts` View SPARQL |
| P-12 | Guided tour on load; one-time hint after the first node | `QUAL-006 the guided tour starts once on page load` | FE-048 | — | new: `utilities.e2e.ts` P-12 (tour on the first visit only, not on every load; hint stored under `newNode`) |
| P-13 | Zoom buttons (×1.25, ×0.8, fit); gentle wheel zoom | `QUAL-006 zoom buttons zoom in by 1.25 …`, `one mouse-wheel notch zooms gently …` | FE-044 | — | new: `editor.e2e.ts` P-13 |
| P-14 | Status bar node/edge counts | asserted in many tests (`#status-nodes`) | FE-044 | — | new: `editor.e2e.ts` P-06 P-07 P-14 |
| P-15 | Enter runs the query (toolbar inputs and page; not buttons or panels) | `QUAL-006 Enter runs the query from the toolbar inputs and the page, not from buttons` | FE-046 | — | new: `exploration.e2e.ts` P-15 |
| P-16 | Results table filter box | `QUAL-006 the results table filter hides rows that do not contain the text` | FE-044 | — | new: `editor.e2e.ts` P-16 |
| P-17 | Unexpected external traffic is rejected (QUAL-003) | `unexpected external browser traffic is rejected` | QUAL-007 | — | new: `smoke.e2e.ts` P-17 (every new-app e2e also asserts no external request) |

## Graph editing

| ID | Behavior | Legacy tests | Target | Scenario | Status |
|---|---|---|---|---|---|
| G-01 | Node kinds and their look (entity, variable, value, value variable, class, N results) | `FE-034 a value variable looks like a value …`; `graph-model.unit.mjs` | FE-041/FE-042/FE-044 | — | new: `editor.e2e.ts` G-01 G-12; `tokens.spec.ts` |
| G-02 | Left click opens a persistent node action list; only the background dismisses it | `left click opens a persistent node action list …`, `the node action list remains inside the graph viewport …` | FE-044 | — | new: `editor.e2e.ts` G-02 |
| G-03 | Each node kind offers exactly its actions | `QUAL-005 each node kind offers exactly its actions …`, `the list exposes existing node-type actions …`; `graph-actions.unit.mjs` | FE-042/FE-044 | — | new: `editor.e2e.ts` G-03; `operations.spec.ts` |
| G-04 | Explore relationships → results table → relationship value node (one value, or N results) | `Turtle upload replaces the endpoint and relationship expansion …`, `a relationship value already in the graph reuses its node …` | FE-044 | `explore-relationship-value` | new: `editor.e2e.ts` G-04 |
| G-05 | Explore values of a class (legacy defect: the prefixed `rdfs:domain` predicate gets 400 from Ktor; the new app sends the full IRI and lists the properties whose domain is the class) | `the list exposes existing node-type actions …` | FE-044 | `class-explore-values` | new: `editor.e2e.ts` G-05 |
| G-06 | Run query from a variable node (results table) and choosing a row binds it (refetching relations) | `selecting a node-variable result still replaces the variable node`, `QUAL-005 a results-table choice …` (both), `choosing a result re-adds a fixed IRI neighbour …`, `a self-loop on the variable survives …`, `choosing a result already in a cyclic graph …` | FE-044 | `node-run-query-table` | new: `editor.e2e.ts` G-06; `operations.spec.ts` binding cases |
| G-07 | Connect with variable predicate / defined predicate; preview cancels on Escape and background | `node action connects … with a variable predicate`, `node action loads defined predicates …`, `connection preview cancels …`, `QUAL-005 every node kind connects …`, `a stale predicate result does not recreate …` | FE-044 | — | new: `editor.e2e.ts` G-07 |
| G-08 | Alt+drag creates a variable edge or a new variable node | `QUAL-006 Alt+drag from a node to empty space adds a variable node …` | FE-044 | — | new: `editor.e2e.ts` G-08 |
| G-09 | Convert to variable (literal → value variable, others → variable) keeps relations | `convert retargets the menu and rewires edges …`, `QUAL-005 Convert to variable turns a … node into …`, `FE-034 Convert to variable on a value …` | FE-042/FE-044 | — | new: `editor.e2e.ts` G-09 G-10 G-11; `operations.spec.ts` |
| G-10 | Remove node (with its relations) / Remove relation (only that edge, red) | `QUAL-005 Remove deletes only the chosen node …`, `Remove relation deletes only the chosen edge`, `QUAL-005 Remove relation deletes only …` | FE-044 | — | new: `editor.e2e.ts` G-09 G-10 G-11; `operations.spec.ts` |
| G-11 | Edge action: Convert relation to variable (predicate variable, FE-003) | `edge action menu converts only a relation predicate …` | FE-044 | `predicate-variable-edge` | new: `editor.e2e.ts` G-09 G-10 G-11 |
| G-12 | Variable relations render green however created | `variable relations render the green label however they were created` | FE-041/FE-044 | — | new: `editor.e2e.ts` G-01 G-12 |
| G-13 | Toggle Boolean value, Edit value (value fed by a variable) | `QUAL-005 type-specific node actions change only their node …` | FE-045 | — | new: `filters.e2e.ts` G-13; `operations.spec.ts` |
| G-14 | The node-kind graph sends one filter per relation | `QUAL-005 the node-kind graph sends one filter per relation` | FE-042 | all | new: `operations.spec.ts` QUAL-005 graph; `request-parity.spec.ts` |

## Filters

| ID | Behavior | Legacy tests | Target | Scenario | Status |
|---|---|---|---|---|---|
| F-01 | Editor offers exact, starts with, contains (text); exact, ≥, ≤, between, MAX, MIN (numbers); value variable adds Any value and no MAX/MIN | `the numeric filter editor offers at least, at most and between …`, `an exact numeric match runs without a starts-with filter` | FE-045 | `filter-*` | new: `filters.e2e.ts` F-01 (two cases); `filter-form.spec.ts` |
| F-02 | Add value filter: lists datatype relations, creates a value variable seeded from the profile | `Add value filter lists datatype relations …`, `Add value filter on a relation without numbers …` | FE-045 | `add-value-filter` | new: `filters.e2e.ts` F-02 |
| F-03 | Histogram + range slider writes ≥, between, ≤; loading/empty/error/truncated states | `the filter editor histogram follows the range handles …`, `a truncated profile says …`, `… shows loading, empty, error and unprofilable states`, `a slow profile for an earlier editor …`, `… fits a narrow viewport` | FE-045 | `numeric-profile-*` | new: `filters.e2e.ts` F-03 (two cases); `histogram-model.spec.ts` |
| F-04 | Cycle over kept entities (5 at a time, play/pause, MIN/MAX ties) | `previous and next cycle over the kept entities …`, `play cycles the kept entities …`, `MIN shows every tied lowest entity …`, `the kept entities say when nothing is kept` | FE-045 | — | new: `filters.e2e.ts` F-04; `histogram-model.spec.ts` |
| F-05 | Text suggestions while typing (starts with / contains, stand-in variable) | `FE-038 typing in a value variable filter suggests …`, `FE-038 Edit value on a value node suggests …` | FE-045 | `text-suggestions-*` | new: `filters.e2e.ts` F-05 (two cases) |
| F-06 | Value-variable filter sent as `variableFilters`; Assume settles it without its filter | `FE-034 staged Run Query sends the value variable filter …`, `FE-034 Assume settles the value variable at once …` | FE-042/FE-045 | `value-variable-*` | new: `exploration.e2e.ts` F-06; `request-parity.spec.ts` |
| F-07 | `fetchNumericProfile` request shape | `fetchNumericProfile profiles the relation of a filter node …` | FE-042/FE-045 | `numeric-profile-*` | new: `filters.e2e.ts` F-03 (request body); `request-parity.spec.ts` |

## Query exploration (Run Query)

| ID | Behavior | Legacy tests | Target | Scenario | Status |
|---|---|---|---|---|---|
| E-01 | Run Query uses the component with the variables; ambiguous groups rejected; parallel predicate variables rejected | `Run Query and the stage order use the variable group …`, `a single variable in a later group …`, `variables in two unconnected groups …`, `… parallel predicate variables …`, `query variable detection ignores …` | FE-042/FE-046 | — | new: `exploration.e2e.ts` E-01 (four cases) |
| E-02 | Numbered stage-order blocks (≥2 variables), keyboard and pointer reorder, narrow viewport | `stage-order blocks appear next to Run Query …`, `a variable repeated as node and predicate is one block`, `keyboard reordering …`, `pointer dragging a block …`, `stage-order controls stay reachable …`, `variable order is session state …` | FE-046 | — | new: `exploration.e2e.ts` E-02 (two cases) |
| E-03 | Hover emphasis between graph and blocks | `hovering a variable node or relation emphasizes …`, `hovering or focusing a stage-order block …`, `a single-variable query emphasizes nothing` | FE-046 | — | new: `exploration.e2e.ts` E-03 |
| E-04 | Stage pages: typed candidates, loading/empty/error/retry, cache, Load more, stale responses | `the first stage requests typed candidates …`, `a stage shows loading then empty states …`, `a stage error shows the server message …`, `Load more requests the next offset page …`, `reordering while a stage loads …`, `editing the graph closes the exploration panel` | FE-046 | `run-query-*` | new: `exploration.e2e.ts` E-04 (three cases) |
| E-05 | Hover/focus preview of the next variable, budgeted | `hovering a candidate previews …`, `keyboard focus produces the same preview …`, `rapid pointer movement sends only the settled preview request`, `a superseded preview response is never displayed`, `a failed preview shows its error …` | FE-046 | `run-query-two-stage-apply` | new: `exploration.e2e.ts` E-05 (three cases) |
| E-06 | Back, summary, Apply to graph; Assume now | `Back clears the commitment …`, `three ordered stages end in a summary …`, `Assume on the first stage …`, `Assume on a later stage …`, `Back and Close from the summary …`, `empty and failed later stages …`, `QUAL-005 Assume binds …`, `QUAL-005 Apply to graph binds …`, `parallel edges sharing one predicate variable …`; e2e (4 cases) | FE-046 | `run-query-*` | new: `exploration.e2e.ts` E-06 (five cases); `tests-stack/ordered-exploration.e2e.ts` (QUAL-002 on Ktor) |
| E-07 | Possible-graph window (cycling values, long labels below, bottom sheet on narrow screens) | `the possible graph renders in its own window …`, `long possible-graph values are wrapped …`, `holding the cursor on an option cycles …`, `the possible graph keeps committed values …`, `on a narrow screen the possible graph is a bottom sheet …` | FE-046 | — | new: `exploration.e2e.ts` E-07 (three cases) |

## Funnel and badges

| ID | Behavior | Legacy tests | Target | Scenario | Status |
|---|---|---|---|---|---|
| B-01 | Funnel counts after each cumulative filter; MAX/MIN last; step toggles are preview only | `the filter funnel counts the remaining results …`, `a MAX step is counted after the other filters …`, `unticking a funnel step previews later counts only …` | FE-047 | `funnel-*` | new: `funnel.e2e.ts` B-01 (three cases) |
| B-02 | Funnel errors/retry, empty query, debounced refresh, abort superseded, keyboard and Escape, cap and narrow viewport | `the filter funnel shows count errors with a retry`, `… explains an empty query …`, `a superseded funnel refresh is aborted …`, `… is keyboard reachable …`, `… caps counted steps and fits a narrow viewport` | FE-047 | — | new: `funnel.e2e.ts` B-02 (two cases) |
| B-03 | Kept/total badge over filtered nodes; never changes query data; stale and error handling | `a numeric filter node shows a live kept/total badge …`, `the badge ignores a stale count …`, `the badge follows its node and reports a count error` | FE-047 | `funnel-*` | new: `funnel.e2e.ts` B-03 |
| B-04 | Fixed-entity subject: actual value chip and ✓/✗ | `after Assume the filtered node shows the actual value …`, `after Apply several actual values are joined …`, `a failed or empty value lookup …` | FE-047 | `actual-value-check` | new: `funnel.e2e.ts` B-04 |
| B-05 | Value-variable filters are funnel steps on the entity variable | `FE-039 value-variable filters are funnel steps …` | FE-047 | `funnel-value-variable` | new: `funnel.e2e.ts` B-05 |

## Pure-module oracles

The FE-042 domain ports these unit suites and keeps their expected values:
`frontend-tests/graph-model.unit.mjs`, `graph-binding.unit.mjs`,
`graph-actions.unit.mjs`, `query-calculations.unit.mjs`,
`query-stages.unit.mjs`.

## Source files

`frontend-tests/index2.spec.mjs`, `frontend-tests/e2e/ordered-exploration.spec.mjs`,
`sparql/index2.html`, `sparql/*.js`.
