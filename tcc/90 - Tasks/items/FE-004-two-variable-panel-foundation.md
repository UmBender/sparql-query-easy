---
id: FE-004
title: Add the two-variable query exploration panel foundation
status: IN_PROGRESS
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

- [ ] Exactly two variables open the panel on Run Query.
- [ ] The panel is keyboard accessible and dismissible without graph changes.
- [ ] Zero/one-variable execution is unchanged.
- [ ] No request is sent for a two-variable graph.
- [ ] Browser and Kotlin checks pass.

## Verification commands

```sh
npm run test:browser
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon
```

## Execution log

- 2026-09-27: Started in `feature/two-variable-panel-foundation`.
