---
id: DOC-010
title: Collect the dissertation's study questions and propose new ones for preview and filters
status: REVIEW
priority: P1
type: documentation
depends_on: []
human_gate: true
created: 2026-10-28
updated: 2026-10-28
---
# Collect the dissertation's study questions and propose new ones for preview and filters

## Objective

User request (2026-10-28, in Portuguese): using the Physics of Notations
paper and the dissertation, propose new study questions, mainly about the
preview and filter features, with the same methodology as the
dissertation, and write one note with every question used in the
dissertation's tests plus the proposed ones. Skill: `tcc-plan-task`
(documentation only).

## Scope and acceptance

- One note in Portuguese: [[../../01 - Project/Questões do Estudo de Avaliação]].
- It lists the dissertation's 13 competency questions (§4.2) with their
  answers on the dataset, and its 15 questionnaire items (§4.5) with
  polarity, score group and Physics of Notations principle.
- It maps the preview and filter features to Moody's principles and
  proposes competency questions and questionnaire items for them, scored
  like the dissertation's notation block.
- Every answer is checked with Jena on the TTL. No product behavior change.

## Validation

`node scripts/check-project-docs.mjs` and `git diff --check`
(documentation gate of the Operational Map).

## Conclusion

REVIEW (2026-10-28, human gate: the study design is the user's decision).

- Note written, linked from `00 - Home`.
- The dissertation's tasks used `CampeonatoBrasileiro2023`. The current test
  uses PokemonGen1 and the video uses the Brasileirão (DOC-009). The new
  questions (8 filter, 4 preview) are therefore on PokemonGen1, and a
  Brasileirão bank (9 + 4) is kept as an appendix for practice tasks. None
  repeats the video questions (P1–P12), the Help/tour example or the
  STUDY-012 queries.
- Questionnaire proposal: items 1–15 unchanged, so scores stay comparable
  with 57/70 and 15.9/20. New blocks "Filtros" (16–20) and
  "Pré-visualização" (21–25), 0–20 each, acceptable above 10 (the
  dissertation's notation criterion), one negative item per block, and a
  context item 26 (features used).
- Found while checking: the video's P1 is the dissertation's C4 (relegated
  teams). This only matters if the original bank is reused for testing.
  Item 13 is assigned to semiotic clarity in the dissertation, but by
  Moody's definition it measures graphic economy.
- Answers were computed on 2026-10-28 with Jena 6.2 from the project's
  runtime classpath. The SPARQL is in the note's §9.

## Open for the user

- Approve or change the bank, the stratified draw (§5.3) and the new items.
- Implementing it (tasks for the PokemonGen1 group, `usability.v3.json`,
  CSV scores) needs a separate task.
