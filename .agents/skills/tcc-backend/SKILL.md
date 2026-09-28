---
name: tcc-backend
description: Implement or fix SPARQL EasyQuery Kotlin/Ktor services, HTTP routes, RDF/SPARQL, local graph cache or remote transports.
---
# tcc-backend

Follow repository AGENTS.md and read the selected task first. Locate the
operational map at `tcc/06 - Development/Operational Map.md` and current
contracts at `tcc/09 - Decisions/Current Contracts.md` when needed.

1. Locate the affected route/service and nearest test using `rg`. Backend root is `src/main/kotlin/com/example/sparqlqueryeasy/`.
2. Trace only the affected DTO → validation → service → endpoint executor → projection → response path.
3. Consult the current contract register for approved behavior; read API v1 or capture evidence only where relevant.
4. Implement a minimal slice. Preserve request-local endpoint context, client ownership and cancellation. Keep Jena objects inside `rdf/jena/` and materialize results before closing resources.
5. For bugs, reproduce the observable failure before fixing when practical. Test RDF kinds, unbound values, duplicate rows, literal lexical forms, errors or cache state only as relevant.
6. Use recorded bodies, fakes or a local server for transport. Do not contact Wikidata or regenerate C# captures to simplify a test.
7. Update route metadata in `http/OpenApiModule.kt` and the canonical API note if the approved contract changed.
8. Run the focused test while developing, then the Kotlin gate in the operational map once for the final state.

Entry points: `http/HttpModule.kt`, `http/QueryHttpModels.kt`, `application/`, `rdf/`, `wikidata/`.
Closest tests mirror these packages under `src/test/kotlin/`.

Report behavior, verification and local commit according to AGENTS.md.
