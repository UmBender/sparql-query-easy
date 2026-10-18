---
id: FE-047
title: Show the filter funnel with switchable steps and kept/total badges
status: DONE
priority: P1
type: frontend
depends_on: [FE-045, FE-046]
human_gate: false
created: 2026-10-16
updated: 2026-10-18
---
# Show the filter funnel with switchable steps and kept/total badges

## Objective

T5d. Skill: `tcc-frontend`. Spec: FE-028, FE-036, FE-039 and the Numeric
filters row of [[../../09 - Decisions/Current Contracts]].

## Scope

Funnel panel from `count` (one step per filter, MAX/MIN last, preview-only
toggles); badges above filtered nodes (kept/total, or actual value with ✓/✗
for a fixed-entity subject). The step on/off state belongs to the domain
(FE-042 toggle operation) and the store (FE-043 `$derived` funnel steps);
this card renders it and sends `count` requests for it (T4, confirmed
2026-10-16).

## Fixture scenarios (QUAL-009)

`funnel-step-off`, `funnel-value-variable`, `actual-value-check`, and the badge counts in every filtered scenario. See `fixtures/legacy/README.md` and [[../../04 - Frontend/Frontend Parity Checklist]].

## Acceptance criteria

- [x] QUAL-006 rows for funnel and badges pass with identical counts.

## Execution log

- 2026-10-18: `frontend/src/lib/features/funnel/`: `Funnel` (counts one
  request at a time, generation and abort for superseded refreshes, 350 ms
  refresh after edits, rows/status/result texts of the legacy panel),
  `FilterBadges` (port of filter-badges.js: kept/total counts on the funnel's
  steps for the query as it runs, actual-value chip and ✓/✗ for fixed
  subjects, 400 ms debounce, stale lookups dropped, `rejected` canvas class),
  `CountCache` (counts stored in the TanStack cache, explicit fetch/share/abort
  like legacy `trackResultCount`/`loadResultCount`), `funnel-panel.svelte`
  and `filter-badges.svelte`. Toolbar Filter funnel button
  (`aria-expanded`), Escape inside the panel returns focus. `Panel` gained
  `closeId` (legacy ids `filter-funnel-close`, `two-variable-panel-close`).
  Step on/off state and labels come from the store/domain (FE-042/FE-043).
  Tests: `tests/funnel.e2e.ts` (8) port the B-01–B-05 legacy cases with the
  same counts, texts and request bodies. Validation: check, lint,
  `npm --prefix frontend test` (153 Vitest server, 4 component, 62
  Playwright). Completion commit for this task.
