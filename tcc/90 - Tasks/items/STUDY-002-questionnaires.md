---
id: STUDY-002
title: Show two questionnaires to logged-in users and store their answers
status: BACKLOG
priority: P1
type: fullstack
depends_on: [STUDY-001]
human_gate: false
created: 2026-10-16
updated: 2026-10-16
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

- [ ] Each form submits once; invalid answers are rejected client- and server-side.
- [ ] Anonymous access returns 401; e2e covers both forms.

## Proposed changes (T9 brief, 2026-10-20; pending DEC-015)

Not accepted yet. DEC-015 records the points where the brief differs from
this card (consent excluded here, forms in files, open placement and export
access); where DEC-015 is decided, it wins. This card is not rewritten.

- Split: delivered by STUDY-008 (consent), STUDY-009 (form definitions and
  shared validation), STUDY-010 (submit once, per-page progress, placement)
  and STUDY-011 (admin CSV export and the T9 e2e). On approval,
  `depends_on` gains those four and this card closes when they are DONE.
- Export access (this card's pending input): admins only, through AUTH-005's
  `withAdmin` guard (brief).
- Added acceptance criteria from the brief:
  - [ ] Question types single choice, multiple choice, Likert, short text,
        long text and number, rendered from JSON definitions.
  - [ ] Zod schema built from the definition; the server applies the same
        rules (shared parity fixtures).
  - [ ] Consent stored (user, consent version, accepted_at) before any
        response is stored (DEC-015 Q1).
  - [ ] Each response keeps its form version and `submitted_at`.
  - [ ] Admin-only CSV export of responses.
  - [ ] Progress kept per page for a multi-page form (DEC-015 Q4).
  - [ ] Only what the forms ask is stored; no question asks for identifying
        data without the user's approval.
  - [ ] Tests: schema validation, one component test per question type, e2e:
        consent, both forms, an invalid answer rejected, responses found in
        the export.
- The questions ship as `PLACEHOLDER` content (STUDY-009) until the user
  supplies them.
