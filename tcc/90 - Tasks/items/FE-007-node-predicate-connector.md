---
id: FE-007
title: Connect existing nodes with variable or defined predicates
status: DONE
priority: P1
type: frontend
depends_on: [FE-002, FE-003]
human_gate: false
created: 2026-09-27
updated: 2026-09-27
---
# Connect existing nodes with variable or defined predicates

## Objective

Let a user start an outgoing RDF edge from a node action list and finish it by
clicking another existing node.

## Evidence and relevant files

`sparql/index2.html`; `frontend-tests/index2.spec.mjs`;
`src/test/kotlin/com/example/sparqlqueryeasy/http/StaticFrontendRoutesTest.kt`.

## Exact scope

Provide variable and relationship-list predicate choices, a visible arrow
preview, target selection, cancellation, and graph-query integration.

## Explicitly out of scope

New backend routes, arbitrary predicate text entry, or creating a destination
node during this flow.

## Dependencies

FE-002 and FE-003.

## Acceptance criteria

- [x] Both actions appear on a node's left-click list.
- [x] Variable predicate creation adds an edge to an existing target node.
- [x] Defined predicate selection uses the source relationship list.
- [x] Preview cancellation adds no graph edge.
- [x] Browser suite and Kotlin quality gate pass.

## Verification commands

```sh
npm run test:browser
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat ktlintCheck detekt test --no-daemon
git diff --check
```

## Expected documentation updates

`MIGRATION.md`; [[../../04 - Frontend/Frontend Architecture]];
[[../../04 - Frontend/Request Flows]].

## Risks

The arrow preview must never enter the RDF graph before target selection.
Asynchronous predicate lists must not apply to a different selected node.

## Execution log

- 2026-09-27: Implemented the two node actions and arrow preview. Browser
  suite passed 20/20; Kotlin `ktlintFormat ktlintCheck detekt test` passed.
