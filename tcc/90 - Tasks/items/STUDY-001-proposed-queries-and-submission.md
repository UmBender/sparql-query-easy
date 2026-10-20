---
id: STUDY-001
title: Let a logged-in user solve proposed queries and submit answers once
status: DONE
priority: P1
type: fullstack
depends_on: [AUTH-001, AUTH-003, AUTH-004, BE-005, FE-046, FE-053, AUTH-005, STUDY-006, STUDY-007, STUDY-003, STUDY-004, STUDY-005]
human_gate: false
created: 2026-10-16
updated: 2026-10-20
---
# Let a logged-in user solve proposed queries and submit answers once

## Objective

T8. The thesis evaluation (`tcc/proposta_tcc_final.tex`, method): users
solve proposed tasks; each has a reference SPARQL and expected results;
correctness is measured by result, plus time, attempts and invalid queries.
Skill: `tcc-fullstack`.

## Scope

- Proposed queries defined in a versioned file in the repository (task text,
  endpoint/dataset, reference SPARQL, expected results), loaded at startup.
- Logged-in user: list of tasks, open one in the editor, submit an answer;
  stored: `QueryGraph` (FE-042 format), generated SPARQL, result rows,
  timestamps, attempt count, invalid-query count, correctness against the
  expected results (unordered multiset unless the task needs ORDER BY).
- Final submission: afterwards the user can no longer open the proposed
  queries (user decision D6, 2026-10-16). Anonymous users never see them.
- Routes under `/api/study/**`, session required (Authentication Contract).

## Pending input (not blocking the build)

The task texts and reference queries are the user's; the card ships with
PokemonGen1 sample tasks. Whether the participant sees correctness is
undecided: default hidden.

## Acceptance criteria

- [x] Submission and correctness tests on PokemonGen1 (Kotlin + e2e).
- [x] After final submission every proposed-query route and screen refuses access.
- [x] Anonymous requests to `/api/study/**` return 401.

## Note (2026-10-18, AUTH-004)

`/study` exists as an empty page behind the root layout's guard
(`frontend/src/lib/features/auth/route-guard.ts`): anonymous visitors go to
`/login?next=/study` and come back after login. Fill that page here; further
protected paths go in `PROTECTED_PREFIXES`.

## Proposed changes (T8 brief, 2026-10-19; accepted by DEC-014)

DEC-014 (2026-10-19) accepted these changes; where the text above differs
(one submission, hidden correctness, repository task file, multiset only),
DEC-014 wins. Tasks come from admin routes with participant groups
(AUTH-005, STUDY-006, STUDY-007), so the 3 seeded tasks are test data.

- Split: delivered by FE-053 (editor reuse), AUTH-005 (roles), STUDY-006
  (admin tasks), STUDY-007 (groups), STUDY-003 (list and open), STUDY-004
  (submit, check, history) and STUDY-005 (final-submission lock).
  On approval, `depends_on` gains those seven and this card closes when they
  are DONE.
- Added acceptance criteria from the brief:
  - [x] At least 3 seeded PokemonGen1 tasks.
  - [x] Correctness is computed on the server only; a client value is ignored.
  - [x] Per-task comparison rule (DEC-014 Q4) with unit tests.
  - [x] Time spent per attempt stored, measured on the server.
  - [x] The task page uses the same editor component as `/` (no copy) and
        starts empty or from the task's starting graph.
  - [x] Attempt history for the user's own submissions.
  - [x] e2e: log in, solve a seeded task, submit a wrong answer and see
        feedback (subject to DEC-014 Q1/Q2).
- Conflicting points (attempts, feedback visibility, task source/admin,
  set vs multiset, client vs server mapping, LGPD) are in DEC-014.

## Conclusion (2026-10-20)

Closed by its seven slices, all DONE: FE-053 (`544434c`), AUTH-005
(`546f369`), STUDY-006 (`4bca301`), STUDY-007 (`0cd5ecc`), STUDY-003
(`f1c84d0`), STUDY-004 (`f71d561`), STUDY-005 (`5d739ab`). Where the scope
above differs, DEC-014 governs: tasks come from admin routes, not a file;
attempts are unlimited; the participant sees correct/incorrect and counts.

| Criterion | Evidence |
|---|---|
| Submission and correctness tests on PokemonGen1 (Kotlin + e2e) | `AnswerComparisonTest`, `StudySubmissionRoutesTest`; `tests-stack/study-participant.e2e.ts` |
| After the final submission every proposed-query route and screen refuses access | `StudyFinishRoutesTest` (403 on list, open, submit, history); finished page e2e |
| Anonymous `/api/study/**` returns 401 | `StudyRoutesTest`, `StudySubmissionRoutesTest`, `StudyFinishRoutesTest`, `AuthRoutesTest` |
| At least 3 PokemonGen1 tasks (test data, DEC-014) | created through the STUDY-006 routes in `StudyRoutesTest` and `seedStudy` (`tests-stack/support.ts`); no production seed |
| Correctness only on the server; a client value is ignored | `StudySubmissionRoutesTest` (forged `correct`), `AdminTaskRoutesTest` (forged expected rows) |
| Per-task comparison rule with unit tests | `set`/`multiset` (STUDY-006 setting), `AnswerComparisonTest` |
| Time spent per attempt, measured on the server | `study_task_open` + `time_spent_ms`; `StudySubmissionRoutesTest` |
| Same editor as `/`, empty or from the starting graph | `features/study/study-task.svelte` hosts `QueryEditor` (FE-053); participant e2e |
| Attempt history of the user's own submissions | `GET /api/study/submissions?task=`; own-attempts test; history e2e |
| e2e: log in, solve a task, a wrong answer shows feedback | `study-participant.e2e.ts` (correct, then wrong with feedback and both attempts) |

Remaining outside T8: consent and LGPD stay deferred (DEC-014 Q6, D5) to
go-live with STUDY-002/LEARN-014; remote endpoints for tasks wait for DEC-004.
