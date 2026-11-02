---
id: STUDY-018
title: Export the last saved answers as a ZIP with plain-text diagrams for manual or AI-assisted grading
status: BACKLOG
priority: P1
type: fullstack
depends_on: [STUDY-017]
human_gate: false
created: 2026-11-02
updated: 2026-11-02
---
# Export the last saved answers as a ZIP with plain-text diagrams for manual or AI-assisted grading

Main skill: tcc-backend. Contract: [[DEC-020-manual-evaluation-and-submission-export]] (C4, C5, export layout and `diagram.txt` format).

## Scope

- `GET /api/admin/submissions.zip` (admin only), built with `java.util.zip`,
  with the layout in DEC-020. There is a download link on `/admin`.
- A Kotlin generator turns a saved `formatVersion: 1` graph into the
  `diagram.txt` format in DEC-020: header, numbered nodes with kind, IRI and
  filter, then relations by number (C4, C5).
- Golden `.txt` fixtures cover a variable-free diagram, filters, a predicate
  variable, duplicate labels, and labels with arrows or line breaks.

## Acceptance

- The ZIP has one folder per pseudonym and task, holding only the last save.
  It contains no account names or e-mails.
- Every `diagram.json` loads in the editor. Every `diagram.txt` matches its
  golden fixture.
- No user label can make two nodes or relations indistinguishable in `diagram.txt`.

## Validation

Generator unit tests with golden files, a route test that reads the ZIP back,
and the fullstack gate.
