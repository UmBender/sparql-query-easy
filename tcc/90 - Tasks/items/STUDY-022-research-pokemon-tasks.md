---
id: STUDY-022
title: Load the five PokemonGen1 research tasks R1-R5 as proposed tasks for the test group
status: BACKLOG
priority: P1
type: fullstack
depends_on: [STUDY-016, STUDY-013]
human_gate: true
created: 2026-11-12
updated: 2026-11-12
---
# Load the five PokemonGen1 research tasks R1-R5 as proposed tasks for the test group

## Objective

Give every research participant the five tasks selected in
[[../../01 - Project/Questionário de Avaliação e Seleção de Questões]] §3
(two easy, two medium, one hard), in this order, on `PokemonGen1`:

| Key | Difficulty | Statement (Portuguese; source banco §5.4) |
|---|---|---|
| R1 | easy | NF5: categoria contendo "Bird" → 6 Pokémon |
| R2 | easy | NF1: tipo Elétrico, velocidade ≥ 100 → 6 |
| R3 | medium | NF7: tipo Água, defesa e velocidade ≥ 80 → 3 |
| R4 | medium | NP1: evoluções do Eevee e o item de cada → 3 |
| R5 | hard | NP4: pré-evoluções dos Venenosos de maior ataque → 2 (Muk ← Grimer, Victreebel ← Weepinbell) |

Skill: `tcc-fullstack` (`tcc-test` for the gate). Same mechanism as STUDY-013
(admin API, seeder, group); the answer form follows DEC-020 / STUDY-016: the
participant saves a diagram, sees no correctness, needs no variables.

## Scope

- Task data `frontend/scripts/demo-study/` (or a sibling file for the
  research set; decide by inspecting how STUDY-013 laid it out): `key`,
  `title`, Portuguese `statement` taken from
  `Questões do Estudo de Avaliação` §5.4 (no variables mentioned, asks for
  everything the diagram must show), endpoint `PokemonGen1`, `reference` =
  saved graph (form A of §5.5 for R1–R5) plus derived `query`, expected
  count. The common instruction of §5.1 is shown before the statement.
- Vitest spec: each `reference.graph` passes the saved-format schema and its
  `query` equals what `domain/study.ts` derives.
- Idempotent seeding into a group "Pesquisa PokemonGen1" with the five tasks
  in order (extend or reuse `seed-demo-study.mjs`; the Brasileirão demo group
  stays as it is). Fails loudly if a stored expected count differs.
- Real-stack spec beside `tests-stack/demo-study.e2e.ts`: seed, log in as a
  participant of the group, see the five tasks in order, save one answer.
- Runbook line in [[../../07 - Operations/Docker Compose Stack]].

Excluded: random drawing (every participant gets all five); the video
questions V1–V5 (the video shows them; the Brasileirão practice tasks of
STUDY-013 already cover P2, P3, P4, P8 and P9); grading UI (STUDY-017/018).

## Pending decisions

None blocking. Check with the user whether R-statements should keep the
English app labels in parentheses (as §5.4 does, e.g. *Speed*).

## Acceptance criteria

- [ ] A participant in the group sees R1–R5 in order on `/study` and can save
      a diagram for each, with no correctness shown.
- [ ] Each stored expected result equals the answer in the table above and in
      the note (Mewtwo-style trap: R5 without the Poison type is partial, see
      rubric §5.3).
- [ ] The Brasileirão demo group and its tasks are unchanged.
- [ ] Nothing in the normal gates calls an external service.

## Validation

Focused: the new Vitest spec and the stack spec. Closing: frontend gate +
`test:stack`; the Kotlin gate only if backend code changes. Human gate: the
user solves R1–R5 once as a participant.
