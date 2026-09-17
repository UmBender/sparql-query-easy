# Quality and Compatibility

## Existing coverage

**Confirmed:** Kotlin tests cover domain values, Jena parsing/execution, graph cache/upload, endpoint selection, query generation, filtering, relationships, search, HTTP routes, static frontend serving, and Wikidata clients.

**Confirmed:** C# has no ordinary application test project. `compatibility/Compatibility.Harness` is the characterization mechanism.

## Coverage gaps

- Browser-level frontend workflow tests. Static source/route declarations are
  covered by `StaticFrontendRoutesTest`; interactive Cytoscape and Materialize
  flows remain for `FE-001`. See [[04 - Frontend/Request Flows]].
- Valid C# captures for local search/built-in search after harness repair.
- Recorded Wikidata success/error fixtures replayed through Ktor routes.
- CORS, TLS/reverse-proxy, deployment, resource-limit, backup, and monitoring tests.
- Explicit production behavior for remote endpoint policy and uploads.

## RDF parity rules

Use graph isomorphism for graphs/blank-node labels, but preserve blank-node identity relationships in SELECT rows. Do not normalize literal lexical form, datatype, language, bindings, duplicate rows, or explicit ordering. Only documented literal-variable suffix normalization is allowed for generated SPARQL.

## Source files

- `AGENTS.md`
- `compatibility/README.md`
- `src/test/kotlin/com/example/sparqlqueryeasy/`
- `src/test/kotlin/com/example/sparqlqueryeasy/http/CaptureDrivenCompatibilityTest.kt`
