---
id: STUDY-012
title: Build two feature-rich proposed queries in the editor end to end and show what the database stored and returned
status: READY
priority: P1
type: fullstack
depends_on: [STUDY-001]
human_gate: true
created: 2026-10-21
updated: 2026-10-21
---
# Build two feature-rich proposed queries in the editor end to end and show what the database stored and returned

## Objective

The study tasks so far are checked with small graphs (one type pattern, or
Fire/speed ≥ 90) mostly created through the API. This task drives two
target queries through the real UI, using as many editor features as
possible, from the admin drawing the reference to the participant submitting
an answer, and produces a readable report so the user can check that:

1. what the database stores (`study_task`, `study_task_open`,
   `study_submission`) matches what was drawn, and
2. the server's result and verdict are the correct output for the dataset.

Skill: `tcc-fullstack` (test-only; `tcc-test` for gate selection). No
product behavior change is authorized: if a feature below does not work as
described, record it as a finding (new BUG card) rather than changing the
oracle or the product here.

## The two target queries (PokemonGen1)

Expected outputs were computed from `src/main/resources/pokemon_gen1.ttl`
by hand-parsing the triples (2026-10-21); the executing agent must confirm
them against the server's own reference run (`study_task.expected_result`).

### Q1 — "Fast-growing Water fish" (comparison `set`)

Statement: *Find the Water-type Pokémon that evolve by level-up at a level
between 25 and 35, whose pre-evolution has speed of at least 60, and whose
category contains "fish".*

Graph (answer variable `?pokemon`):

| Part | Editor feature |
|---|---|
| `?pokemon rdf:type pk:Pokemon` | class node from search |
| `?pokemon pk:hasType pk:WaterType` | entity node from search, defined predicate |
| `?pokemon pk:evolutionTrigger pk:LevelUp` | entity node, connector with a chosen predicate (FE-007) |
| `?pokemon pk:evolutionLevel ?level`, Between `25..35` | value variable + Between filter (histogram) |
| `?pokemon pk:evolvesFrom ?pre` | second node variable (multi-hop) |
| `?pre pk:speed ?preSpeed`, At least `60` | value variable on the second variable + At least |
| `?pokemon pk:category ?category`, Contains `fish` | text filter with suggestions on a lang-tagged literal |

Expected funnel (each step must narrow): 32 Water → 13 level-up → 7 at
level 25..35 (Golduck, Poliwhirl, Tentacruel, Dewgong, Kingler, Seadra,
Seaking) → 4 with pre-evolution speed ≥ 60 (Poliwhirl, Tentacruel, Seadra,
Seaking) → **2: `pk:Tentacruel`, `pk:Seaking`** (Jellyfish, Goldfish).

### Q2 — "Toughest Fire Pokémon and how Rock hits them" (comparison `multiset`)

Statement: *Among the Fire-type Pokémon with the highest HP, list each one
once per relation that links it to the Rock type.*

Graph (answer variable `?pokemon`):

| Part | Editor feature |
|---|---|
| `?pokemon pk:hasType pk:FireType` | entity node |
| `?pokemon pk:hp ?hp`, MAX | MAX filter that keeps every tie |
| `?pokemon ?relation pk:RockType` | predicate variable edge (FE-003) |

Expected rows (MAX hp among Fire = 90, a tie): Arcanine (`weakTo`) and
Moltres (`weakTo`, `fourTimesWeakTo`) → **multiset `[Arcanine, Moltres,
Moltres]`**. A set answer `{Arcanine, Moltres}` must be judged incorrect
under `multiset`; this is the duplicate-preservation check.

## Scope

- One new real-stack Playwright spec, proposed name
  `frontend/tests-stack/study-query-creation.e2e.ts`, reusing
  `tests-stack/support.ts` (`loginAs`, `joinStudy`, group helpers) and the
  page objects in `tests/support/pages/` (`EditorPage`, `TaskPage`).
