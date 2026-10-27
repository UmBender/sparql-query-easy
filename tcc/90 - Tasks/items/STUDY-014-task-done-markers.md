---
id: STUDY-014
title: Mark on the task list whether each task was already attempted or solved
status: READY
priority: P1
type: fullstack
depends_on: []
human_gate: false
created: 2026-10-27
updated: 2026-10-27
---
# Mark on the task list whether each task was already attempted or solved

## Objective

User request (2026-10-27): the participant's task list (`/study`) should
show whether each question was already done. Skills: `tcc-fullstack`
(`tcc-backend`, `tcc-frontend`, `tcc-style`). Contract:
[[../../03 - Backend/API v1#Proposed tasks (participant, STUDY-003)]],
[[../../03 - Backend/API v1#Answers and attempts (participant, STUDY-004)]].

## Scope and acceptance

- `GET /api/study/tasks` items gain an additive `status`: `not_started`
  (no attempt), `attempted` (attempts, none correct), `solved` (at least one
  correct attempt at the current or any revision — record the choice), from
  the caller's own submissions only. It never reveals the expected answer.
  Update the OpenAPI snapshot and frontend API types (Operational Map
  FE-043 row).
- `/study` list: a marker per task with icon + text (not colour only):
  "Not started", "Attempted", "Solved"; AA contrast in both themes; the
  marker updates when the participant returns after submitting (query
  invalidation). After the final submission the list is closed as today.
- Not owned here: editor link / back navigation (FE-061), questionnaires
  (STUDY-015).

## Validation

- Kotlin route test for the three states and that another user's attempts
  do not count; Vitest/Playwright for the markers (mock API); a real-stack
  check in `tests-stack/study-participant.e2e.ts` or `demo-study.e2e.ts`.
- Closing: Kotlin gate, frontend gate, `test:stack`; `test:screens`
  refreshed for the list change only.

## Conclusion
