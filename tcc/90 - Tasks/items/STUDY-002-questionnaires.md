---
id: STUDY-002
title: Show two questionnaires to logged-in users and store their answers
status: DONE
priority: P1
type: fullstack
depends_on: [STUDY-001, STUDY-008, STUDY-009, STUDY-010, STUDY-011]
human_gate: false
created: 2026-10-16
updated: 2026-10-20
---
# Show two questionnaires to logged-in users and store their answers

## Objective

T9. Subjective measures of the evaluation (usability, confidence,
understanding). Skill: `tcc-fullstack`.

## Scope

- Two forms defined in versioned files (question id, text, type: Likert,
  choice, free text, required). Proposed default: one before the first
  proposed query, one after the final submission.
- Superforms + Zod in the frontend; validation repeated in Ktor; answers in
  PostgreSQL (Flyway migration); session required; one submission per form.
- Anonymous users never see them.

Excluded: consent and LGPD (deferred by the user, 2026-10-16).

## Pending input

Question content and the before/after placement are the user's.
Roles `participant`/`admin` arrive earlier with AUTH-005 (DEC-014,
2026-10-19). Decide here who may read or export answers before adding any
answer-export route.

## Acceptance criteria

- [x] Each form submits once; invalid answers are rejected client- and server-side.
- [x] Anonymous access returns 401; e2e covers both forms.

## Proposed changes (T9 brief, 2026-10-20; accepted by DEC-015)

DEC-015 (2026-10-20, A for Q1–Q6) accepted these changes; where the text
above differs (consent excluded, LGPD deferred), DEC-015 wins: consent gates
the forms and the proposed tasks, the profile form comes before the tasks
and the usability form after the final submission. This card is not rewritten.

- Split: delivered by STUDY-008 (consent), STUDY-009 (form definitions and
  shared validation), STUDY-010 (submit once, per-page progress, placement)
  and STUDY-011 (admin CSV export and the T9 e2e). `depends_on`
  has those four; this card closes when they are DONE.
- Export access (this card's pending input): admins only, through AUTH-005's
  `withAdmin` guard (brief).
- Added acceptance criteria from the brief:
  - [x] Question types single choice, multiple choice, Likert, short text,
        long text and number, rendered from JSON definitions.
  - [x] Zod schema built from the definition; the server applies the same
        rules (shared parity fixtures).
  - [x] Consent stored (user, consent version, accepted_at) before any
        response is stored (DEC-015 Q1).
  - [x] Each response keeps its form version and `submitted_at`.
  - [x] Admin-only CSV export of responses.
  - [x] Progress kept per page for a multi-page form (DEC-015 Q4).
  - [x] Only what the forms ask is stored; no question asks for identifying
        data without the user's approval.
  - [x] Tests: schema validation, one component test per question type, e2e:
        consent, both forms, an invalid answer rejected, responses found in
        the export.
- The questions ship as `PLACEHOLDER` content (STUDY-009) until the user
  supplies them.

## Conclusion (2026-10-20)

T9 is delivered by its four slices, all DONE: STUDY-008 (consent),
STUDY-009 (definitions and shared validation), STUDY-010 (one response per
form, placement, per-page progress) and STUDY-011 (admin CSV export and the
whole-flow e2e `tests-stack/study-questionnaires.e2e.ts`). Contracts:
[[../../03 - Backend/API v1#Research consent (participant, STUDY-008)]],
[[../../03 - Backend/API v1#Questionnaires (participant, STUDY-009)]],
[[../../03 - Backend/API v1#Questionnaire responses (participant, STUDY-010)]],
[[../../03 - Backend/API v1#Questionnaire export (admin, STUDY-011)]].

Pending input that stays the user's: the question texts ship as
`PLACEHOLDER` and must be replaced (a new version file per questionnaire)
before real participants; the shipped placeholders ask for no identifying
data.
