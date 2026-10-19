---
id: STUDY-003
title: List the proposed tasks assigned to the user and open one in the editor
status: READY
priority: P1
type: fullstack
depends_on: [DEC-014, FE-053, STUDY-007, AUTH-004, BE-005, QUAL-011]
human_gate: false
created: 2026-10-19
updated: 2026-10-19
---
# List the proposed tasks assigned to the user and open one in the editor

## Objective

T8 participant slice 1 of 3 (STUDY-001 scope). A logged-in participant sees
the active tasks of their group (STUDY-007), opens one and gets its statement
next to the editor, which starts empty or from the task's starting graph on
the task's endpoint. Tasks are created by an admin (STUDY-006; DEC-014 Q3 =
B). Skill: `tcc-fullstack`. Contract: [[../../09 - Decisions/Authentication Contract]],
[[../../03 - Backend/API v1]].

## Scope

- Routes (session required, replacing the `/api/study/{...}` 404 stub for
  these paths): `GET /api/study/tasks` (the caller's group's active tasks in
  group order: key, title, statement summary) and `GET /api/study/tasks/{key}`
  (statement, endpoint, starting graph). Neither returns the expected result,
  the reference graph or SPARQL. A task outside the caller's group is 404.
- The first open of a task by a user is recorded (used by STUDY-004 for
  server-measured time spent).
- OpenAPI `describe` blocks, the frontend snapshot and generated types.
- Frontend: `/study` lists the tasks, or says that no tasks are assigned yet;
  `/study/[key]` shows the task panel and the shared `QueryEditor` (FE-053)
  with the starting graph and locked endpoint. Data through the typed client
  and svelte-query, cleared on logout (AUTH-004).
- Test data: at least 3 PokemonGen1 tasks (one is "Fire-type Pokémon with
  speed ≥ 90", from `fire-speed-at-least-90.query.json`), created through the
  STUDY-006 repository/routes in tests and the `test:stack` setup. No
  production seed file.

Excluded: submitting and checking (STUDY-004); final-submission lock
(STUDY-005); consent (DEC-014 Q6 deferred).

## Acceptance criteria

- [ ] Anonymous `GET /api/study/tasks` and `/api/study/tasks/{key}` return 401;
      `/study` and `/study/<key>` redirect to login (existing guard).
- [ ] Logged in: the list shows exactly the caller's group's active tasks in
      group order; a member of another group does not see them; an unknown,
      inactive or unassigned key returns 404.
- [ ] A user without a group gets an empty list and the "no tasks" message.
- [ ] Task responses never contain expected results, reference graph or
      SPARQL (route test asserts the JSON keys).
- [ ] The task page shows the statement and opens the editor on the task's
      starting graph (or empty) with the endpoint locked.

## Validation

Focused: a new `StudyRoutesTest` (proposed) via the focused Kotlin command.
Closing gate: HTTP/fullstack union (Kotlin closing gate, OpenAPI snapshot +
`api:types`, frontend gate, `test:stack`).
