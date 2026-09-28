---
id: QUAL-002
title: Verify ordered query exploration end to end offline
status: BACKLOG
priority: P1
type: quality
depends_on: [DEV-002, BE-002, FE-010]
human_gate: false
created: 2026-09-27
updated: 2026-09-27
---
# Verify ordered query exploration end to end offline

## Objective

Prove the complete block-order, candidate, hover/focus preview and final
selection flow against deterministic local fixtures without weakening C#
capture parity for existing routes.

## Evidence and relevant files

`frontend-tests/index2.spec.mjs`; `frontend-tests/server.mjs`;
`src/test/kotlin/com/example/sparqlqueryeasy/http/CaptureDrivenCompatibilityTest.kt`;
`src/test/kotlin/com/example/sparqlqueryeasy/http/OpenApiRoutesTest.kt`;
`compatibility/turtle/`.

## Exact scope

Add cross-layer offline regressions for 2/3+ variables, reordered stages,
hover/focus switching, abort/stale-response races, literal/IRI/predicate
bindings, duplicates/unbound rows, empty/error results, graph edits,
parallel-predicate guard, and old zero/one-variable flows. Verify request
counts/bounds and that no live remote call occurs in normal tests.

## Explicitly out of scope

Implementing missing feature behavior, altering golden captures, live
Wikidata, performance deployment, or production load testing.

## Dependencies

DEV-002, BE-002, FE-010.

## Acceptance criteria

- [ ] Browser and Kotlin suites pass with deterministic fixture data.
- [ ] Request budget and stale-response behavior are asserted, not inferred.
- [ ] Capture-driven comparator and OpenAPI operation inventory remain green.
- [ ] Diff and task documentation reviewed under the new per-task commit rule.

## Verification commands

```sh
npm run test:browser
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon
git diff --check
```

## Expected documentation updates

[[../../08 - Quality/Quality and Compatibility]];
[[../../04 - Frontend/Request Flows]]; `MIGRATION.md` if needed.

## Risks

External CSS/font requests make the current browser suite not fully offline;
the revised test loop should address this before relying on it as a gate.

## Execution log

- 2026-09-27: Planned only; no test modified or run.
