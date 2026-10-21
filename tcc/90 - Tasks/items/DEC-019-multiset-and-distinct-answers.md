---
id: DEC-019
title: Decide what multiset comparison means when drawn answers run as SELECT DISTINCT
status: BACKLOG
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

Pending (human). STUDY-012's spec asserts the current behaviour, which is
`[Arcanine, Moltres]` stored for the multiset task. Update that assertion
when this is decided.
