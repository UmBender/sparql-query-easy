---
id: STUDY-016
title: Save a drawn answer, with or without variables, and show the participant no correctness
status: DONE
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

## Conclusion (2026-11-02)

Done. "Save answer" sends the graph and `{where, variableFilters}`
(`savedAnswerQuery` in `domain/study.ts`; every relation of a variable-free
diagram, the query component otherwise; a single node gives an empty `where`).
The response and `GET /api/study/submissions` carry only `save`,
`taskRevision`, `timeSpentMs`, `savedAt`; the page shows "Saved at …" and,
after a save, Back to the tasks / Next task. `/api/study/tasks` gives
`not_started`/`answered` and `lastSavedAt`.

The server stores an admin-only check (`AnswerCheck`, `auto_check` column,
`V12__study_answer_check.sql`): structural set comparison of the triples
without variables (C1), each of the first 6 variables against the expected
values with variables (C2). Rows saved before V12 are read as a check of their
one chosen variable. No route shows the check yet (STUDY-017).
Contract: [[../../03 - Backend/API v1#Saved answers (participant, STUDY-004, STUDY-016)]].

Limitations: a variable-free answer to a task whose reference has variables
never matches structurally (the reference triples contain the variables); the
researcher judges it by hand. The demo Brasileirão statements still say
"Responda com a variável…".

Validation: `AnswerCheckTest` (equal sets, extra, missing, different order,
filter, per-variable match/miss/cut/failure), `StudySubmissionRoutesTest`
(two-variable and entity-only saves reveal nothing; stored checks),
`StudyRequestLimitsRoutesTest`; Kotlin gate (ktlint, detekt, 360 tests)
passed; frontend check, lint, Vitest (292) and offline Playwright passed;
`test:screens` passed after refreshing the six `/help`, `/study` and
`/study/fire-fast` baselines (reviewed); `test:stack` (22) and
`test:compose` (4) passed.
