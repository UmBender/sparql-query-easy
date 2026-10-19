---
id: STUDY-004
title: Submit a drawn query as an answer, check it on the server and show the attempt history
status: BACKLOG
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

Attempt limits (Q1), feedback content (Q2), comparison (Q4) and what the
client sends (Q5) follow DEC-014. Text below states the recommended options;
update it with the user's answers before READY.

## Scope

- Pure comparison module in the application layer (no Jena types): modes
  `set` on the answer variable and `multiset` over rows; RDF terms compared as
  typed terms (IRI, literal with datatype/language), not display labels.
  Returns correct plus counts (matched, missing, extra) for feedback.
- Flyway `V4__study_submissions.sql`: `study_submission` (id, user_id →
  `app_user`, task_id → `study_task`, graph jsonb (FE-042), request jsonb,
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

Excluded: final submission lock (STUDY-005); showing the expected answer
unless DEC-014 Q2 = D; export of submissions (roles with STUDY-002).

## Acceptance criteria

- [ ] Unit tests for the comparison: equal sets (order and duplicates
      ignored in `set`), missing value, extra value, duplicate rows in
      `multiset`, literal datatype/language mismatch, empty expected set.
- [ ] A request body with `correct: true` (or any extra field) does not
      change the stored or returned result.
- [ ] Submitting the Fire/speed ≥ 90 reference graph is stored as correct; a
      graph without the speed filter is stored as incorrect with feedback.
- [ ] A user sees only their own attempts; another user's are never listed.
- [ ] Anonymous submit/list return 401; a missing database returns the
      persistence-unavailable error, not 500.
- [ ] Backend tests run on Testcontainers PostgreSQL and PokemonGen1; no
      external services.
- [ ] e2e (`test:stack`): log in, open a seeded task, submit a correct graph
      and see it accepted; submit a wrong graph and see the feedback and both
      attempts in the history (shape adjusted to DEC-014 Q1/Q2).

## Validation

Focused: comparison unit tests and `StudyRoutesTest` via the focused Kotlin
command. Closing gate: HTTP/fullstack union including `test:stack`.
