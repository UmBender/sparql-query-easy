---
id: STUDY-016
title: Save a drawn answer, with or without variables, and show the participant no correctness
status: READY
priority: P1
type: fullstack
depends_on: [DEC-020]
human_gate: false
created: 2026-11-02
updated: 2026-11-02
---
# Save a drawn answer, with or without variables, and show the participant no correctness

Main skill: tcc-fullstack. Contract: [[DEC-020-manual-evaluation-and-submission-export]] (C1, C2, C8).

## Scope

- "Submit answer" becomes "Save answer". The response and the task page show
  only "saved at" with no verdict, counts or `invalid`. The answer-variable
  choice is removed (`study-task.svelte`, `domain/study.ts` `answerQuery`).
- A non-empty diagram without variables can be saved. The server stores the
  graph and computes the admin-only check: structural triple-set comparison
  without variables, per-variable value comparison with variables (C1, C2).
- `/api/study/tasks` `status` becomes `not_started`/`answered` (STUDY-014).
- The final submission lock (STUDY-005), consent gates and the rate limit are unchanged.

## Acceptance

- A participant saves an entity-only diagram and a diagram with two
  variables. Neither response nor page reveals correctness.
- Server unit tests cover the structural comparison (equal sets, extra
  triple, missing triple, same triples drawn in a different order) and the
  per-variable comparison.
- The OpenAPI document and `API v1` describe the new response. Request-limit
  tests still pass.

## Validation

Focused backend and frontend unit tests, then the fullstack gate of the Operational Map.
