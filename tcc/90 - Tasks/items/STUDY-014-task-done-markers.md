---
id: STUDY-014
title: Mark on the task list whether each task was already attempted or solved
status: DONE
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
[[../../03 - Backend/API v1#Saved answers (participant, STUDY-004, STUDY-016)]].

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

DONE 2026-10-27.

- API: `GET /api/study/tasks` items gain `status` (`not_started`,
  `attempted`, `solved`; OpenAPI enum), computed by
  `StudyService.tasksWithStatus` from `StudySubmissionStore.solvedByTask`
  (one query over the caller's own `study_submission` rows). Recorded
  choices: a correct attempt at **any** task revision counts as solved (an
  admin edit that raises the revision does not reset the marker; the attempt
  history still shows each attempt's revision); a later wrong attempt does
  not undo solved; invalid attempts count as attempted; opening a task
  without submitting stays not started. Canonical:
  [[../../03 - Backend/API v1#Proposed tasks (participant, STUDY-003)]] and
  the Study row of [[../../09 - Decisions/Current Contracts]].
- UI: `/study` shows a marker per task (`task-status-marker.svelte`): a
  Lucide icon plus "Not started" (dashed circle, muted), "Attempted" (dotted
  circle, warning) or "Solved" (check circle, success); the word is part of
  the link's accessible name, and on hover/focus the marker takes the link's
  accent foreground. Submitting on the task page also invalidates the task
  list query, so the list is current on return. The task page and app bar
  are unchanged apart from that invalidation (FE-061 owns navigation).
- Tests: `StudySubmissionRoutesTest` (three states, another user's attempts
  do not count, solved survives a wrong attempt and a new revision, no
  expected values in the list); `StudyRoutesTest` key set; offline
  `tests/study.e2e.ts` (three markers, accessible name, Solved after
  submitting and returning); stack `tests-stack/study-participant.e2e.ts`
  (Solved / Not started after a correct then wrong attempt); `study`
  screenshots in both themes refreshed with three markers.
- Gates: `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck
  detekt test --no-daemon` BUILD SUCCESSFUL; `npm --prefix frontend run
  check` 0 errors, `lint` clean, `npm --prefix frontend test` (Vitest server
  262, client 25, Playwright e2e 121) passed; `test:stack` 22 passed;
  `test:screens` 20 passed, 2 failed: `/help` light/dark differ inside the
  embedded help images (graph legend from `static/help-images`, refreshed by
  46ddebd without the `help` screen baselines). Pre-existing and unrelated to
  this change; the help baselines were left untouched.
