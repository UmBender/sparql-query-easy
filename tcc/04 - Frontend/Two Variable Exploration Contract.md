# Two Variable Exploration Contract

## Confirmed capability

`POST /api/query` projects one `variableName` while triple patterns may contain
other SPARQL variables. Kotlin renders a variable predicate, subject, or object
unchanged. The frontend currently scans graph items and silently picks one
variable by traversal order, so two-variable queries are ambiguous.

## Approved direction

For exactly two distinct valid variables, running a query opens a side panel.
It will eventually list candidates for a first variable, let the user assume a
binding, then show bounded candidates and the approved preview for the second.
This avoids sending an uncontrolled `n × m` request.

## Decision required

`DEC-008` must decide variable ordering, candidate cap/paging/request budget,
supported positions, typed binding substitution, final preview, and behavior
outside exactly two variables before live candidate requests are added.

## Source files

- `sparql/index2.html`
- `src/main/kotlin/com/example/sparqlqueryeasy/http/QueryHttpModels.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/wikidata/query/WikidataQueryGenerator.kt`
