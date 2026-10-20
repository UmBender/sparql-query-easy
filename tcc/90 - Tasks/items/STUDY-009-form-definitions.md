---
id: STUDY-009
title: Store the two questionnaire definitions and render them with the same validation on both sides
status: DONE
priority: P1
type: fullstack
depends_on: [DEC-015]
human_gate: false
created: 2026-10-20
updated: 2026-10-20
---
# Store the two questionnaire definitions and render them with the same validation on both sides

## Objective

T9 slice 2 of 4 (STUDY-002 scope). Each form is a versioned JSON definition;
the server serves it and validates answers against it; the frontend renders
it and builds its Zod schema from the same definition, so a valid/invalid
answer is judged the same on both sides. Nothing is submitted yet
(STUDY-010). Skill: `tcc-fullstack`.

DEC-015 (2026-10-20) Q2 A: versioned files upserted into a `form` table;
a stored version with responses never changes.

## Scope

- Definition schema (application-owned, documented in API v1):
  `{slug, version, title, pages: [{id, title, questions: [...]}]}`; question
  `{id, type, text, required, ...}` with types and rules:
  - `single_choice`: `options[{value,label}]`; answer one value.
  - `multiple_choice`: `options`, optional `minSelected`/`maxSelected`; answer
    distinct values.
  - `likert`: `scale {min, max, minLabel, maxLabel}`; answer an integer in range.
  - `short_text`: `maxLength` (≤ 200); `long_text`: `maxLength` (≤ 2000);
    trimmed; empty counts as unanswered.
  - `number`: `min`, `max`, `integer`; answer a number in range.
  Unknown question ids and wrong answer types are rejected.
- Kotlin: definition parser that rejects malformed definitions (duplicate ids,
  empty options, min > max) and a pure answer validator returning
  per-question errors. Migration (next free number): `form` (id, slug,
  version, definition jsonb, created_at, unique (slug, version)). Startup
  upsert of `src/main/resources/study/forms/*.json` (Q2 A).
- Route: `GET /api/study/forms/{slug}` (session required; current version;
  404 unknown slug; 403 `consent_required` via STUDY-008 once it exists).
- Frontend: `features/forms/`: `buildFormSchema(definition)` → Zod, one
  component per question type, a paged form renderer with Superforms
  (per-page validation, Next/Back). OpenAPI snapshot and generated types.
- Shared parity fixtures: one JSON file of (definition, answers, expected
  errors) cases that both the Kotlin validator test and the Vitest schema test
  read, so the rules cannot drift.
- Two placeholder definitions (below), `profile.v1.json` and
  `usability.v1.json`.

Excluded: storing responses (STUDY-010); admin editing of forms (DEC-015 Q2
B); real question content.

## Placeholder questions (PLACEHOLDER — replace before participants)

Every title starts with `PLACEHOLDER` in the definition files. No question
asks for name, e-mail, document number or contact.

`profile` v1, one page:

| id | type | text | rule |
|---|---|---|---|
| sparql_familiarity | single_choice | PLACEHOLDER How familiar are you with SPARQL? | never heard / heard of it / used a few times / use regularly; required |
| query_languages | multiple_choice | PLACEHOLDER Which of these have you used? | SQL, SPARQL, Cypher, a visual query tool, none; required, ≥ 1 |
| programming_years | number | PLACEHOLDER How many years have you programmed? | integer 0–60; required |
| data_comfort | likert | PLACEHOLDER I am comfortable exploring data in tables. | 1–5, disagree–agree; required |
| role | single_choice | PLACEHOLDER What best describes you? | undergraduate, graduate, professional, other; optional |

`usability` v1, two pages (exercises per-page progress):

| page | id | type | text | rule |
|---|---|---|---|---|
| 1 | easy_to_use | likert | PLACEHOLDER The graph editor was easy to use. | 1–5; required |
| 1 | faster_than_sparql | likert | PLACEHOLDER Drawing a query was faster than writing SPARQL. | 1–5; required |
| 1 | confident | likert | PLACEHOLDER I was confident my answers were correct. | 1–5; required |
| 1 | most_useful | single_choice | PLACEHOLDER Which feature helped you most? | filter funnel, run query stages, filter histogram, search nodes; required |
| 2 | hardest_part | short_text | PLACEHOLDER In one sentence, what was hardest? (do not write your name or contact) | ≤ 200; optional |
| 2 | comments | long_text | PLACEHOLDER Any other comments? (do not write your name or contact) | ≤ 2000; optional |

