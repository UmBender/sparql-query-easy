---
id: STUDY-012
title: Build two feature-rich proposed queries in the editor end to end and show what the database stored and returned
status: DONE
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

- [x] Both tasks created by drawing in the admin UI; `expected_result` equals
      `{Tentacruel, Seaking}` (Q1). Q2 stores `[Arcanine, Moltres]`, not
      `[Arcanine, Moltres, Moltres]`: drawn answers run as `SELECT DISTINCT`
      (finding, DEC-019).
- [x] Q1 funnel ends at 2. The actual steps differ from the estimate above:
      52 with these relations → 13 Water → 13 level-up → 13 Pokémon →
      7 level 25–35 → 2 contains "fish" → 2 speed ≥ 60.
- [x] Participant attempts are stored with the fields above. Wrong attempts
      are `correct = false` with counts in `feedback`, right ones
      `correct = true`. Responses carry only the verdict and counts.
- [ ] Q2 shows multiset duplicate preservation: not possible today
      (DEC-019). The Q2 wrong attempt is MIN instead of MAX.
- [x] `report.md` produced and readable; path and manual SQL below.
- [x] Spec runs offline in `test:stack` (no external traffic).

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

Spec `frontend/tests-stack/study-query-creation.e2e.ts`, one test of about 1 min:

- **Admin, Q1, in `/admin/tasks/new`:**
  - Drawing: search (Tentacruel, Water, Level up), Explore relationships
    (evolves from, rdf:type), Convert to variable on both Pokémon, and Add
    value filter with Between 25..35, At least 60 and Contains "fish".
  - Checks: View SPARQL; the order chips; Run Query with candidates Seaking
    and Tentacruel; hover preview (Tentacool); Assume, then Undo, Redo, Undo
    back to the same graph; the filter funnel, with "fish" unticked
    (4 results) and ticked again (2).
  - Export Query, New Query, then Upload Query gives back the same graph.
  - Answer variable, `set`, Preview expected result, Save.
- **Admin, Q2:**
  - Drawing: search (Arcanine, Fire, Rock). Search also adds Fire↔Rock
    type-chart edges and a primary-type edge; these are removed, and "has
    type" is drawn with Connect with defined predicate.
  - Explore relationships HP, Convert to variable, Edit value MAX, and the
    weak-to edge converted to a predicate variable. Saved as `multiset`.
- **Admin, groups page:** a new group with both tasks and the participant.
- **Participant:** for Q1, a wrong attempt without "fish", then the
  correct one. For Q2, a wrong attempt with MIN, then the correct one with
  MAX. All four are drawn the same way.
- **Database:** read with `docker exec <stack postgres> psql`. The
  container is found through the port in `build/stack-postgres.ready`, so
  no new dependency. Checked: `study_task` (graph, request, SPARQL,
  expected result, comparison), `study_task_open` (both tasks) and
  `study_submission` (4 rows: revision, answer variable, verdict, feedback
  equal to the UI line, `time_spent_ms > 0`, SPARQL).
- **Report:** `frontend/test-results/study-query-creation/report.md`
  (ignored), also attached to the Playwright HTML report
  (`frontend/playwright-report/stack`). Attempts in one run:

  | Attempt | Returned | Verdict |
  |---|---|---|
  | Q1 without "fish" | Poliwhirl, Seadra, Seaking, Tentacruel | Incorrect: 2 of 2 expected results; 2 extra. |
  | Q1 complete | Seaking, Tentacruel | Correct: all 2 expected results. |
  | Q2 with MIN | Vulpix | Incorrect: 0 of 2 expected results; 1 extra. |
  | Q2 complete | Arcanine, Moltres | Correct: all 2 expected results. |

Findings (cards, not fixed here):

- **BUG-009:** nodes added by search or Explore relationships all land at
  (200, 200), on top of the first node, even with Auto Layout on. The spec
  drags them aside.
- **BUG-010:** MAX/MIN applied with an empty value field reopens in text
  mode, so it cannot be switched back. The spec keeps the seeded value.
- **DEC-019:** `multiset` cannot see duplicates, because drawn answers are
  `SELECT DISTINCT`.
- **Minor:** the funnel names rdf:type by its IRI, because the dataset has
  no label for it.
- **Minor:** the filter editor resets the chosen type once the value
  profile loads. The spec retries the choice; a fast user could see it jump.

How to look yourself (Compose dev database, OPS-007: `docker compose -f
compose.yaml -f compose.dev.yaml up db`, `./gradlew run`; draw and submit in
the browser), then:

```sql
-- docker compose exec db psql -U easyquery easyquery   (user/db from .env)
select task_key, comparison, revision, jsonb_pretty(expected_result), reference_sparql
  from study_task order by id desc limit 2;
select u.username, t.task_key, o.* from study_task_open o
  join study_task t on t.id = o.task_id join app_user u on u.id = o.user_id;
select s.id, u.username, t.task_key, s.answer_variable, s.correct, s.invalid, s.feedback,
       s.time_spent_ms, jsonb_pretty(s.result_summary), s.sparql
  from study_submission s join study_task t on t.id = s.task_id
  join app_user u on u.id = s.user_id order by s.id;
```

Validation: `npm --prefix frontend run check` (0 errors), prettier and eslint
on the spec, focused spec passing on a reused stack, and the closing gate
`npm --prefix frontend run test:stack`: 21 passed (3.1 min, fresh stack). Test-only:
there is no product change, so the Kotlin gate is not needed.

Human review (2026-10-21): the user read the report and the stored rows
and accepted them ("It looks fine"). Implementation commit `c7fbefe`.
