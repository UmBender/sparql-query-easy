# Legacy Wire Format

QUAL-010. Field by field, what the legacy page `sparql/index2.html` sends in
each `/api/*` request body and what its Export Query file holds. FE-042 maps
the new `QueryGraph` to these same bodies; FE-043 types them. Flows (which
action sends what) stay in [[Request Flows]]; route semantics in
[[../03 - Backend/API v1]]. Every field below appears in at least one
`fixtures/legacy/*.request.json` (QUAL-009) unless marked *not captured*;
`node scripts/check-legacy-fixture-fields.mjs` fails when a captured field has
no row here.

## How the graph becomes a request

The page sends one connected component of the drawn graph (the one with the
variables, BUG-004). Each relation (edge) becomes one `where` item; nodes are
not sent on their own.

| Graph element | Request value |
|---|---|
| Entity node (`type: node`) | its `value`, an IRI in angle brackets, e.g. `<http://easyquery.example.org/pokemon#Pikachu>` |
| Variable node (`variable`, N results) | its name, e.g. `?pokemon` |
| Value node (`label`) | its lexical text, e.g. `50`, `Char`, `MAX`; its filter goes into `where[].filterType` |
| Value variable (`value-variable`, FE-034) | its name as the object; its filter goes into `variableFilters`, never into `filterType` |
| Class node (`default`) | its class IRI (`value`), not its node id |
| Relation | `predicate` = the edge's `nodeId`: a fixed IRI or a predicate variable (`?predicate_1`); a relation without one gets `?empty_<Date.now()>` |

Lost on the wire: node kinds, labels, positions, a literal's datatype and
language (a value node `50` is the string `50`; matching is lexical), and the
stage order (only implied by the sequence of `stage` requests).

Filter codes (`filterType`, also `variableFilters[].filterType`): `null`
exact, `0` starts with, `1` contains, `2` at least, `3` at most, `4` MAX,
`5` MIN, `6` between (`value` is `min..max`). Example:
`fixtures/legacy/view-sparql-only.request.json` (`3`),
`fixtures/legacy/numeric-profile-edit-between.request.json` (`6`).

## Request bodies

### `POST /api/query`

Sent by a variable's Run query action, class Explore values and the search
connection probe.

| Field | Type | Meaning | Fixture |
|---|---|---|---|
| `endpointUrl` | string | Endpoint field: built-in id (`PokemonGen1`), uploaded-graph id or URL | `node-run-query-table` |
| `limit` | integer | Limit field (default 150); the search probe sends 1 | `node-run-query-table` |
| `variableName` | string | The variable whose values are listed; Explore values uses `?default_<Date.now()>` | `filter-max-tie` |
| `where` | array | One item per relation of the component | `filter-max-tie` |
| `where[].subject` | string | Source node value (see table above) | `filter-max-tie` |
| `where[].predicate` | string | Edge `nodeId`; Explore values sends the prefixed `rdfs:domain` (rejected, 400) | `class-explore-values` |
| `where[].object` | string | Target node value | `filter-max-tie` |
| `where[].filterType` | integer or null | Target value node's filter; absent in the Explore values item | `filter-max-tie` |
| `variableFilters` | array | Value-variable filters, only when the component has some | (see `stage`) |
| `ignoreWikidata` | boolean | Search probe only: `false` (*not captured*: search is out of the corpus) | — |

### `POST /api/query/sparql`

View SPARQL. Same body as `/api/query` for the selected component.

| Field | Type | Meaning | Fixture |
|---|---|---|---|
| `endpointUrl` | string | Endpoint field | `view-sparql-only` |
| `limit` | integer | Limit field | `view-sparql-only` |
| `variableName` | string | The last variable found while scanning the component's elements; `""` when none is left (400) | `run-query-two-stage-apply` |
| `where`, `where[].subject`, `where[].predicate`, `where[].object`, `where[].filterType` | | As in `/api/query` | `view-sparql-only` |
| `variableFilters`, `variableFilters[].variableName`, `variableFilters[].filterType`, `variableFilters[].value` | | As in `stage` | `fire-speed-at-least-90` |

### `POST /api/query/stage`

Staged Run Query pages, hover previews and filter-editor text suggestions
(FE-038).

| Field | Type | Meaning | Fixture |
|---|---|---|---|
| `endpointUrl` | string | Endpoint field | `run-query-two-stage-apply` |
| `variableName` | string | Variable of the current (or previewed next) stage; suggestions use the value variable or `?suggestedValue` | `text-suggestions-contains` |
| `where`, `where[].subject`, `where[].predicate`, `where[].object`, `where[].filterType` | | As in `/api/query`; suggestions replace the value node by `?suggestedValue` with `filterType: null` | `run-query-two-stage-apply` |
| `bindings` | array | Committed choices of earlier stages, in stage order; `[]` for stage 1 and suggestions | `run-query-two-stage-apply` |
| `bindings[].variableName` | string | Bound variable | `run-query-two-stage-apply` |
| `bindings[].term` | object | The chosen RDF term, exactly as the server returned it | `run-query-two-stage-apply` |
| `bindings[].term.type` | `iri`, `literal`, `bnode` | Term kind | `run-query-two-stage-apply` |
| `bindings[].term.value` | string | IRI without brackets, or lexical form | `run-query-two-stage-apply` |
| `bindings[].term.datatype` | string or null | Literal datatype IRI | `run-query-three-reordered-assume` |
| `bindings[].term.language` | string or null | Literal language tag | `run-query-three-reordered-assume` |
| `limit` | integer | Limit field clamped to 1..50; suggestions send 20 | `fire-speed-at-least-90` |
| `offset` | integer | Page offset; Load more adds the page size | `fire-speed-at-least-90` |
| `variableFilters` | array | Filters of value variables that are objects of `where`; omitted when none apply | `fire-speed-at-least-90` |
| `variableFilters[].variableName` | string | The value variable | `fire-speed-at-least-90` |
| `variableFilters[].filterType` | integer or null | Its filter code; `null` with a value is exact, with `null` value any literal | `value-variable-any` |
| `variableFilters[].value` | string or null | Filter text (`90`, `0..1`); `null` for any value | `value-variable-any` |

