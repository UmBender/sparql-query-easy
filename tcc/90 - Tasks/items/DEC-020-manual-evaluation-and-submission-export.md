---
id: DEC-020
title: Decide how saved answers are evaluated by hand and exported with a Mermaid diagram
status: REVIEW
priority: P1
type: decision
depends_on: [DEC-014]
human_gate: true
created: 2026-11-02
updated: 2026-11-02
---
# Decide how saved answers are evaluated by hand and exported with a Mermaid diagram

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
5. The text diagram in the export uses Mermaid syntax, so it is readable and
   usable with AI. Conflicts are reported (below).

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
| C4 | Mermaid is a view, not a saved format: positions, `order`, `limit` and the endpoint are lost, the layout differs from the editor, and the editor cannot load Mermaid. | `diagram.json` stays the source of truth (opens with *Load*). The Mermaid file is derived from it and says so in a `%%` comment. |
| C5 | Mermaid syntax breaks on labels with `"`, `#`, `;`, `|`, `<>`, on ids like `end`, and on ids starting with `o`/`x` right after `---`. IRIs cannot be ids. Two entities with the same label ("São Paulo" the team and the city) look identical. | Generated ids `n1`, `n2`…, every label quoted and entity-escaped (`#quot;`, `#35;`…), edge labels as `-->|"label"|`, and a `%% n3 = <iri>` line for each entity node. Filters and value variables keep their editor label (`? ≥ 90`), and a predicate variable is shown by its name. |
| C6 | "More guaranteed" needs a check with the real Mermaid parser. `mermaid` is not a project dependency, it is heavy and its parser needs a DOM. The export is built on the server (Kotlin), where it cannot run. | Generate on the server (`java.util.zip`, no new dependency) and keep golden `.mmd` fixtures from the Kotlin tests. A frontend Vitest browser test parses them with `mermaid.parse`, which adds `mermaid` as a **devDependency only** (needs your approval). Without it, the oracle is golden text only. |
| C7 | The name `diagram.txt` hides the format from tools that recognise Mermaid. | Name it `diagram.mmd` (plain text; the first line is `flowchart LR`). |
| C8 | `solved`/`attempted` markers and the per-attempt history give correctness away or stop making sense. | The participant's button becomes "Save answer". `/study` shows `not_started`/`answered` and the time of the last save. Earlier saves stay in the database but are not shown or exported. |
| C9 | "Last answer" is ambiguous for participants who never made the final submission. | Export the last save of every participant who has one, with a `finished` column (true when STUDY-005's final submission happened). |
| C10 | Pseudonyms must not change between exports. | `P` + the participant's position by account creation order among participants with a save (`P001`…). The pseudonym-to-account mapping is shown only on the admin page, never in the ZIP. |

## Proposed export (`GET /api/admin/submissions.zip`, admin only)

```
submissions-<date>.zip
├── index.csv            participant, task_key, task_revision, saved_at, time_spent_s, saves, finished, auto_check
└── P007/<task_key>/
    ├── diagram.mmd      Mermaid flowchart derived from the saved diagram
    ├── diagram.json     the saved diagram (formatVersion 1), loadable in the editor
    ├── reference.mmd    the reference diagram of that revision
    ├── query.sparql     the SPARQL generated from the answer (absent without variables)
    └── values.csv       the values per variable (absent without variables)
```

`auto_check` is `match`, `no_match` or `not_checked`, a hint for the
researcher and not a grade.

## Acceptance criteria

- [x] The user answers points 1–5 (above).
- [ ] The user accepts or changes C1–C10, including the `mermaid` devDependency (C6).
- [ ] The decision is recorded in Open Decisions and Current Contracts (Study row).
- [ ] STUDY-016, STUDY-017 and STUDY-018 match the accepted options before leaving BACKLOG.

## Implementation cards

STUDY-016 (save without feedback, variable-free answers) → STUDY-017
(task revisions and admin review page) → STUDY-018 (ZIP export with Mermaid).

## Execution log

- 2026-11-02: Created from the user's decision with their advisor. Conflicts
  C1–C10 found in the code and reported. Waiting for the user's confirmation.