- Admin side, through the UI (`/admin`, STUDY-006): draw Q1 and Q2, open the
  exploration (Run Query with a chosen variable order, hover preview, Assume
  one value, untick one funnel step and tick it back), View SPARQL, export
  the graph to a file and reload it, use undo/redo and auto layout once,
  then save both tasks and assign them to a group with one participant.
- Participant side, through the UI: open each task, draw the answer, submit:
  - Q1: first a wrong attempt (without the Contains filter → 4 rows,
    incorrect with counts), then the correct graph.
  - Q2: first the set-like wrong attempt if it can be drawn (e.g. replace
    the predicate variable with `weakTo` → `[Arcanine, Moltres]`, incorrect
    under multiset), then the correct graph.
- Database check: read the stack's PostgreSQL (JDBC URL from
  `build/stack-postgres.ready`, or the existing admin/participant API if a
  direct client is not available to the spec — decide by inspection and say
  why) and assert, per task:
  - `study_task`: `reference_graph` holds the drawn nodes/edges (FE-042
    format, filters present), `reference_sparql` contains the BETWEEN /
    `>=` / CONTAINS / MAX constructs and the predicate variable,
    `expected_result` equals the expected terms above (typed IRIs),
    `comparison` is `set`/`multiset`.
  - `study_task_open`: one first-open row per participant and task.
  - `study_submission`: one row per attempt with `graph`, `request`,
    `sparql`, `answer_variable = ?pokemon`, `result_summary` counts,
    `correct`, `feedback`, `invalid = false`, `task_revision`, and
    `time_spent_ms > 0`.
- Report for the human check: the spec (or a small script it calls) writes
  `frontend/test-results/study-query-creation/report.md` (ignored output,
  not committed) with, per task: the generated SPARQL, expected terms,
  each attempt's returned rows/verdict/feedback, and the stored DB rows
  as pretty JSON. Attach it to the Playwright report as well.
- Short "how to look yourself" section in this card's conclusion: the SQL
  queries the user can run (`./gradlew run` + `compose.dev.yaml` db, `psql`)
  to see the same rows.

Excluded: changing goldens/expected results to make it pass, new product
features, live Wikidata, the questionnaire flow beyond what the study gates
require (consent/questionnaires may be satisfied via existing helpers).

## Genuine open points (resolve by inspection, record the outcome)

- Whether MAX on `?hp` is applied to the Fire set before or after the
  predicate-variable join; the expected rows assume MAX over Fire-type
  Pokémon (both tied ones also link to Rock, so both orders give the same
  answer — note it if the generated SPARQL differs).
- Whether Contains on a `@en` literal matches case-sensitively ("fish" vs
  "Goldfish"/"Jellyfish" both lowercase here, so either works).
- If any feature cannot be reached through the UI page objects, use the
  closest existing helper and list the gap.

## Acceptance criteria

- [ ] Both tasks created by drawing in the admin UI; `expected_result` equals
      `{Tentacruel, Seaking}` (Q1) and `[Arcanine, Moltres, Moltres]` (Q2).
- [ ] Q1 funnel shows 32 → 13 → 7 → 4 → 2 (or the agent documents the
      actual step order the funnel uses with the same final 2).
- [ ] Participant attempts are stored with the fields above; wrong attempts
      are `correct = false` with counts in `feedback`, right ones
      `correct = true`; nothing in the responses exposes expected rows.
- [ ] Q2 shows multiset duplicate preservation (set-like answer incorrect).
- [ ] `report.md` produced and readable; the card lists its path and the
      manual SQL.
- [ ] Spec runs offline in `test:stack` (no external traffic, QUAL-003).

## Validation

Focused: `npm --prefix frontend run test:stack -- study-query-creation`.
Closing gate: `test:stack` full (test-only change; Kotlin gate only if
backend code is touched). Oracle: the dataset-derived answers above,
cross-checked with the server's stored `expected_result`.

## Completion

Finish as REVIEW (human_gate): the user reads `report.md` and the DB rows
and confirms they look right; after that the card moves to DONE. Commit the
spec and this card locally, prefixed `STUDY-012`.

## Conclusion / execution log

(to be filled by the executing agent)
