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

## Decisions (user, 2026-10-27)

- Environment: the local Compose stack only.
- Seeded by a script through the admin API; the admin side is not shown,
  only what the participant sees.
- Tasks: the note's suggestion P1, P2, P4, P5, P6, P8, P9, P10, in that
  order.

## Plan

1. Task data `frontend/scripts/demo-study/brasileirao-2023.json`: per task
   `key` (`br23-p1-rebaixados` …), Portuguese `title`/`statement` (the
   question, without the solution steps), endpoint
   `CampeonatoBrasileiro2023`, `reference` = saved graph (formatVersion 1,
   the note's drawn query) + the derived `query`, and the note's expected
   answer count.
2. Vitest spec: each `reference.graph` passes the saved-format schema and its
   `query` equals what `frontend/src/lib/domain/study.ts` derives from it, so
   the file cannot drift from the editor's mapping.
3. Seeder `frontend/scripts/seed-demo-study.mjs` (Node, `fetch`, no new
   dependency), idempotent: register-or-login the admin (must be listed in
   `EASYQUERY_ADMIN_USERNAMES`) and the participant (credentials from env
   vars), POST each task (PUT on 409), create-or-reuse group
   "Demo Brasileirão 2023", set its tasks in order, add the participant.
   Fails loudly when a stored `expectedCount` differs from the note.
   `npm --prefix frontend run demo:seed` with `--base-url` (default the
   Compose web port `http://127.0.0.1:8080`).
4. Real-stack spec `tests-stack/demo-study.e2e.ts`: run the seeder against
   the test stack, check every `expectedCount`, log in as the participant,
   see the 8 tasks in order on `/study`, submit a correct answer to one and
   an incorrect one to another (`Correct`/`Incorrect`).
5. Docs: runbook section in [[../../07 - Operations/Docker Compose Stack]]
   (set `EASYQUERY_ADMIN_USERNAMES` in `.env`, `docker compose up -d`, run
   `demo:seed`, log in at `/study`); Operational Map row; DOC-009 note
   points to it.
6. Gates: frontend gate + `test:stack`; no Kotlin change expected. Commit
   `STUDY-013 …`. The seeder is not run against the user's own Compose
   database unless asked.

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
