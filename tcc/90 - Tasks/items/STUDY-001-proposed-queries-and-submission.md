---
id: STUDY-001
title: Let a logged-in user solve proposed queries and submit answers once
status: BACKLOG
priority: P1
type: fullstack
depends_on: [AUTH-001, AUTH-003, AUTH-004, BE-005, FE-046]
human_gate: false
created: 2026-10-16
updated: 2026-10-16
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

- [ ] Submission and correctness tests on PokemonGen1 (Kotlin + e2e).
- [ ] After final submission every proposed-query route and screen refuses access.
- [ ] Anonymous requests to `/api/study/**` return 401.

## Note (2026-10-18, AUTH-004)

`/study` exists as an empty page behind the root layout's guard
(`frontend/src/lib/features/auth/route-guard.ts`): anonymous visitors go to
`/login?next=/study` and come back after login. Fill that page here; further
protected paths go in `PROTECTED_PREFIXES`.

## Proposed changes (T8 brief, 2026-10-19; pending DEC-014)

Not applied; the text above stays as written until the user decides.

- Split: delivered by FE-053 (editor reuse), STUDY-003 (list and open),
  STUDY-004 (submit, check, history) and STUDY-005 (final-submission lock).
  On approval, `depends_on` gains those four and this card closes when they
  are DONE.
- Added acceptance criteria from the brief:
  - [ ] At least 3 seeded PokemonGen1 tasks.
  - [ ] Correctness is computed on the server only; a client value is ignored.
  - [ ] Per-task comparison rule (DEC-014 Q4) with unit tests.
  - [ ] Time spent per attempt stored, measured on the server.
  - [ ] The task page uses the same editor component as `/` (no copy) and
        starts empty or from the task's starting graph.
  - [ ] Attempt history for the user's own submissions.
  - [ ] e2e: log in, solve a seeded task, submit a wrong answer and see
        feedback (subject to DEC-014 Q1/Q2).
- Conflicting points (attempts, feedback visibility, task source/admin,
  set vs multiset, client vs server mapping, LGPD) are in DEC-014.
