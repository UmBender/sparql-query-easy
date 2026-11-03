---
id: STUDY-018
title: Export the last saved answers as a ZIP with plain-text diagrams for manual or AI-assisted grading
status: DONE
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

## Conclusion (2026-11-02)

Done. `GET /api/admin/submissions.zip` (`SubmissionExportService`,
`java.util.zip`) writes `index.csv` and, per pseudonym and task, only the
last save: `diagram.txt`, `diagram.json` (the stored graph, indented),
`reference.txt` (the revision's reference as text with statement, SPARQL and
expected values, or a note that it was not kept), and with variables
`query.sparql` (each checked variable under a `#` comment) and `values.csv`.
`/admin` has a download link. No username, e-mail or user id is written.
`DiagramText` renders the DEC-020 format: numbered nodes with kind, IRI or
term and filter, then relations by number.
Contract: [[../../03 - Backend/API v1#Saved answer export (admin, STUDY-018)]].

Two additions to the DEC-020 example, for the "indistinguishable" criterion:
each relation line ends with its predicate (`(predicate <IRI>)`), so parallel
relations with the same label differ; and a label holding `--`, `[`, `]`,
`—`, `"` or `\` is quoted with escapes, so a label like `goes --> [3]` cannot
read as another relation.

Limitations: `diagram.json` is the stored JSON value; the server only checks
`formatVersion: 1`, so a diagram the browser did not produce could fail the
editor's stricter loader (every diagram saved through the app loads; the
route test compares the export with the fixture the frontend specs load).
`values.csv` writes the same rows the check stored (at most the task cap + 1
per variable).

Validation: `DiagramTextTest` (six golden files: variable-free, filters,
value filters, predicate variable, duplicate labels, arrows and line breaks;
one line per element; parallel relations differ),
`AdminSubmissionExportRoutesTest` (reads the ZIP back: layout, index, last
save only, no account names, missing revision, 403/401, empty export),
`AccessControlMatrixTest`, `OpenApiRoutesTest`; Kotlin gate (ktlint, detekt,
376 tests) passed. Frontend check, lint and `npm test` (135 offline
Playwright) passed; `admin-access` and `a11y` rerun after the last layout
change (29); `test:screens` passed after refreshing `/admin` and
`/admin/submissions/7` (reviewed; the review page's SPARQL and value lists no
longer scroll, an axe `scrollable-region-focusable` finding the new stack
test caught). New `tests-stack/study-submission-review.e2e.ts` covers review
and download on the real stack.
`test:stack` passed with 23 tests. In an earlier full run,
`study-participant.e2e.ts` "a participant saves two answers…" failed once
(an existing participant-only test, untouched here); it passed alone and in a
full rerun, so it is recorded as a flake.
