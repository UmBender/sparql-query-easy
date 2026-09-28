---
id: INV-002
title: Characterize typed staged-query data and safe binding options
status: DONE
priority: P1
type: investigation
depends_on: [DEV-001]
human_gate: false
created: 2026-09-27
updated: 2026-09-28
---
# Characterize typed staged-query data and safe binding options

## Objective

Establish what the current one-variable API loses and which additive design
can safely constrain a subsequent variable to a chosen RDF value.

## Evidence and relevant files

`src/main/kotlin/com/example/sparqlqueryeasy/http/QueryHttpModels.kt`;
`src/main/kotlin/com/example/sparqlqueryeasy/application/query/GeneralQueryService.kt`;
`src/main/kotlin/com/example/sparqlqueryeasy/application/query/ResultFilteringService.kt`;
`src/main/kotlin/com/example/sparqlqueryeasy/rdf/RdfAbstractions.kt`;
`sparql/index2.html`; `compatibility/expected/`.

## Exact scope

Trace local and remote result bindings through filtering/serialization.
Compare typed IRI, language-tagged/typed literal, blank node, unbound value,
duplicate row, predicate variable and label handling. Describe a bounded
query strategy using typed binding constraints, without interpolation, and
state which existing API contracts must remain unchanged.

## Explicitly out of scope

New routes, frontend UI, live Wikidata, changing captures, production code.

## Dependencies

DEV-001, so this investigation follows the revised workflow.

## Acceptance criteria

- [x] Evidence-backed typed-result/constraint options and limitations are in
      the frontend contract or a focused backend note.
- [x] Existing `/api/query` output and its C# capture obligations are mapped.
- [x] A recommended additive path, test fixtures, and open decisions are
      recorded for DEC-008 and API-002.

## Verification commands

```sh
rg -n 'PropertyDtoResponse|SparqlResultRow|RdfValue|GeneralQueryRequest' src/main src/test
git diff --check
```

## Expected documentation updates

[[../../04 - Frontend/Two Variable Exploration Contract]]; [[../../03 - Backend/API v1]].

## Risks

Display labels cannot reconstruct RDF identity or datatype; string
substitution could change results or introduce SPARQL injection.

## Execution log

- 2026-09-27: Planned only; no code or tests run.
- 2026-09-28: Traced Wikidata JSON and Jena mapping to `RdfValue` and the
  lossy legacy `ResultFilteringService.query` flattening (captured, unchanged).
  Recommended a separate grouped/ordered stage query with typed `VALUES`
  bindings; findings are in the exploration contract's INV-002 section and
  fixtures follow in BE-001. No production code changed.
