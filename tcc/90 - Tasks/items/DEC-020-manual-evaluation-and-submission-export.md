---
id: DEC-020
title: Decide how saved answers are evaluated by hand and exported with a plain-text diagram
status: REVIEW
priority: P1
type: decision
depends_on: [DEC-014]
human_gate: true
created: 2026-11-02
updated: 2026-11-02
---
# Decide how saved answers are evaluated by hand and exported with a plain-text diagram

## Objective

The user and their advisor decided (2026-11-02) that proposed tasks are
evaluated by hand, or with AI help, after the study, with no correctness shown
to the participant. The application saves each participant's diagram, and the
researcher checks it. When a diagram is right, the query it generates is
equivalent to the reference. A task must not depend on the answer having
variables: the point is whether the participant reached the expected result
with the tools, not whether they wrote a reusable query.

This reopens DEC-014 Q2 (verdict and counts shown after each attempt) and the
`solved` marker of STUDY-014.

## User decisions (2026-11-02)

1. Tasks do not depend on variables: a diagram made only of concrete entities
   and relations is a valid answer, and a diagram with variables still is.
2. The automatic check stays, but only the admin sees it. The admin view of a
   submission also shows the task's reference query for that submission.
3. Only the last saved answer per participant and task is exported.
4. Participants appear under a pseudonym in exports.
5. The text diagram in the export is `diagram.txt` in plain text, as first
   proposed. Mermaid was considered and dropped on 2026-11-02 (its conflicts
   C4–C7 are in git history): it needed escaping rules and a `mermaid`
   devDependency to be guaranteed valid.

## Evidence (2026-11-02)

- `frontend/src/lib/features/study/study-task.svelte` `submit()` and
  `domain/study.ts` `answerQuery()` require at least one relation and one
  chosen *answer variable*. A graph without variables cannot be submitted.
- `GeneralQueryRequest` has a single `variable`. `StudyService` compares that
  variable's values with `ExpectedResult.values`, which comes from the reference
  query's variable (`StudyTasks.kt`).
- `StudyTaskStore.update` replaces the task in place and only increments
  `revision`. The reference graph of older revisions is not kept, but
  `Submission.taskRevision` refers to it.
- `Submission` already stores `graphJson` (FE-042 `formatVersion: 1`, node
  `label`s included), `requestJson`, `sparql`, `result.values`, `timeSpentMillis`.
- No admin route reads submissions. The only admin export is the questionnaire
  CSV (`AdminFormRoutes.kt`, STUDY-011).
- The participant sees `Correct`/`Incorrect`/`Invalid query` and counts
  (`study-task.svelte` `verdict`), and `/study` shows `solved` (STUDY-014).

## Conflicts and recommendations

| # | Conflict | Recommendation |
|---|---|---|
| C1 | A diagram without variables generates no SELECT and returns no values, so the current check and the export's `values.csv` have nothing to show. A reference drawn without variables has no expected values either. | Answers without variables are checked **structurally**: the set of drawn triples (subject, predicate, object terms) is compared with the reference's set, without running a query. Answers with variables keep the current value comparison. `values.csv` is written only when the answer has variables. |
| C2 | With several variables, the participant must choose the answer variable. That makes the task depend on a variable and on names the participant picked. | Remove the answer-variable choice. The admin check tries every variable of the answer (at most a small cap) against the expected values and reports which one matches, if any. The export keeps the values per variable. |
| C3 | Task edits overwrite the reference. "Show the query this submission refers to" fails for submissions to an older revision. | Store each task revision (statement + reference graph + expected result) in a revision table. Submissions made before the migration whose revision is no longer current show "reference for revision N not kept". |
| C4 | A text diagram loses positions, `order`, `limit` and the endpoint, and the editor cannot load it. | `diagram.json` stays the source of truth (opens with *Load*). `diagram.txt` is derived from it and says so in its header. |
| C5 | Two entities with the same label ("São Paulo" the team and the city) and labels containing arrows or line breaks make a text diagram ambiguous. | Number every node (`[1]`, `[2]`…), list the nodes with their kind, IRI and filter first, then write each relation as `[n] --label--> [m]` by number. Line breaks in labels become spaces. |
| C8 | `solved`/`attempted` markers and the per-attempt history give correctness away or stop making sense. | The participant's button becomes "Save answer". `/study` shows `not_started`/`answered` and the time of the last save. Earlier saves stay in the database but are not shown or exported. |
| C9 | "Last answer" is ambiguous for participants who never made the final submission. | Export the last save of every participant who has one, with a `finished` column (true when STUDY-005's final submission happened). |
| C10 | Pseudonyms must not change between exports. | `P` + the participant's position by account creation order among participants with a save (`P001`…). The pseudonym-to-account mapping is shown only on the admin page, never in the ZIP. |

## Proposed export (`GET /api/admin/submissions.zip`, admin only)

```
submissions-<date>.zip
├── index.csv            participant, task_key, task_revision, saved_at, time_spent_s, saves, finished, auto_check
└── P007/<task_key>/
    ├── diagram.txt      plain-text diagram derived from the saved diagram
    ├── diagram.json     the saved diagram (formatVersion 1), loadable in the editor
    ├── reference.txt    the reference diagram of that revision, same format
    ├── query.sparql     the SPARQL generated from the answer (absent without variables)
    └── values.csv       the values per variable (absent without variables)
```

`diagram.txt` format (example):

```
Diagram of P007, task campeao-2023, revision 2 (derived from diagram.json)

Nodes
[1] Palmeiras — entity <http://easyquery.example.org/br2023#Palmeiras>
[2] ?equipe — variable
[3] ?pontos — value variable, filter: at least 70
[4] Brasileirão 2023 — entity <http://easyquery.example.org/br2023#Brasileirao2023>

Relations
[2] --venceu--> [4]
[2] --pontos--> [3]
```

`auto_check` is `match`, `no_match` or `not_checked`, a hint for the
researcher and not a grade.

## Acceptance criteria

- [x] The user answers points 1–5 (above).
- [ ] The user accepts or changes C1–C5 and C8–C10.
- [ ] The decision is recorded in Open Decisions and Current Contracts (Study row).
- [ ] STUDY-016, STUDY-017 and STUDY-018 match the accepted options before leaving BACKLOG.

## Implementation cards

STUDY-016 (save without feedback, variable-free answers) → STUDY-017
(task revisions and admin review page) → STUDY-018 (ZIP export with plain-text diagrams).

## Execution log

- 2026-11-02: Created from the user's decision with their advisor. Conflicts
  C1–C10 found in the code and reported. Waiting for the user's confirmation.
- 2026-11-02: The user replaced Mermaid with plain text ("utilize plain text,
  como foi inicialmente proposto"). C4/C5 rewritten for plain text; C6 (mermaid
  devDependency) and C7 (`.mmd` name) removed.
