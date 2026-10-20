---
id: STUDY-006
title: Let an admin create, edit and retire proposed tasks by drawing the reference query
status: DONE
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

- [x] Participant/anonymous calls to every route: 403/401.
- [x] Creating the Fire-type speed ≥ 90 task from
      `fire-speed-at-least-90.query.json` stores the expected rows that the
      same request returns on PokemonGen1 (Testcontainers + local graph; no
      external services).
- [x] A request body with expected rows is ignored; a truncated reference
      result is rejected with 400.
- [x] Editing the reference increments `revision`; editing only the title
      does not change the expected snapshot.
- [x] Deactivating keeps the row; duplicate `key` returns 409.
- [x] e2e: an admin creates a task by drawing the reference graph and sees it
      in the list.

## Validation

Focused: `AdminTaskRoutesTest` (proposed) via the focused Kotlin command.
Closing gate: HTTP/fullstack union including `test:stack`.

## Conclusion

- Migration `V4__study_tasks.sql` (`study_task`, JSONB graphs, request and
  expected terms). `application/study`: `StudyTaskService` (validation,
  revision rule, preview), `StudyQueryRunner` (runs the client-derived request
  through `GeneralQueryService.executeTerms` on the task's endpoint with
  `LIMIT maxResults + 1`; more rows than the cap is rejected), `StudyTaskStore`
  port; `persistence/PostgresStudyStore.kt` with a JSONB column type.
- `GeneralQueryService.executeTerms` shares generation, validation and
  execution with `execute` and answers the typed terms of the variable per row.
- HTTP: `/api/admin/tasks` (list, get, create, update, preview,
  deactivate/reactivate) in `AdminRoutes.kt`; models in `StudyHttpModels.kt`
  (bodies decoded ignoring unknown fields), docs in `StudyOpenApi.kt`; the
  same-origin JSON guard is shared (`sameOriginJson`). OpenAPI snapshot and
  `schema.d.ts` regenerated.
- Revision: rerun and increment when the derived request (compared as JSON
  values: JSONB reorders keys), endpoint or cap change; statement and
  comparison changes also increment; a title-only edit keeps the snapshot.
- Frontend: `domain/study.ts` (`answerVariables`, `answerQuery`, checked
  against the captured legacy Fire request), client `api.admin.*` and a
  `forbidden` error kind, `/admin/tasks` list, `/admin/tasks/new` and
  `/admin/tasks/[key]` with `features/admin/task-editor.svelte` hosting the
  shared `QueryEditor` (locked endpoint; reference or starting graph).
- Tests: `AdminTaskRoutesTest` (Testcontainers + PokemonGen1), `study.spec.ts`,
  `tests-stack/study.e2e.ts` (the admin loads the Fire query in the task
  editor, previews, saves and finds the task listed). The stack run raises
  `EASYQUERY_AUTH_ATTEMPTS_PER_MINUTE` because the study suites log in many
  users from one address.
- Validation: Kotlin gate, frontend gate (176 unit, 84 e2e), `test:stack`
  (11) pass. `PostgresDatabaseTest` "a ready database lost after startup…"
  failed intermittently while editing; it fails the same way on an unchanged
  `HEAD` worktree (environment timing), and passed in the final gate.
- "Editing only the title does not change the expected snapshot": the
  reference is not rerun then. A layout-only change of the reference graph
  is stored without a new revision.
