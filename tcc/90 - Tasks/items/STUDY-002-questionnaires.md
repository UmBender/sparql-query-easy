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
