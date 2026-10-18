---
id: FE-048
title: Upload triples, load and export queries, auto layout and the guided tour
status: DONE
priority: P1
type: frontend
depends_on: [FE-044]
human_gate: false
created: 2026-10-16
updated: 2026-10-18
---
# Upload triples, load and export queries, auto layout and the guided tour

## Objective

T5e. Skill: `tcc-frontend`. Spec: FE-001 and the legacy toolbar.

## Scope

Turtle upload (`/api/local-database`), load/export query in the FE-042
versioned format only (legacy `query_exported.json` files are not
supported, user decision 2026-10-16), auto layout, guided demo tour.

## Fixture scenarios (QUAL-009)

`upload-local-graph`. See `fixtures/legacy/README.md` and [[../../04 - Frontend/Frontend Parity Checklist]].

## Acceptance criteria

- [x] QUAL-006 rows for these utilities pass.

## Execution log

- 2026-10-18: `frontend/src/lib/features/utilities/`: `file-actions.svelte`
  (Upload Triples → `POST /api/local-database` multipart `ttlFile`, the
  endpoint becomes the uploaded graph id; Upload Query/Export Query in the
  FE-042 versioned format, file `easyquery-query.json`; legacy
  `query_exported.json` refused with the loader's message),
  `guided-tour.svelte` with `tour-steps.ts` (the nine legacy Intro.js steps,
  Next/Back/Skip, Escape, focus on the primary button), `seen.ts` (shown-once
  flags with in-memory fallback when storage is blocked). First added node
  shows the one-time action-list hint (legacy `newNode`). Auto Layout keeps
  the FE-044 behavior: cose runs when nodes are added while it is on.
  Intended differences: the tour shows on the first visit only; exports use
  the versioned format. Toolbar ids `add-variable-btn`, `demo-link` for tour
  targets; `openEditor` marks the tour seen unless `{ tour: true }`.
  `check-raw-colors` no longer reads `#add-…` selectors as hex colors.
  Tests: `tests/utilities.e2e.ts` (7). Validation: check, lint,
  `npm --prefix frontend test` (153 Vitest server, 4 component, 69
  Playwright). Completion commit for this task.
