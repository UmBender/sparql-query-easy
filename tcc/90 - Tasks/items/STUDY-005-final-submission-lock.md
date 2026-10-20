---
id: STUDY-005
title: End the proposed queries with a final submission that closes them for that user
status: DONE
priority: P1
type: fullstack
depends_on: [STUDY-004, DEC-014]
human_gate: false
created: 2026-10-19
updated: 2026-10-19
---
# End the proposed queries with a final submission that closes them for that user

## Objective

T8 slice 3 of 3. Carries STUDY-001's existing criterion from user decision
D6 (2026-10-16), which the T8 brief does not mention: after the final
submission the user can no longer open the proposed queries.
Skill: `tcc-fullstack`.

## Scope

- Flyway migration for a per-user study completion record (user, finished_at).
- `POST /api/study/finish` (JSON only, Origin check), with a confirmation
  dialog in the frontend.
- After finishing, every `/api/study/tasks/**` and submission route answers
  403 with a clear error, and `/study` shows a "study finished" page instead of
  the tasks.

Excluded: the questionnaire shown after finishing (STUDY-002).

## Acceptance criteria

- [x] Before finishing, tasks and submissions work as in STUDY-003/004.
- [x] After finishing, list, open, submit and history routes return 403 for
      that user only; another user is unaffected (Testcontainers test).
- [x] Finishing twice is idempotent (second call 409 or 200 with the same
      timestamp; pick one and document it in API v1).
- [x] e2e: finish the study, then `/study/<key>` shows the finished page.

## Validation

Focused: `StudyRoutesTest`. Closing gate: HTTP/fullstack union including
`test:stack`.

## Conclusion

- Migration `V8__study_completion.sql`; `StudyProgressStore.finish/finishedAt`
  (insert-ignore, so the first time stays) and `StudyService.finish/finishedAt`.
- HTTP: `POST /api/study/finish` (same-origin JSON, session); the participant
  task and submission routes go through `studyOpen`, which answers 403 with
  "You have finished the study; the proposed queries are closed" after the
  final submission. Idempotency: a second finish is `200` with the same
  `finishedAt` (documented in API v1). Snapshot and types regenerated; the
  OpenAPI inventory in `OpenApiRoutesTest` moved to a property (detekt
  method length).
- Frontend: `api.study.finish`, `features/study/finish-study.svelte` (button
  and confirmation dialog, then every `['study']` query is invalidated),
  `features/study/study-finished.svelte` shown by `/study` and `/study/[key]`
  when the API answers `forbidden`.
- Tests: `StudyFinishRoutesTest` (403 on list, open, submit and history for
  that user only; another user unaffected; idempotent finish; 401/403/415)
  and the stack e2e (cancel, finish, finished page on `/study/<key>`, 403 on
  submit).
- Validation: Kotlin gate, frontend gate (84 e2e) and `test:stack` (16) pass.
