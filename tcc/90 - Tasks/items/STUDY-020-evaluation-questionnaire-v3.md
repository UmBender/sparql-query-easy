---
id: STUDY-020
title: Replace the dissertation questionnaire with the complete SUS plus the five notation items
status: IN_PROGRESS
priority: P1
type: fullstack
depends_on: [STUDY-015]
human_gate: true
created: 2026-11-12
updated: 2026-11-13
---
# Replace the dissertation questionnaire with the complete SUS plus the five notation items

## Objective

Build the evaluation questionnaire decided in
[[../../01 - Project/Questionário de Avaliação e Seleção de Questões]] §4:
profile block A1–A3, the **complete SUS** S1–S10 and the five notation items
N1–N5 of `Questionario.docx` (clareza semiótica, discernimento perceptivo,
transparência semântica, expressividade visual, economia gráfica; the nine
principles of Moody not marked "Suportado" in `Infografico.png` stay out).
Skill: `tcc-fullstack`. Follows the STUDY-015 pattern (new form versions; v1
and v2 responses stay readable and exportable).

## Scope

- `profile.v3.json`: A1 (SPARQL/RDF knowledge, as dissertation item 1) before
  the tasks.
- `usability.v3.json`, after the final submission: A2 (tasks done, 0–5) and
  A3 (usefulness of the video), then S1–S10 (page "Uso da ferramenta"), then
  N1–N5 (page "Notação gráfica"). Texts verbatim from the note; the
  (+)/(–) markers stay out of the screen. Likert 1–5 with the
  `Questionario.docx` labels (1 Discordo totalmente … 5 Concordo totalmente)
  for S and N items; every question required. Ids proposal: `a1_…`, `a2_…`,
  `a3_…`, `s01_…`–`s10_…`, `n1_…`–`n5_…`; they must not satisfy
  `DissertationScores.appliesTo` (STUDY-021 adds the new scoring).
- `study/study.json`: list the two new files; flow unchanged.
- No form-engine change expected: `likert` and `number` already cover every
  question (confirm by inspection first).

Excluded: scores in the CSV (STUDY-021); the preview/filter/codificação-dupla
items of the older plan; removing v1/v2.

## Acceptance criteria

- [ ] The participant answers A1 before the tasks and A2–A3, S1–S10, N1–N5
      after the final submission, in that order, all required.
- [ ] v1/v2 responses still open in the admin export; the CSV has the new
      columns after the older ones (STUDY-011 union rule).
- [ ] The texts equal the note's §4 (S items) and `Questionario.docx` (N
      items) exactly.

## Validation

Focused: `FormDefinitionsTest`, `FormAnswerValidatorTest`, the shared
`domain/fixtures/forms/parity.json` and `forms.spec.ts`,
`tests-stack/study-questionnaires.e2e.ts` and `tests-stack/support.ts`
`PROFILE_ANSWERS`. Closing: Kotlin gate, frontend gate, `test:stack`,
`test:screens` if the questionnaire screens are captured. Human gate: the
user reads the rendered questionnaire once.

## Conclusion

Implemented (batch): `profile.v3.json` (A1) and `usability.v3.json` (A2, A3,
S1–S10 on "Uso da ferramenta"; N1–N5 on "Notação gráfica"), listed in
`study.json`; ids `a1_…`, `a2_…`, `a3_…`, `s01_…`–`s10_…`, `n1_…`–`n5_…`
(none feeds `DissertationScores.appliesTo` on its own; the usability export
still adds the empty v2 score columns because the union includes v2 ids).
The form engine needed no change. Only end labels exist in the engine, so
the Likert items show "Discordo totalmente"/"Concordo totalmente" at 1 and 5.
Tests moved to v3: `FormDefinitionsTest`, `StudyFormResponseRoutesTest`,
`StudyTestSupport`, `AdminFormExportRoutesTest`, `forms.spec.ts`,
`tests-stack/*` (`support.ts`, questionnaires, participant), `tests/study.e2e.ts`,
`tests/xss.e2e.ts`, `scripts/check-backup-restore.mjs`.

Validation: `npm --prefix frontend test` server project 267 passed (includes
`forms.spec.ts`); its browser project cannot start (Playwright Firefox
missing in this environment).

BLOCKED (batch): `./gradlew` was refused in the unattended session, so
`FormDefinitionsTest`, `StudyFormResponseRoutesTest`,
`AdminFormExportRoutesTest` and the Kotlin closing gate were NOT run, nor
`test:stack`/`test:screens`. Run:
`GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon`,
then `npm --prefix frontend run test:stack` (and `test:screens` if the
questionnaire pages are captured), then read the rendered questionnaire.
