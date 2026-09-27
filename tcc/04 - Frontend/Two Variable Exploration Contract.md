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

## Source files

- `sparql/index2.html`
- `src/main/kotlin/com/example/sparqlqueryeasy/http/QueryHttpModels.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/wikidata/query/WikidataQueryGenerator.kt`
