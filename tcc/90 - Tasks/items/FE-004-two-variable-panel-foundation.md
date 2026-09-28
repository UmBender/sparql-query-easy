---
id: FE-004
title: Add the two-variable query exploration panel foundation
status: REVIEW
priority: P1
type: frontend
depends_on: [FE-002]
human_gate: false
created: 2026-09-27
updated: 2026-09-27
---
# Add the two-variable query exploration panel foundation

## Objective

Replace silent traversal-order selection with an accessible side-panel
foundation for exactly two variables, without running candidate queries.

## Scope

- Detect exactly two distinct valid variables in query-relevant node and edge
  predicate values.
- Open an accessible side panel on Run Query, identify both variables, explain
  the staged flow, and allow safe dismissal.
- Preserve zero/one-variable behavior and send no request for this case.
- Add deterministic offline Playwright coverage and documentation.

## Out of scope

Candidate fetch, variable-ordering policy, binding substitution, previews, new
backend routes, and remote traffic.

## Acceptance criteria

- [x] Exactly two variables open the panel on Run Query.
- [x] The panel is keyboard accessible and dismissible without graph changes.
- [x] Zero/one-variable execution is unchanged.
- [x] No request is sent for a two-variable graph.
- [x] Browser and Kotlin checks pass (22 browser tests in the variable-detection
      follow-up; 107 Kotlin tests in the predicate-query follow-up).

## Verification commands

```sh
npm run test:browser
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon
```

## Execution log

- 2026-09-28: QUAL-003 closed the external browser traffic gap with local
  deterministic fixtures and a deny-by-default guard. The full 23-case
  browser suite and Kotlin quality gate pass with the current no-request
  two-variable panel. This card remains REVIEW for its existing human review.

- 2026-09-27: Started in `feature/two-variable-panel-foundation`.
- 2026-09-27: Implemented in isolated branch
  `feature/two-variable-panel-foundation`, commit `4d35a9c`. Its complete
  Kotlin gate, JavaScript syntax check, and diff check passed. Browser tests
  were not run because Playwright is not installed; no dependency was added.
- 2026-09-27: Integrated as merge commit `04254db` on `kotlin`. The integrated
  Kotlin quality gate and JavaScript syntax check passed. Status is `REVIEW`
  pending the required Playwright run.
- 2026-09-27: Browser execution exposed a fixture error: the test named
  "exactly two valid variables" created three distinct variables. Corrected
  its relation to a fixed predicate so the test exercises the approved two-
  variable case. The additional reported parallel-predicate bug now has a
  guard before staging/execution: multiple distinct predicate variables on
  the same fixed directed endpoint pair are rejected with a message. Two- and
  three-edge regressions preserve the graph and assert no API call; genuine
  chains retain the panel and repeated use of one variable still executes.
  Final validation passed: all 17 browser tests, all 107 Kotlin tests with
  `ktlintCheck detekt`, JavaScript syntax checks, and `git diff --check`.
- 2026-09-27: Review found that variable detection accepted matching
  substrings inside fixed IRIs, literals, and malformed values. Changed it to
  require a whole valid node value or edge predicate value. Added offline
  browser regressions for an IRI containing `?ghost` and malformed
  `?alpha-bad`, each alongside one real variable. The full browser suite
  passed (22 tests); JavaScript syntax and `git diff --check` passed. The
  initial browser attempt was blocked by sandbox socket permissions; an
  intermediate run timed out when a concurrent external-resource test-harness
  edit changed page layout. Both conditions were resolved before the passing
  run. No Kotlin production code changed in this correction.
- 2026-09-27: Final integrated checks passed (22/22 browser tests and the
  Kotlin quality gate), but the page still requests external CSS/fonts, so
  deterministic offline browser execution remains unverified. Kept REVIEW.
