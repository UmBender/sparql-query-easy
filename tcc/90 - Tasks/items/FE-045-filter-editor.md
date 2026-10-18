---
id: FE-045
title: Edit value and value-variable filters with histogram and text suggestions
status: DONE
priority: P1
type: frontend
depends_on: [FE-044]
human_gate: false
created: 2026-10-16
updated: 2026-10-18
---
# Edit value and value-variable filters with histogram and text suggestions

## Objective

T5b. Skill: `tcc-frontend`. Spec: BE-003, BE-004, FE-026, FE-030, FE-034,
FE-035, FE-038 and the Numeric filters / Value variables rows of
[[../../09 - Decisions/Current Contracts]].

## Scope

Exact, starts with, contains, at least, at most, between, MAX/MIN (not on
value variables); histogram of real values from `numeric-profile`; cycling
over kept entities; text suggestions via `stage`; Superforms + Zod validation.

## Fixture scenarios (QUAL-009)

`filter-exact-literal`, `filter-starts-with`, `filter-contains`, `numeric-profile-edit-between`, `filter-max-tie`, `filter-min-tie`, `value-variable-*`, `text-suggestions-*`, `add-value-filter`. See `fixtures/legacy/README.md` and [[../../04 - Frontend/Frontend Parity Checklist]].

## Acceptance criteria

- [x] QUAL-006 rows for filters pass; request payloads equal the legacy ones.

## Execution log

- 2026-10-18: `frontend/src/lib/features/filters/`: `filter-editor.svelte`
  (Edit Filter Value dialog for value nodes and value variables; Superforms 3
  in SPA mode with the Zod 4 adapter; Apply on Enter; typing under Any value
  switches to Exact; legacy errors shown on the field and as a toast),
  `filter-form.ts` (option sets per mode, start values, schema),
  `filter-histogram.svelte` with the pure `histogram-model.ts` (FE-026
  slider, counts, truncated/single notes, MAX/MIN extremes, FE-035 cycle of
  kept entities five at a time with play/pause and the mini result graph from
  `filterPreviewStylesheet`), `filter-suggestions.svelte` (FE-038, 400 ms
  debounce, stand-in variable, arrow keys). The editor opens from Edit value,
  Edit filter and Add value filter (seeded from the limit-1 profile). Zod is
  now 4.6.7 (Superforms' adapter types clashed with Zod 3.25); the domain's
  saved-format schema runs unchanged on it. Tests: `filter-form.spec.ts` (3),
  `histogram-model.spec.ts` (2), `tests/filters.e2e.ts` (9) port the F-01–F-05,
  F-07 and G-13 legacy cases with the same expected texts and request bodies.
  Parity rows marked `new`; F-06's Assume part lands with FE-046.
  Validation: check, lint, `npm --prefix frontend test` (153 Vitest server,
  4 component, 31 Playwright). Completion commit for this task.