## Acceptance criteria

- [x] Kotlin and Vitest both pass the shared parity fixtures: for each type a
      valid answer, a missing required answer, an out-of-range or unknown
      option, a wrong type, and an unknown question id.
- [x] Malformed definitions are rejected at startup with a clear message.
- [x] Component test per question type (renders, accepts a valid answer,
      shows the error for an invalid one); paged renderer blocks Next on an
      invalid page.
- [x] `GET /api/study/forms/profile` returns the stored definition; unknown
      slug 404; anonymous 401.
- [x] axe check on a rendered form page: in the STUDY-010 stack e2e, where a
      form is first reachable on a page (see conclusion).

## Validation

Focused: the new Kotlin validator test and
`npm --prefix frontend exec vitest run src/lib/features/forms` (proposed
paths), then the HTTP/fullstack closing gate of the Operational Map.

## Conclusion (2026-10-20)

- Definition and rules: `application/study/Questionnaires.kt`
  (`FormDefinition`, strict `FormDefinitions.parse` + `problems`,
  `FormAnswerValidator`) and `frontend/src/lib/domain/forms.ts`
  (`validateAnswers`, `checkAnswer`, `formSchema`, `emptyAnswers`) with the
  same rules and messages; shared cases in
  `frontend/src/lib/domain/fixtures/forms/parity.json` (7 cases: valid with
  normalization, missing, out of range/unknown option, too many/fraction/too
  long, repeated, wrong types, unknown question id) run by
  `FormAnswerValidatorTest` and `forms.spec.ts`.
- Implementation choices: the Likert scale always starts at 1
  (`scaleMax` 2–10, default 5), matching the existing `rating-scale`
  component, instead of a `min` field; the stored row is `study_form`
  (study tables share the prefix); a version is stored on first use rather
  than at startup, so a database that is down at startup does not block
  (definitions are still checked at startup); a changed file updates the
  stored copy (STUDY-010 adds the refusal once responses exist).
- Placeholders `study/forms/profile.v1.json` and `usability.v1.json` as in
  the tables above (every title and question text starts with `PLACEHOLDER`).
- `GET /api/study/forms/{slug}` (`http/StudyFormRoutes.kt`, consent-gated).
  Frontend `features/forms/`: `questionnaire-form.svelte` (Superforms SPA,
  JSON data, per-page `validateForm` with the page schema, server errors
  per question via `setError`, `onprogress`), `question-field.svelte`, one
  component per type under `questions/`, `question-frame.svelte`; client
  `api.study.form`, query key `studyForm`, compile-time check
  `servedFormIsDomainForm` between the generated type and the domain type.
- The axe check moved to STUDY-010's stack e2e: no page shows a form before
  STUDY-010 wires the flow, and `axe-core` is only a transitive dependency of
  `@axe-core/playwright`, so the component tests do not import it.
- Tests: `FormAnswerValidatorTest` (7), `FormDefinitionsTest` (5),
  `StudyFormRoutesTest` (3), `forms.spec.ts` (16),
  `questionnaire-form.svelte.spec.ts` (9: each type, paging, progress,
  server errors, saved answers, failure).
- Validation: Kotlin gate `ktlintCheck detekt test` green (274 tests);
  frontend check, lint and `npm test` green (194 unit, 22 component, 84
  e2e); `test:stack` 17/18 then the admin test fixed and run twice green.
  `tests-stack/study.e2e.ts` now waits for the upload toast to close before
  clicking Preview: the toast covered the button and hovering it kept it
  open (pre-existing flake that failed two of three full runs). Long lines
  in `StudyRoutes.kt`/`StudyConsentRoutes.kt` from STUDY-008 wrapped for
  detekt.
- Completion commit for this task.
