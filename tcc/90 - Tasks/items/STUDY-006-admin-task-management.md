---
id: STUDY-006
title: Let an admin create, edit and retire proposed tasks by drawing the reference query
status: READY
priority: P1
type: fullstack
depends_on: [DEC-014, AUTH-005, FE-053, BE-005, QUAL-011]
human_gate: false
created: 2026-10-19
updated: 2026-10-19
---
# Let an admin create, edit and retire proposed tasks by drawing the reference query

## Objective

DEC-014 Q3 = B: tasks live in a `study_task` table managed through admin
routes, not a seed file. The admin writes the statement and draws the
reference query in the same editor as `/` (FE-053); the server runs it and
stores the expected result. Skill: `tcc-fullstack`.

## Scope

- Flyway migration `study_task`: id, stable `key` (unique), title,
  statement, endpoint (a built-in local graph id such as PokemonGen1; remote
  endpoints wait for DEC-004), optional starting graph (FE-042 jsonb),
  reference graph + derived request + generated SPARQL, expected result
  snapshot (typed RDF terms), comparison (`set` with answer variable, or
  `multiset`; DEC-014 Q4), `max_results` (default 1000), `revision`,
  `active`, timestamps. Exposed stays in `persistence/`.
- Expected result: the client sends the reference graph and the request it
  derives with the Run Query domain code (DEC-014 Q5); the server runs it on
  the task's endpoint with `max_results` and stores the rows. The client
  never sends expected rows. A result that hits `max_results` is rejected
  (expected set would be truncated).
- Routes under `/api/admin/tasks` (AUTH-005 guard, JSON only, Origin check):
  list (including inactive), get, create, update, preview (run the reference
  without saving), deactivate/reactivate. Changing statement, reference,
  comparison or endpoint increments `revision`. A task with submissions is
  never deleted, only deactivated.
- Frontend `/admin/tasks`: list, and an edit page with the statement form and
  the shared `QueryEditor` for the reference and the optional starting graph,
  a preview of the expected rows, and the comparison settings.
- OpenAPI snapshot and generated types.

Excluded: groups and assignment (STUDY-007); participant routes (STUDY-003).

## Acceptance criteria

- [ ] Participant/anonymous calls to every route: 403/401.
- [ ] Creating the Fire-type speed ≥ 90 task from
      `fire-speed-at-least-90.query.json` stores the expected rows that the
      same request returns on PokemonGen1 (Testcontainers + local graph; no
      external services).
- [ ] A request body with expected rows is ignored; a truncated reference
      result is rejected with 400.
- [ ] Editing the reference increments `revision`; editing only the title
      does not change the expected snapshot.
- [ ] Deactivating keeps the row; duplicate `key` returns 409.
- [ ] e2e: an admin creates a task by drawing the reference graph and sees it
      in the list.

## Validation

Focused: `AdminTaskRoutesTest` (proposed) via the focused Kotlin command.
Closing gate: HTTP/fullstack union including `test:stack`.
