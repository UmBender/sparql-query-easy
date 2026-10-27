---
id: STUDY-013
title: Offer the Brasileirão 2023 example questions as proposed tasks the user can solve like a tester
status: READY
priority: P1
type: fullstack
depends_on: [DOC-009]
human_gate: true
created: 2026-10-27
updated: 2026-10-27
---
# Offer the Brasileirão 2023 example questions as proposed tasks the user can solve like a tester

## Objective

User request (2026-10-27): after the video base note (DOC-009), turn its
example questions on `CampeonatoBrasileiro2023` into proposed tasks, so the
user can use the platform the way the testers will: log in, open each task,
draw his own answer and submit it. Skills: `tcc-fullstack`
(`tcc-test` for the gate). Contract: [[../../09 - Decisions/Current Contracts]]
row "Study"; [[../../03 - Backend/API v1#Proposed tasks (admin, STUDY-006)]].

## Current mechanism (inspected 2026-10-27)

- Admins create tasks by drawing the reference query (`/admin/tasks/new`,
  `POST /api/admin/tasks`). The server runs the reference and stores the
  expected terms. New tasks are always compared as `set` (DEC-019).
- Each participant is in one group. Each group has its own ordered tasks
  (`/admin/groups`), so a separate group such as "Demo Brasileirão"
  keeps these tasks away from the PokemonGen1 test group without any
  product change.
- Answers are entity variables only (`answerVariables` in
  `frontend/src/lib/domain/study.ts`).

## Scope

- Turn the note's questions into task definitions: key, title, statement in
  Portuguese, endpoint `CampeonatoBrasileiro2023`, reference drawn query
  (FE-042 saved graph plus the derived request). Check each stored expected
  result against the answer in the note.
- A repeatable way to load them into a given environment, and a test that
  proves the expected results (proposed: a real-stack spec beside
  `tests-stack/study-query-creation.e2e.ts`).
- The PokemonGen1 tasks and groups are not touched.

## Decisions to confirm before implementation

- Which environment receives the tasks: the local Compose stack or the
  production server. On production, the user's consent, questionnaires and
  attempts would be stored with the participants' research data.
- Whether the tasks are seeded by a script through the admin API, or drawn
  by hand in `/admin` (this could itself be filmed for the video).

## Acceptance criteria

- The user, logged in as a participant in the demo group, sees the
  Brasileirão tasks in order on `/study`, can submit attempts and gets
  `Correct`/`Incorrect` with counts for each.
- Each stored expected result equals the answer in DOC-009's note.
- PokemonGen1 tasks and groups are unchanged.

## Validation

Focused: the new spec. Closing gate per the Operational Map (`test:stack`
for the study flow; the Kotlin gate only if backend code changes).

## Conclusion
