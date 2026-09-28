# Two Variable Exploration Contract

The file name is historical; the approved contract below covers ordered
exploration of two or more variables (DEC-008, approved 2026-09-28).

## Confirmed capability

`POST /api/query` projects one `variableName` while triple patterns may contain
other SPARQL variables. Kotlin renders a variable predicate, subject, or object
unchanged. The display-oriented response (`PropertyDtoResponse`) cannot carry a
typed RDF binding, so staged exploration uses the additive
`POST /api/query/stage` route specified in [[../03 - Backend/API v1]].

## Variable detection

Only a whole node value or edge predicate value matching
`[?$][A-Za-z_][A-Za-z0-9_]*` counts as a variable. Variable-like substrings
inside fixed IRIs, literals, or malformed values do not count.

**Parallel-predicate correction (2026-09-27):** Two or more distinct predicate
variables between the same fixed subject and object are parallel alternatives,
not a traversal chain. The main Run Query action rejects that shape with an
explanatory message and leaves the graph intact; it neither opens the staged
panel nor submits an arbitrary single-variable query. Pairs are compared by
their directed RDF endpoint values. Successive edges forming a genuine chain
remain staged. Parallel edges sharing one variable remain an ordinary
one-variable query and bind together when a result is chosen.

## Approved ordered exploration contract (DEC-008)

**Variables and blocks.** Run Query considers only the first graph component,
as before. Each distinct variable name is one block, whether it occurs as a
node value, an edge predicate, or both; repeated occurrences share the block
and are bound together. Zero variables keep the existing error toast; one
variable keeps the legacy `/api/query` results table. Two or more variables use
staged exploration.

**Order.** The initial order is the sorted variable names. A numbered,
Scratch-like block list next to Run Query shows the order; blocks move by
pointer drag or by explicit Move up/Move down buttons (dragging is never the
only control). The order is session-only and is not exported with the graph.
It resets to the sorted order when the query signature changes: any graph
add/remove/value/predicate edit, graph load, New Query, or endpoint change.
*Implemented (FE-008):* labels and positions are excluded from the signature,
so cosmetic edits keep the order; a variable in both node and predicate
positions keeps its node and edge IDs in one registry entry.
*Implemented (FE-009):* the blocks form a horizontal numbered group ("Stage
order") beside Run Query, shown only for two or more variables. Because the
row is horizontal, the explicit controls are **Move earlier**/**Move later**
buttons (the Move up/Move down equivalents). Pointer-event dragging works for
mouse and touch; both controls call the same move, announce the new stage
through a polite live region, and never touch graph topology or positions.

**Stages.** Stage *k* lists candidates for the *k*-th variable under the
bindings committed for stages 1..*k*-1. Only the current stage is requested.
Hovering or keyboard-focusing a candidate temporarily assumes it and previews
candidates of the next variable; click or Enter commits it and advances. The
panel shows prior commitments; Back returns to the previous stage and clears
it and every later commitment. Previews never mutate the graph.

**Request budget.** Page size is the current Limit value capped at 50; "Load
more" requests the next offset page of the current stage. A preview request is
dispatched only after 300 ms of stable hover/focus, at most one preview request
is in flight, and a superseded request is aborted and its response ignored.
Responses are cached in memory per (query signature, ordered binding path,
variable, offset) until the signature changes. The client never requests all
candidate pairs.

*Implemented (FE-005):* Run Query opens the panel ("Explore query variables")
and requests only the first stage. `where` is captured once when the panel
opens. A reorder while the panel is open restarts at stage 1; a signature
change closes the panel and clears the cache. Candidate text is the label or,
without one, the term value, with a type hint (IRI, literal datatype or
language, blank node).

*Implemented (FE-006):* hover and keyboard focus call the same preview path;
a preview uses the same request shape and page size as the next stage, so a
committed candidate's next stage is usually served from cache. Leaving a
candidate before the delay drops its preview; a preview error shows the server
text inside the preview only. After a commit, focus moves to the new stage
heading; Enter inside the panel never triggers the global Run Query shortcut.

**Terms.** Candidates are distinct typed RDF terms: IRI or literal with
datatype/language preserved. Labels are display-only and never used as
bindings. Unbound rows are dropped. Blank nodes are listed but not selectable,
because their identity is not stable across requests. Committed bindings are
sent as typed terms and applied by the server through a `VALUES` clause, never
through string interpolation. Max/Min filters (filterType 4/5) are not
supported in staged exploration; the route rejects them with 400.

**States.** Each stage shows loading, empty ("No values for ?x under the chosen
bindings"), error (server error text, with Retry) and loaded states. A stale
response whose signature/path differs from the current state is discarded.

**Final action.** After the last variable is committed, the panel shows the
complete binding summary with **Apply to graph**. Only that explicit action
changes the graph: variable nodes are replaced by the chosen IRI/literal nodes
(edges rewired as in the legacy node replacement) and predicate-variable edges
are bound in place. Closing the panel or Back leaves the graph unchanged.

*Implemented (FE-010):* committing the last stage shows "All variables
chosen" with the numbered commitments, Back and **Apply to graph**. Apply
closes the panel first, then in one Cytoscape batch binds each IRI to its
predicate-variable edges (`nodeId` and label, edge ID kept) and replaces
each variable node with a node whose ID and value are `termGraphValue(term)`
(IRI `<…>` type `node`, literal lexical form type `label`, candidate text as
label). Connected edges move to it with their IDs and data. An existing node
with that ID is reused. Unlike the legacy result-table replacement, Apply
sends no relationship-value request and removes no neighboring nodes.
Literal datatype/language are not stored in graph nodes, matching other
literal nodes in the legacy query model.

## Typed data findings (INV-002, 2026-09-28)

- Remote Wikidata JSON (`WikidataHttpClient`) and local Jena results both map
  to application `RdfValue`: `Iri`, `Literal(lexicalForm, datatype, language)`
  and `BlankNode`. Unbound values are explicit `UnboundSparqlBinding`s.
- `ResultFilteringService.query` flattens these to strings: an IRI becomes
  `<iri>`, a literal loses datatype and language, a blank node becomes
  `"blank"`; rows lacking a label fall back to the ID. The legacy generator also
  requires `?x rdf:type ?xRdfType`, so untyped values never appear. These are
  captured C# behaviors and must not change.
- A safe additive path is a separate stage query that projects the raw
  `RdfValue` with an optional English label, groups by the value (duplicates
  collapse), orders by it for stable paging, and applies prior bindings with a
  typed `VALUES` row rendered by the server from validated IRIs and escaped
  literals. Blank nodes cannot be bound across separate remote requests.
- Local literal results carry `xsd:string`; Wikidata plain literals carry no
  datatype. The stage query renders `xsd:string` bindings as plain literals,
  which RDF 1.1 treats as the same term.

## Source files

- `sparql/index2.html`
- `sparql/query-calculations.js`
- `sparql/query-stages.js`
- `src/main/kotlin/com/example/sparqlqueryeasy/http/QueryHttpModels.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/application/query/ResultFilteringService.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/wikidata/client/WikidataHttpClient.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/rdf/jena/JenaRdfInfrastructure.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/wikidata/query/WikidataQueryGenerator.kt`
