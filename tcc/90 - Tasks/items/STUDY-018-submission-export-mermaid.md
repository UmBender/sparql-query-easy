---
id: STUDY-018
title: Export the last saved answers as a ZIP with Mermaid diagrams for manual or AI-assisted grading
status: BACKLOG
priority: P1
type: fullstack
depends_on: [STUDY-017]
human_gate: false
created: 2026-11-02
updated: 2026-11-02
---
# Export the last saved answers as a ZIP with Mermaid diagrams for manual or AI-assisted grading

Main skill: tcc-backend (plus a frontend test). Contract: [[DEC-020-manual-evaluation-and-submission-export]] (C4–C7, proposed export layout).

## Scope

- `GET /api/admin/submissions.zip` (admin only), built with `java.util.zip`,
  with the layout in DEC-020. There is a download link on `/admin`.
- A Kotlin generator turns a saved `formatVersion: 1` graph into a Mermaid
  `flowchart LR`: generated ids, quoted escaped labels, `%%` IRI lines and a
  header saying it is derived from `diagram.json` (C4, C5).
- Golden `.mmd` fixtures cover a variable-free diagram, filters, a predicate
  variable, labels with `"#;|<>`, duplicate labels and a node named `end`.
- If C6 is approved: a Vitest browser test parses every golden file with
  `mermaid.parse` (`mermaid` as devDependency only).

## Acceptance

- The ZIP has one folder per pseudonym and task, holding only the last save.
  It contains no account names or e-mails.
- Every `diagram.json` loads in the editor. Every `.mmd` parses (C6) or
  matches its golden fixture.
- No user text in the export can break the Mermaid syntax.

## Validation

Generator unit tests with golden files, a route test that reads the ZIP back,
the Mermaid parse test, and the fullstack gate.
