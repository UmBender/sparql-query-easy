---
id: FE-010
title: Complete ordered exploration across three or more variables
status: BACKLOG
priority: P1
type: frontend
depends_on: [DEV-001, FE-006]
human_gate: false
created: 2026-09-27
updated: 2026-09-28
---
# Complete ordered exploration across three or more variables

## Objective

Advance through the numbered order one bounded stage at a time and provide
the approved final query/result action without eager Cartesian expansion.

## Evidence and relevant files

`sparql/index2.html`; `frontend-tests/index2.spec.mjs`;
[[../../04 - Frontend/Two Variable Exploration Contract]];
[[../items/FE-006-second-variable-assumption-and-preview]].

## Exact scope

For 3+ distinct supported variables, commit each chosen typed binding,
display prior assumptions, move forward/back, request only the next stage,
and show the final approved result/preview after the last stage. Clear later
assumptions on backtracking, reorder, graph/endpoint edits or query restart.
Preserve the graph until an explicitly approved replacement action. Test
local deterministic 3-stage and empty/error transitions.

## Explicitly out of scope

Unbounded all-combinations output, automatic graph mutation on hover,
authentication, live upstream tests, and changing the legacy one-variable UI.

## Dependencies

DEV-001 and FE-006 (which establishes two-stage hover/focus semantics).

## Acceptance criteria

- [ ] 3+ stages respect user order and issue only budgeted next-stage requests.
- [ ] Backtracking/reordering invalidates dependent data and never shows stale
      preview or silently mutates nodes/edges.
- [ ] Final action and zero/one/two-variable regressions match DEC-008.
- [ ] Offline browser and Kotlin gates pass.

## Verification commands

```sh
npm run test:browser
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon
git diff --check
```

## Expected documentation updates

[[../../04 - Frontend/Frontend Architecture]];
[[../../04 - Frontend/Request Flows]];
[[../../04 - Frontend/Two Variable Exploration Contract]].

## Risks

Branching candidate sets can grow exponentially. Keep only one committed
binding path and one bounded preview request at a time.

## Execution log

- 2026-09-27: Planned only; final-result behavior awaits DEC-008.
