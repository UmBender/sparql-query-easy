---
id: QUAL-020
title: Prove client input cannot inject SPARQL into generated queries
status: DONE
priority: P1
type: quality
depends_on: []
human_gate: false
created: 2026-10-27
updated: 2026-10-28
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

Done 2026-10-28. No SPARQL injection found; one scope gap fixed.

- Payloads: `src/test/resources/security/sparql-payloads.json` (41: quote,
  brace, angle-bracket and IRI-path breakouts, `"`/`>` escape
  tricks, newlines and comments, SERVICE/FROM/GRAPH/INSERT DATA/DROP ALL/LOAD/
  CLEAR, PREFIX/BASE, a prefixed name, numeric/between/variable/language/
  datatype breakouts, NUL and control characters, Unicode separators,
  bidi/BOM, 20 000 and 8 000 character strings).
- Fields (`security/SparqlInjectionSlots.kt`): where subject/predicate/object
  as `<example/…>`, `<…>` and `?…`, an IRI path segment, literal objects with
  no filter, starts, contains, ≥, ≤, between (both bounds), MAX, MIN;
  `variableFilters` name and value (exact, starts, contains, ≥, ≤, between);
  `variableName` with and without `?`; on `/api/query`, `/sparql`, `/count`,
  `/stage` and `/numeric-profile` (plus its subject and predicate); stage
  bindings (variable, IRI value, literal value, datatype, language, type);
  relationships `id`, relationship-value subject and predicate; search text
  (local route, and the remote STRSTARTS search at the service); admin task
  create and preview `reference.query`, participant submission `query`. Query
  routes run on PokemonGen1 (real Jena execution) and on Wikidata through a
  recording fake (no network).
- Oracle (`security/SparqlInjectionOracle.kt`, `SparqlInjectionHarness.kt`):
  every query an endpoint executes is recorded. A payload is either `400`
  with nothing executed, or the benign status with queries that Jena parses
  (SPARQL 1.1) as one SELECT each, with no dataset, SERVICE or GRAPH, whose
  canonical algebra (variables renamed, IRIs and literals as placeholders,
  paths flattened, VALUES rows included) equals that of the same request with
  a benign value, and that hold the payload as exactly the one term the field
  asks for (literal lexical form, IRI, datatype or variable name). Kotest
  property tests (150 random strings per field) on View SPARQL, count and
  stage bindings. End to end: a literal payload returns no rows when no graph
  literal holds it, and never rows outside the Fire-type pattern.
- Mutation check (not committed): removing the `"` escape fails 4 tests
  (e.g. `x" || true || "` returns all 12 Fire Pokémon).
- Fix: `JenaLocalSparqlExecutor` ran `SERVICE` on local graphs and made the
  outbound request (reproduced against a loopback socket). It now refuses any
  SERVICE (also SILENT, inside FILTER EXISTS, in subqueries, `SERVICE ?var`)
  before execution and runs with `ARQ.httpServiceAllowed=false`;
  `rdf/jena/LocalServiceRefusalTest.kt`.
- Test dependency added: `io.kotest:kotest-property-jvm:5.9.1`.
- Open, not injection (left for QUAL-022/023; excluded from the persisted
  routes in `StudySparqlInjectionRoutesTest`): a task or attempt holding
  U+0000 answers 503 "Accounts are temporarily unavailable" (PostgreSQL cannot
  store it); an attempt with an answer variable over 64 characters answers 500.

Validation:
`GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon`
— BUILD SUCCESSFUL, 308 tests, 0 failures (on `main` at `60d3634`);
`node scripts/check-project-docs.mjs` and `git diff --check` pass.
