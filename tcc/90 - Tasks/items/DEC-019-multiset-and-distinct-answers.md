---
id: DEC-019
title: Decide what multiset comparison means when drawn answers run as SELECT DISTINCT
status: DONE
priority: P1
type: decision
depends_on: []
human_gate: true
created: 2026-10-21
updated: 2026-10-21
---
# Decide what multiset comparison means when drawn answers run as SELECT DISTINCT

## Context

DEC-014 Q4 defines a per-task comparison: `set` on the answer variable, or
`multiset` meaning "rows with duplicates". STUDY-012 found that the duplicates
never reach the comparison. The query generated for a drawn answer (reference
or participant) is `SELECT DISTINCT ?x ?xLabel ?xRdfType ?xType`
(`WikidataQueryGenerator`, the query generator for local data too), so it
returns one row per value of the answer variable.

Example (STUDY-012 Q2, PokemonGen1): `?pokemon hasType Fire`, HP = MAX,
`?pokemon ?relation Rock`. Moltres is linked to Rock by both `weakTo` and
`fourTimesWeakTo`, so the rows are Arcanine, Moltres, Moltres. The stored
`expected_result` is `[Arcanine, Moltres]`. A participant answer that
loses the duplicate cannot be told apart, so `multiset` currently behaves
like `set`. Nothing is wrong in the comparison module itself
(`AnswerComparisonTest` covers duplicates).

## Options

- A: Keep DISTINCT and document `multiset` as "the same values, counted after
  DISTINCT", which makes it equivalent to `set` for drawn queries. Consider
  removing the option from the admin form.
- B: Run study answers without DISTINCT (a study-only generator option), so
  `multiset` compares the real row count. This changes reference results and
  the stored `expected_result` of existing multiset tasks (a new revision).
- C: Keep DISTINCT but project the whole row (all variables) for `multiset`.
  Duplicates then come from different bindings of other variables, as
  in the Moltres example.

## Decision

**A, approved by the user on 2026-10-21.** Drawn answers keep
`SELECT DISTINCT`. Because a value never repeats, `multiset` gives the same
verdict as `set`, so it is no longer offered:

- **New tasks** are always `set`; the admin form shows no Comparison choice.
- **A stored multiset task** keeps working, and its edit page still shows
  both choices so an admin can move it to `set`.
- **The API** still accepts `multiset` (compatibility), and the comparison
  module and its tests are unchanged.
- **Options B and C** were not taken. Both would need generator changes,
  because the `rdf:type` and label joins in the generated query would also
  multiply rows.

## Conclusion

- **Admin form:** `features/admin/task-editor.svelte` renders the Comparison
  fieldset only when the loaded task is `multiset`; otherwise `comparison`
  stays `set`.
- **Browser test:** `tests/study.e2e.ts` "DEC-019 only a legacy multiset task
  offers the comparison, to move it to set". The new-task page has no
  Comparison group; a multiset task shows it checked, and saving after
  choosing set sends `comparison: "set"`. It fails on the old form.
- **STUDY-012 spec:** Q2 is now a `set` task, with the statement reworded
  ("the Fire-type Pokémon with the highest HP that are linked to the Rock
  type by any relation"). The spec asserts that new tasks show no
  Comparison group and that both tasks are stored as `set`.
- **Contracts:** API v1 (Proposed tasks, admin), Current Contracts (Study
  row) and Open Decisions (DEC-019 row).
- **Screens:** the `admin-task-new` baselines (light and dark) were
  refreshed. The only difference is the removed Comparison block, checked
  against the expected and actual images.
- **Validation:**
  - `npm run lint`, `npm run check`: pass.
  - `npm test`: Vitest server 248, components 25, e2e 120, all pass.
  - `test:screens`: 22 pass after the refresh; before it, only the two
    expected `admin-task-new` failures.
  - `test:stack`: 21 pass, including STUDY-012 with Q2 as a set task.
