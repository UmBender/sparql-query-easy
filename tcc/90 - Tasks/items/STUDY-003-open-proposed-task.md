---
id: STUDY-003
title: List the proposed tasks and open one in the editor
status: BACKLOG
priority: P1
type: fullstack
depends_on: [DEC-014, FE-053, AUTH-004, BE-005, QUAL-011]
human_gate: false
created: 2026-10-19
updated: 2026-10-19
---
# List the proposed tasks and open one in the editor

## Objective

T8 slice 1 of 3 (STUDY-001 scope). A logged-in user sees the active proposed
tasks, opens one and gets its statement next to the editor, which starts
empty or from the task's starting graph on the task's endpoint.
Skill: `tcc-fullstack`. Contract: [[../../09 - Decisions/Authentication Contract]],
[[../../03 - Backend/API v1]].

Assumes DEC-014 Q3 = A (seed file → `study_task` table). Update this card if
the user picks otherwise.

## Scope

- Seed file `src/main/resources/study/tasks.json` (versioned, schema checked
  at startup): stable `key`, `title`, `statement`, `endpoint` (built-in
  PokemonGen1 id), optional `startingGraph` (FE-042 format), expected result
  set, reference SPARQL, `comparison` settings (DEC-014 Q4), `order`,
  `active`. At least 3 PokemonGen1 tasks, one of them "Fire-type Pokémon with
  speed ≥ 90" (oracle: the existing `fire-speed-at-least-90.query.json`).
- Flyway `V3__study_tasks.sql`: `study_task` (id, key unique, title,
  statement, endpoint, starting_graph jsonb, expected jsonb, comparison jsonb,
  position, active). Startup upserts the file; tasks missing from the file
  become inactive. Exposed stays in `persistence/`.
- Routes (session required, replacing the `/api/study/{...}` 404 stub for
  these paths): `GET /api/study/tasks` (active tasks in order: key, title,
  statement summary) and `GET /api/study/tasks/{key}` (statement, endpoint,
  starting graph). Neither returns the expected results or the reference SPARQL.
- OpenAPI `describe` blocks, the frontend snapshot and generated types.
- Frontend: `/study` lists the tasks; `/study/[key]` shows the task panel and
  the shared `QueryEditor` (FE-053) with the starting graph and locked
  endpoint. Data through the typed client and svelte-query, cleared on logout
  (AUTH-004).

Excluded: submitting and checking (STUDY-004); final-submission lock
(STUDY-005); admin routes; consent (DEC-014 Q6).

## Acceptance criteria

- [ ] Anonymous `GET /api/study/tasks` and `/api/study/tasks/{key}` return 401;
      `/study` and `/study/<key>` redirect to login (existing guard).
- [ ] Logged in: the list shows the 3+ seeded tasks in seed order; an unknown
      or inactive key returns 404.
- [ ] Task responses never contain expected results or reference SPARQL
      (route test asserts the JSON keys).
- [ ] Restarting with an edited seed file updates titles and deactivates a
      removed task without deleting its row (Testcontainers test).
- [ ] Every seeded task's reference SPARQL, run on PokemonGen1, returns its
      expected set (seed consistency test; no external services).
- [ ] The task page shows the statement and opens the editor on the task's
      starting graph (or empty) with the endpoint locked to PokemonGen1.

## Validation

Focused: a new `StudyRoutesTest` (proposed) via the focused Kotlin command.
Closing gate: HTTP/fullstack union (Kotlin closing gate, OpenAPI snapshot +
`api:types`, new frontend gate, `test:stack`).
