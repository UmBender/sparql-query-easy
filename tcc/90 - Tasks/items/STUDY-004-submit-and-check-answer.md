---
id: STUDY-004
title: Submit a drawn query as an answer, check it on the server and show the attempt history
status: DONE
priority: P1
type: fullstack
depends_on: [STUDY-003, DEC-014]
human_gate: false
created: 2026-10-19
updated: 2026-10-19
---
# Submit a drawn query as an answer, check it on the server and show the attempt history

## Objective

T8 slice 2 of 3 (STUDY-001 scope). The user submits the drawn query; the
server runs it on the task's endpoint, compares the result with the expected
set using the task's comparison rule, stores the attempt and answers with the
feedback DEC-014 allows. A correctness value from the client is never read.
Skill: `tcc-fullstack`.

DEC-014 (2026-10-19): unlimited attempts until the final submission (Q1);
feedback is correct/incorrect plus counts, never the expected answer (Q2);
per-task `set`/`multiset` comparison (Q4); the client sends the graph and
the request it derives, the server runs it and decides correctness (Q5).

## Scope

- Pure comparison module in the application layer (no Jena types): modes
  `set` on the answer variable and `multiset` over rows; RDF terms compared as
  typed terms (IRI, literal with datatype/language), not display labels.
  Returns correct plus counts (matched, missing, extra) for feedback. The
  expected snapshot comes from STUDY-006.
- Flyway migration `study_submission` (id, user_id →
  `app_user`, task_id → `study_task`, task revision (STUDY-006), graph jsonb (FE-042), request jsonb,
  generated SPARQL, answer variable, result summary jsonb, correct, feedback,
  invalid (query failed), created_at, time_spent_ms). Time spent is measured
  on the server from the first open of the task by that user (recorded by
  `GET /api/study/tasks/{key}`), not trusted from the client.
- `POST /api/study/tasks/{key}/submissions` (JSON only, Origin check as in the
  Authentication Contract): runs the request through `GeneralQueryService` on
  the task's endpoint with the task's result cap; invalid queries are stored
  as invalid attempts and answered with a clear error, not 500.
- `GET /api/study/submissions?task={key}`: the caller's own attempts only.
- Frontend: submit button and answer-variable choice on the task page,
  feedback display, attempt history list (Superforms + Zod only if a form is
  needed); OpenAPI snapshot and generated types.

- Feedback text in the response: verdict plus counts (for example "3 of 7
  expected results; 2 extra"); the response never contains expected rows.

Excluded: final submission lock (STUDY-005); showing the expected answer
(DEC-014 Q2); export of submissions (STUDY-002); attempt limits (Q1:
unlimited).

## Acceptance criteria

- [x] Unit tests for the comparison: equal sets (order and duplicates
      ignored in `set`), missing value, extra value, duplicate rows in
      `multiset`, literal datatype/language mismatch, empty expected set.
- [x] A request body with `correct: true` (or any extra field) does not
      change the stored or returned result.
- [x] Submitting the Fire/speed ≥ 90 reference graph is stored as correct; a
      graph without the speed filter is stored as incorrect with feedback.
- [x] A user sees only their own attempts; another user's are never listed.
- [x] Anonymous submit/list return 401; a missing database returns the
      persistence-unavailable error, not 500.
- [x] Backend tests run on Testcontainers PostgreSQL and PokemonGen1; no
      external services.
- [x] e2e (`test:stack`): log in, open a seeded task, submit a correct graph
      and see it accepted; submit a wrong graph and see the feedback and both
      attempts in the history.
- [x] Each stored attempt carries the task revision it was checked against.

## Validation

Focused: comparison unit tests and `StudyRoutesTest` via the focused Kotlin
command. Closing gate: HTTP/fullstack union including `test:stack`.

## Conclusion

- `application/study/AnswerComparison.kt` (pure; typed terms, `set` and
  `multiset`, counts and feedback text) with `AnswerComparisonTest`.
- Migration `V7__study_submissions.sql`; `StudySubmissions.kt` (`Submission`,
  `AttemptResult`, `StudySubmissionStore` port);
  `persistence/PostgresStudySubmissionStore.kt` (result terms and counts in
  `result_summary`). `StudyService.submit` runs the request through
  `StudyQueryRunner` (→ `GeneralQueryService.executeTerms`) on the task's
  endpoint with the task's cap, stores the attempt with the task revision and
  the server-measured time since the first open; `attempts` lists the
  caller's own. `AnswerRun.Truncated` now carries the rows it got.
- HTTP: `POST /api/study/tasks/{key}/submissions`,
  `GET /api/study/submissions?task=`, in `StudyRoutes.kt`; bodies decoded
  ignoring unknown fields. Snapshot and types regenerated.
- Frontend: `api.study.submit/submissions`; the task page
  (`features/study/study-task.svelte`) has a Submit answer toolbar action, the
  answer-variable choice (`answerVariables`), the feedback line
  (`role="status"`) and the attempt history. No form library was needed.
- Tests: `AnswerComparisonTest`, `StudySubmissionRoutesTest` (correct/incorrect
  Fire task, forged `correct`, own attempts only, revision per attempt,
  invalid attempt, time spent, 404/401/403/503) and the stack e2e (correct,
  then the Fire query without its speed filter: feedback and two attempts).
- Validation: Kotlin gate, frontend gate (84; one run had
  `exploration.e2e.ts` E-04 fail on a duplicated stage request under load,
  which passed 5/5 alone and in the rerun of the whole gate; the test and
  exploration code are untouched here), `test:stack` (15) pass.
- Decision points recorded in API v1: an invalid query answers `201` with
  `invalid: true` (stored, visible in the history) rather than an error
  status; an answer cut by the cap is incorrect.
