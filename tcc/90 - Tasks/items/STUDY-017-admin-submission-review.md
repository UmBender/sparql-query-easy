---
id: STUDY-017
title: Let an admin review each participant's last saved answer beside the task's reference query
status: BACKLOG
priority: P1
type: fullstack
depends_on: [STUDY-016]
human_gate: false
created: 2026-11-02
updated: 2026-11-02
---
# Let an admin review each participant's last saved answer beside the task's reference query

Main skill: tcc-fullstack. Contract: [[DEC-020-manual-evaluation-and-submission-export]] (C3, C9, C10, points 2–4).

## Scope

- A migration stores every task revision (statement, reference graph and
  request, expected result). `StudyTaskStore.update` writes a new revision.
  Existing tasks get their current revision.
- `GET /api/admin/submissions` lists the last save per participant and task:
  pseudonym, task, revision, saved at, time spent, number of saves, `finished`
  and the auto-check hint.
- `/admin/submissions` opens a submission with the saved diagram read-only in
  the editor, beside the reference diagram and statement **of the submission's
  revision**, the generated SPARQL and the values.
- The pseudonym-to-account mapping is visible only on this admin page.

## Acceptance

- Editing a task after a save still shows the old reference for that save.
  A pre-migration save of an unknown revision says the reference was not kept.
- Non-admins get 403. Anonymous users get 401.
- Pseudonyms are stable across requests (C10).

## Validation

Backend route tests (Testcontainers), frontend component test of the review
page, and the fullstack gate.
