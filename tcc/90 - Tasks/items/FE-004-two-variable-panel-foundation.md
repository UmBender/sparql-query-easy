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
- [ ] Browser and Kotlin checks pass. Kotlin checks pass; Playwright is not
      installed, so the required browser run remains pending.

## Verification commands

```sh
npm run test:browser
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon
```

## Execution log

- 2026-09-27: Started in `feature/two-variable-panel-foundation`.
- 2026-09-27: Implemented in isolated branch
  `feature/two-variable-panel-foundation`, commit `4d35a9c`. Its complete
  Kotlin gate, JavaScript syntax check, and diff check passed. Browser tests
  were not run because Playwright is not installed; no dependency was added.
- 2026-09-27: Integrated as merge commit `04254db` on `kotlin`. The integrated
  Kotlin quality gate and JavaScript syntax check passed. Status is `REVIEW`
  pending the required Playwright run.
