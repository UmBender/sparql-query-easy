---
id: QUAL-002
title: Verify ordered query exploration end to end offline
status: DONE
priority: P1
type: quality
depends_on: [DEV-001, BE-002, FE-010]
human_gate: false
created: 2026-09-27
updated: 2026-09-28
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

DEV-001, BE-002, FE-010.

## Acceptance criteria

- [x] Browser and Kotlin suites pass with deterministic fixture data.
- [x] Request budget and stale-response behavior are asserted, not inferred.
- [x] Capture-driven comparator and OpenAPI operation inventory remain green.
- [x] Diff and task documentation reviewed under the new per-task commit rule.

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

Resolved by QUAL-003: both browser suites fulfill third-party assets locally
and fail on any other external request.

## Execution log

- 2026-09-27: Planned only; no test modified or run.
- 2026-09-28: Added `npm run test:e2e` (`playwright.e2e.config.mjs`,
  `frontend-tests/e2e/ordered-exploration.spec.mjs`,
  `frontend-tests/fixtures/ordered-exploration.ttl`). It builds and starts
  the Ktor distribution on 127.0.0.1:18090, uploads the fixture and runs
  reordered 3-stage explorations through local Jena. They cover predicate,
  typed-literal and IRI bindings, duplicate collapse, hover and focus
  previews, Apply to graph, the unchanged one-variable table, and
  next-stage-only request budgets. The routed browser suite (FE-005..FE-010)
  covers races, empty/error states, graph/endpoint edits and the
  parallel-predicate guard. The external-asset guard moved to
  `frontend-tests/external-assets.mjs` for both suites; the default
  Playwright config ignores `e2e/`. No golden or capture changed.
  Validation: `npm run test:e2e` 3/3, browser suite 46/46, Kotlin
  `ktlintCheck detekt test` (capture comparator 2/2, OpenAPI 5/5 green),
  `git diff --check`.
