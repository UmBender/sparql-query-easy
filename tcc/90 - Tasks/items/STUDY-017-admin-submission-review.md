---
id: STUDY-017
title: Let an admin review each participant's last saved answer beside the task's reference query
status: DONE
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

## Conclusion (2026-11-02)

Done. `V13__study_task_revisions.sql` adds `study_task_revision` and copies
each task's current revision; `PostgresStudyStore` writes the current revision
on every create and update (upsert, so an edit that keeps the revision
replaces its row). `SubmissionReviewService` with
`PostgresSubmissionReviewStore` lists the last save per participant and task
(`GET /api/admin/submissions`) and reviews one with the reference of its
revision (`GET /api/admin/submissions/{id}`, 404 for an earlier save).
`/admin/submissions` lists them and `/admin/submissions/[id]` shows the saved
diagram read-only (`diagram-view.svelte`: the editor's `viewElements` and
stylesheet, no editing, also listed as text) with the check, each variable's
SPARQL and values, beside the statement, reference diagram, SPARQL and
expected values of the save's revision. `/admin` links to it.
Contract: [[../../03 - Backend/API v1#Saved answer review (admin, STUDY-017)]].

Deviation from DEC-020 C10, to confirm: pseudonyms are numbered by each
participant's **first save**, not by account creation order. With account
order, an older account that saves for the first time after an export would
shift every later pseudonym, which C10 itself forbids. First-save order keeps
"P + position among participants with a save" and never renumbers.

Limitations: the read-only diagram is the editor's canvas view, not the full
`QueryEditor` with its panels (no run, no filters dialog). A save to a
revision overwritten before V13 shows "reference for revision N not kept".

Validation: `AdminSubmissionRoutesTest` (Testcontainers: list with
pseudonyms, saves, finished and hint; stable pseudonyms when a newcomer
saves; old reference after an edit; structural check; missing revision; 404,
403, 401), `AccessControlMatrixTest`, `OpenApiRoutesTest`,
`PostgresDatabaseTest`; Kotlin gate (ktlint, detekt, 365 tests) passed after
the two expected-list updates; `submission-review.svelte.spec.ts`; frontend
check, lint and `npm test` (Vitest and 135 offline Playwright, axe on the new
pages) passed; `test:screens` passed after adding the four
`admin-submission(s)` baselines and refreshing `/admin` (new link; reviewed);
`test:stack` (22, live OpenAPI equals the snapshot) passed.
