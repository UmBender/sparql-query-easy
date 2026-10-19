---
id: STUDY-005
title: End the proposed queries with a final submission that closes them for that user
status: READY
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

- [ ] Before finishing, tasks and submissions work as in STUDY-003/004.
- [ ] After finishing, list, open, submit and history routes return 403 for
      that user only; another user is unaffected (Testcontainers test).
- [ ] Finishing twice is idempotent (second call 409 or 200 with the same
      timestamp; pick one and document it in API v1).
- [ ] e2e: finish the study, then `/study/<key>` shows the finished page.

## Validation

Focused: `StudyRoutesTest`. Closing gate: HTTP/fullstack union including
`test:stack`.
