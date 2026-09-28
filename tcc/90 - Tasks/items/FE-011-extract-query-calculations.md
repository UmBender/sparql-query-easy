---
id: FE-011
title: Extract pure query calculations for ordered exploration
status: DONE
priority: P1
type: refactor
depends_on: [DEV-001, QUAL-003]
human_gate: false
created: 2026-09-28
updated: 2026-09-28
---
# Extract pure query calculations for ordered exploration

## Objective and main skill

Reduce the amount of page code needed for FE-008/009 by extracting graph-data-to-query calculations with unchanged behavior.
Use `tcc-refactor`.

## Evidence and scope

Confirmed entry points: `sparql/index2.html: buildFilters, getQueryVariables, hasParallelPredicateVariables; build.gradle.kts: processResources; frontend-tests/index2.spec.mjs`.

Extract a small native JS module receiving plain graph data; retain current global entry adapters and event order. Add meaningful pure tests using an explicitly configured script, preserve payloads including filterType 0, and include new assets in Gradle/Ktor packaging. No new variable policy, transport, framework or staged feature.

See [[../../04 - Frontend/Frontend Evolution Audit]] for reasoning and
[[../../09 - Decisions/Current Contracts]] for preserved behavior.

## Acceptance criteria

- [x] Existing zero/one/two-variable and parallel-predicate behavior is unchanged; payload regression oracles pass.
- [x] Pure calculations run without browser DOM/Cytoscape; the new test command exists and is documented.
- [x] Browser suite, Kotlin gate, installDist and packaged JS HTTP smoke pass.

## Validation

```sh
npm run test:browser
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test installDist --no-daemon
```

Apply the final area gate from [[../../06 - Development/Operational Map]].
A new pure-test command is proposed only in FE-011; confirm it exists before
reporting it as run.

## Dependencies and documentation

Depends on DEV-001, QUAL-003. Update this card, TASKS.md and the affected audit,
quality or frontend note only. No automatic implementation of later cards.

## Risks

Module globals and deferred initialization differ from classic scripts; retain the bridge and verify packaging.

## Execution log

- 2026-09-28: Created by DEV-001 frontend audit; not started.
- 2026-09-28: Extracted filter, variable and parallel-predicate calculations
  to `sparql/query-calculations.js`; kept global adapters and query event order
  in `index2.html`. Added four pure tests, `npm run test:query`, Gradle
  packaging and a Ktor static-route regression. Validation: pure tests pass;
  browser suite 23/23; Gradle `ktlintCheck detekt test installDist` passes;
  packaged HTTP GET `/query-calculations.js` returned 200 with JavaScript
  content type. Updated frontend architecture/audit, operational map, this
  card and task index.
