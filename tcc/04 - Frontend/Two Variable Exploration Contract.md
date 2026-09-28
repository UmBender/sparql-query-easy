# Two Variable Exploration Contract

## Confirmed capability

`POST /api/query` projects one `variableName` while triple patterns may contain
other SPARQL variables. Kotlin renders a variable predicate, subject, or object
unchanged. The frontend currently scans graph items and silently picks one
variable by traversal order, so two-variable queries are ambiguous.

## Approved direction

For exactly two distinct valid variables, running a query opens a side panel.
Only a whole node value or edge predicate value matching
`[?$][A-Za-z_][A-Za-z0-9_]*` counts as a variable. Variable-like substrings
inside fixed IRIs, literals, or malformed values do not count.
It will eventually list candidates for a first variable, let the user assume a
binding, then show bounded candidates and the approved preview for the second.
This avoids sending an uncontrolled `n × m` request.

**Parallel-predicate correction (2026-09-27):** Two or more distinct predicate
variables between the same fixed subject and object are parallel alternatives,
not a traversal chain. The main Run Query action rejects that shape with an
explanatory message and leaves the graph intact; it neither opens the staged
panel nor submits an arbitrary single-variable query. Pairs are compared by
their directed RDF endpoint values. Successive edges forming a genuine chain
retain the exactly-two-variable panel. Parallel edges sharing one variable
remain an ordinary one-variable query and bind together when a result is chosen.
This guard does not introduce general multi-variable execution or change the
backend SPARQL contract.

## Decision required

`DEC-008` must decide variable ordering, candidate cap/paging/request budget,
supported positions, typed binding substitution, final preview, and behavior
outside exactly two variables before live candidate requests are added.

## Proposed extension, not implemented

The user now wants a numbered, reorderable, Scratch-like variable menu next to
Run Query for two or more variable nodes. Exploration should follow that user
order: show bounded candidates for the current variable; hovering or focusing
a candidate temporarily assumes it and previews possible values of the next
variable; selection commits the assumption and advances. The exact treatment
of predicate variables, repeated names, disconnected components, final query
results, and persisted order remains a `DEC-008` decision.

The existing `/api/query` response is display-oriented and projects one
variable. A safe preview may need an additive typed-binding API rather than
reconstructing an RDF term from its label. Implementation tasks are gated on
the revised development workflow and an approved contract; no current API or
frontend behavior is changed by this note.

## Source files

- `sparql/index2.html`
- `src/main/kotlin/com/example/sparqlqueryeasy/http/QueryHttpModels.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/wikidata/query/WikidataQueryGenerator.kt`
