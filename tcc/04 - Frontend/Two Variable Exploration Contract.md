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

**Variables and blocks.** Run Query considers one graph component, the
*query component*. *Changed by BUG-004 (2026-10-06):* it is the only component
that contains a variable; components without variables are ignored. With no
variable anywhere it is the first component, as before. If two or more
components contain variables, Run Query and View SPARQL show an error asking
to connect them or remove one, send no request, and no stage order is shown.
The node menu's Run query keeps using the clicked node's component.
Each distinct variable name is one block, whether it occurs as a node value,
an edge predicate, or both; repeated occurrences share the block
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
*Implemented (FE-023):* while the blocks are shown, hovering a variable node
or relation emphasizes its block, and hovering or keyboard-focusing a block
emphasizes every node and relation of that variable (a node and a predicate
sharing it together). Fixed elements and single-variable queries emphasize
nothing. Emphasis is a class on both sides only and follows re-rendered blocks.

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

*Approved change (FE-025, external requirement from the thesis advisor):*
each selectable value of the current stage also has an **Assume** button, a
second explicit graph-changing action. It applies the earlier commitments
plus that value with the same replacement rules as Apply, closes the panel,
keeps the remaining variables in their current block order and runs Run
Query again: the panel reopens at stage 1 for 2+ remaining variables, the
legacy single-variable query runs for one, and nothing more happens for none.
Clicking the value itself still only commits inside the panel; blank nodes
have no Assume button.

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

*Implemented (FE-015):* while the panel is open, a visual-only overlay
(`#concrete-preview`, `renderConcretePreview`) draws the concreted query on
the canvas. Committed values cover their variable nodes at node size (blue
disc for an IRI, pink rectangle for a literal) and their predicate edges
(white relation label). The hovered or focused candidate appears the same
way with a dashed orange outline, including on the last stage, where no
request is sent. The next variable's nodes show its preview state ("?x: 3
values", loading, no values, error). The overlay follows pan, zoom, resize
and node moves, and clears on close, Back, reorder and Apply. It changes no
Cytoscape data, class or style. When the panel would cover the query,
opening it changes only the viewport so the component fits beside the panel.

*Superseded by FE-017:* the canvas overlay and the viewport reveal were
removed. While the panel is open, a separate "Possible graph" window
(`#possible-graph-window`, a region left of the panel; bottom sheet under
800px) holds a read-only, non-interactive Cytoscape copy of the query
component (`possibleCy`, built by `queryStages.consolidatedGraphElements`).
Every occurrence of an assigned variable (node or predicate edge) shows its
value: committed values solid, the hovered/focused option with a dashed
orange outline, and one possible value of the next variable in purple.
Predicates only take IRI values; unassigned variables stay green and open.
While the cursor stays on an option, the window cycles every 3 s through up
to three selectable candidates of the next variable
(`queryStages.possibleValues`) from the already loaded preview page, with a
caption such as "If ?a = Alpha, ?b could be founded (1 of 3)." Leaving the
option stops the cycle and drops the assumption; the last stage shows only
the assumption. No extra requests are sent, the main graph's data and
viewport are unchanged, and the window hides when the panel closes.
*Implemented (FE-024):* the window is larger (up to 560px wide, canvas up
to 380px high; a 240px bottom sheet on narrow screens). A value too long to fit
inside its node, or between the two nodes of its relation, is shown complete,
wrapped at spaces under the element (`placePossibleLabels`, class
`label-below`) instead of being cut off; short labels keep their placement.

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