### `POST /api/query/count`

Funnel steps and badges (FE-028, FE-036, FE-039).

| Field | Type | Meaning | Fixture |
|---|---|---|---|
| `endpointUrl` | string | Endpoint field | `funnel-step-off` |
| `variableName` | string | Counted variable (funnel picker; default the first non-value variable) | `funnel-step-off` |
| `where`, `where[].subject`, `where[].predicate`, `where[].object`, `where[].filterType` | | The component; a relaxed step's object becomes `?__funnel<position>` with `filterType: null` | `funnel-step-off` |
| `variableFilters`, `variableFilters[].variableName`, `variableFilters[].filterType`, `variableFilters[].value` | | As in `stage`; a relaxed value-variable step drops its filter | `funnel-value-variable` |

### `POST /api/query/numeric-profile`

Histogram of the editor and the seed of Add value filter (BE-003).

| Field | Type | Meaning | Fixture |
|---|---|---|---|
| `endpointUrl` | string | Endpoint field | `numeric-profile-edit-between` |
| `subject` | string | Source of the one fixed relation into the edited node | `numeric-profile-edit-between` |
| `predicate` | string | That relation's IRI | `numeric-profile-edit-between` |
| `limit` | integer | 500 for the histogram, 1 for the Add value filter seed | `add-value-filter` |
| `where`, `where[].subject`, `where[].predicate`, `where[].object`, `where[].filterType` | | The rest of the component without the profiled relation | `numeric-profile-edit-between` |
| `variableFilters` (and item fields) | | As in `stage`, when the rest has value variables | — |

### `POST /api/query/relationships`

Explore relationships, Connect with defined predicate, Add value filter.

| Field | Type | Meaning | Fixture |
|---|---|---|---|
| `endpointUrl` | string | Endpoint field | `explore-relationship-value` |
| `id` | string | Node value (IRI in brackets) | `explore-relationship-value` |
| `limit` | integer | Limit field; Explore relationships omits it | `add-value-filter` |

### `POST /api/query/relationship-value`

Results-table choice of a relationship, refetch after binding a variable, the
actual-value badge.

| Field | Type | Meaning | Fixture |
|---|---|---|---|
| `endpointUrl` | string | Endpoint field | `explore-relationship-value` |
| `subjectId` | string | Subject IRI in brackets | `explore-relationship-value` |
| `predicateId` | string | Relation IRI in brackets | `explore-relationship-value` |
| `isLiteral` | boolean | `true` for datatype relations (`propertyType: label`, `image`) and badges; refetch sends `false` for an IRI target | `node-run-query-table` |

### `POST /api/local-database`

Upload Triples: `multipart/form-data`, recorded as the list of form fields.

| Field | Type | Meaning | Fixture |
|---|---|---|---|
| `multipart` | array | Form fields of the upload (fixture representation) | `upload-local-graph` |
| `multipart[].name` | string | Always `ttlFile` | `upload-local-graph` |
| `multipart[].filename` | string | The chosen `.ttl` file name | `upload-local-graph` |

### `POST /api/query/search`

*Not captured* (search is outside the corpus): `endpointUrl`, `search`
(trimmed text), `limit` (Limit field).

## Saved query (Export Query)

Decision D-T2b = B (2026-10-17): documented as characterization only; the new
app neither imports nor writes this format (D6b), and FE-042 defines a
versioned one. Export is `JSON.stringify(cy.json())` saved as
`query_exported.json`; Upload Query calls `cy.json({ elements })`, so only
`elements` matters on load. Fixtures: `fixtures/legacy/*.export.json`
(`fire-speed-at-least-90`, `predicate-variable-edge`,
`run-query-three-reordered-assume`, `funnel-step-off`), which keep the
elements and list the other top-level keys (zoom, pan, style flags).

| Field | Meaning |
|---|---|
| `elements.nodes[].data.id` | Node identity; for entities and bound values the value itself |
| `elements.nodes[].data.value` | What the request sends for the node (see the table above) |
| `elements.nodes[].data.label` | Display text; filtered values show `≥ 100`, value variables `? ≥ 90` |
| `elements.nodes[].data.type` | `node`, `label`, `label-filter` (older imports), `default`, `variable`, `value-variable` |
| `elements.nodes[].data.filterType`, `.filterValue` | Value-node filter code; value-variable filter code and text |
| `elements.nodes[].data.color`, `.isLink`, `.href` | N results marker (`gray`), image link node and its URL |
| `elements.nodes[].position` | Canvas position |
| `elements.edges[].data.id`, `.source`, `.target` | Relation identity and ends (node ids) |
| `elements.edges[].data.nodeId`, `.label` | Predicate (IRI or `?name`) and its display label |
| `elements.edges[].data.type` | `variable` for a predicate-variable relation |
| `elements.*[].classes`, `.selected`, `.locked`, `.grabbable`, … | Cytoscape view state, ignored by the page |

Not saved: the endpoint, the limit, the stage order, filter funnel toggles.

## Source files

`sparql/app-core.js`, `sparql/query-calculations.js`, `sparql/query-stages.js`,
`sparql/graph-menus.js`, `sparql/graph-nodes.js`, `sparql/filter-funnel.js`,
`sparql/filter-badges.js`, `fixtures/legacy/`.
