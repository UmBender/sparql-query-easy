---
id: DOC-009
title: Write the base note for the presentation video on the Brasileirão 2023 dataset
status: REVIEW
priority: P1
type: documentation
depends_on: []
human_gate: true
created: 2026-10-27
updated: 2026-10-27
---
# Write the base note for the presentation video on the Brasileirão 2023 dataset

## Objective

User request (2026-10-27, in Portuguese): the presentation video of the
tool must be redone on `CampeonatoBrasileiro2023`
(`src/main/resources/futebol_completo.ttl`), so that the video does not
bias the user test, which uses PokemonGen1. The user will paste one note
into Claude in the browser to write the video script. The note must say what
the tool is, list every feature to show, explain login and how answers
are submitted, and give example questions with the expected SPARQL and
answers. Skill: `tcc-plan-task` (documentation only).

## Scope and acceptance

- One self-contained note in Portuguese:
  [[../../01 - Project/Base do Vídeo de Apresentação]].
- It covers the tool and its purpose in the TCC user study, the dataset,
  every feature the user sees (checked against `/help`, the toolbar, the action
  list, the filter editor, the tour, the legend and the study pages), with the
  FE-057/FE-059 names, and the study flow from login to the final
  questionnaire, with the admin side.
- Example questions from easy to hard, each mapped to features, with build
  steps that use only actions the editor has, the expected SPARQL and the
  answer.
- Answers come from the running backend (`POST /api/query`, the same
  service the study uses to check answers) and from an independent Jena
  query on the TTL. No live external service is called.
- A suggested scene order for the video.
- No product behavior change.

## Validation

`node scripts/check-project-docs.mjs` and `git diff --check`
(documentation gate of the Operational Map).

## Conclusion

- Note written: `tcc/01 - Project/Base do Vídeo de Apresentação.md`.
- How the answers were checked (2026-10-27):
  - `./gradlew run -port=8093` without a database. Search,
    relationships, relationship-value, query, SPARQL display and
    local-database were called on `CampeonatoBrasileiro2023` and on the
    sample TTL from the note.
  - The same questions were written as plain SPARQL and run with Jena
    (project runtime classpath) on `futebol_completo.ttl`. Every count
    matched.
- Things found while checking, listed in the note's "Cuidados" section:
  - Search on the built-in dataset keeps 20 matches in no fixed order.
    Searching a team's name (e.g. "Santos", "Palmeiras") usually lists only
    goals and matches. Most team entities are reached through "Classificação
    do <time>" or a match.
  - View SPARQL ignores the filter type of a literal value (the C# behavior
    of `/api/query/sparql`). A MAX/MIN value shows as an exact match there,
    although Run Query and the answer check use MAX/MIN.
  - MAX/MIN are offered only on a literal value, not on a literal value
    variable. The tour step for Add Value Variable lists MAX and MIN.
  - The editor has no link to `/study`. Participants open the `/study` link
    they are given.
  - Dates (`realizadaNaData`) are plain text, so only the text filters work
    on them.
- Validation: `node scripts/check-project-docs.mjs` and `git diff --check`
  passed. Completion commit for this task.
- REVIEW: the user judges the note while writing the script.
