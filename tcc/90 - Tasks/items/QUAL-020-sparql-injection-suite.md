---
id: QUAL-020
title: Prove client input cannot inject SPARQL into generated queries
status: READY
priority: P1
type: quality
depends_on: []
human_gate: false
created: 2026-10-27
updated: 2026-10-27
---
# Prove client input cannot inject SPARQL into generated queries

## Objective

Security plan threats 5–6 ([[../../08 - Quality/Security Test Plan]]).
Skills: `tcc-test`, `tcc-backend`.

## Scope and acceptance

- Shared payload fixture (`src/test/resources/security/sparql-payloads.json`):
  quote/brace/angle-bracket breakouts (`"} ; ?s ?p ?o . #`, `x> } UNION {`,
  `"`, newlines, `#` comments), keywords (`SERVICE <http://…>`,
  `FROM`, `INSERT DATA`, `DROP ALL`, `LOAD`), prefix injection, very long
  and control-character strings.
- Every client field that reaches `WikidataQueryGenerator` gets every
  payload: search text, `where` subject/predicate/object, `variableName`,
  `variableFilters` names/values, filter values (exact, starts, contains,
  ≥, ≤, between, MAX/MIN), stage bindings, numeric-profile and count
  inputs, admin task `reference.query`, participant submission `query`.
- Oracle per request: either `400` with no execution, or the generated
  SPARQL parses with Jena as exactly one `SELECT`, its algebra has only the
  triple patterns/filters the typed input asks for (no extra BGP, no
  `SERVICE`, no dataset clause, no update), and the payload occurs only
  inside a string literal or not at all. Property-based (Kotest) on top of
  the fixed list.
- End to end on the built-in graph: a payload never returns rows a benign
  query with the same shape would not.
- Local execution refuses `SERVICE` even if a future generator emitted one
  (ARQ service execution disabled for local graphs), with a test.

## Validation

Kotlin gate.

## Conclusion
