---
id: BE-001
title: Implement a safe typed bounded stage-query service
status: BACKLOG
priority: P1
type: backend
depends_on: [DEV-002, API-002]
human_gate: false
created: 2026-09-27
updated: 2026-09-27
---
# Implement a safe typed bounded stage-query service

## Objective

Execute one approved stage projection under already selected typed RDF
bindings, with a hard bound and without changing captured general-query paths.

## Evidence and relevant files

`src/main/kotlin/com/example/sparqlqueryeasy/application/query/GeneralQueryService.kt`;
`src/main/kotlin/com/example/sparqlqueryeasy/rdf/RdfAbstractions.kt`;
`src/main/kotlin/com/example/sparqlqueryeasy/rdf/jena/JenaRdfInfrastructure.kt`;
`src/main/kotlin/com/example/sparqlqueryeasy/wikidata/query/WikidataQueryGenerator.kt`.

## Exact scope

Add domain-owned typed binding/row values and one-stage execution according
to API-002. Apply prior bindings as validated RDF terms, not string/label
interpolation. Enforce limits and deterministic local-fixture tests for
subject/object/predicate projection, IRI/literal/datatype/language/blank node,
unbound values, duplicates, repeated names and zero results. Keep Jena types
inside RDF infrastructure.

## Explicitly out of scope

HTTP route, frontend, live Wikidata, rewriting existing `/api/query`, or
updating captured C# expected results.

## Dependencies

DEV-002 and approved API-002.

## Acceptance criteria

- [ ] Typed constraints cannot be injected via user-controlled values.
- [ ] Result type and limits match API-002, including duplicates/unbound cases.
- [ ] Existing capture comparator and focused service tests pass unchanged.

## Verification commands

```sh
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon
git diff --check
```

## Expected documentation updates

[[../../03 - Backend/API v1]]; [[../../04 - Frontend/Two Variable Exploration Contract]];
`MIGRATION.md` if an observable difference is introduced.

## Risks

Blank-node identity across separate remote requests may not be reusable;
API-002 must define the supported boundary. Avoid accidental Cartesian work.

## Execution log

- 2026-09-27: Planned only; no implementation started.
