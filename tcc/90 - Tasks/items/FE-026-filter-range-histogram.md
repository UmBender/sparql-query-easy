---
id: FE-026
title: Visualize a numeric filter as a range slider over a histogram
status: DONE
priority: P1
type: frontend
depends_on: [BE-003]
human_gate: false
created: 2026-10-07
updated: 2026-10-07
---
# Visualize a numeric filter as a range slider over a histogram

## Objective

One of four competing numeric-filter visualizations requested on 2026-10-07.
Implement on its own branch `FE-026-filter-range-histogram` from `main` after BE-003; the
user tests the branches and chooses which one is merged (DEC-010). Do not
merge into `main`. Skill: `tcc-frontend`.

## Scope

A two-handle range slider over a histogram of the profiled values inside the filter editor. Bars outside the range are grey; a live "keeps N of M" count. Moving the handles writes a Between (or ≥/≤) filter. Use the BE-003 profile (`fetchNumericProfile`) and filter labels.

## Acceptance criteria

- [x] Histogram bins and the kept count follow the slider; applying writes the expected filter; empty/error/truncated profiles are shown.
- [x] Offline browser tests with a mocked profile; browser gate passes.
- [x] Works on a narrow viewport; keyboard reachable.

## Execution log

- 2026-10-07: Created; BE-003 provides the profile and labels.
- 2026-10-07: Implemented on branch `FE-026-filter-range-histogram` (base
  `42dc513`, BE-003); status REVIEW for the user's choice in DEC-010.
  - Opening the editor of a numeric filter node calls `loadFilterHistogram`
    (`graph-nodes.js`), which uses `fetchNumericProfile` and draws a plain SVG
    histogram (up to 24 equal-width bins) with two overlapping native range
    inputs (`Lowest kept value`, `Highest kept value`; keyboard arrows step
    through the scale). Kept parts of each bar are blue, the rest grey; a
    live `Keeps N of M values` line and the selected range follow the
    handles. Handles cannot cross.
  - Written filter (pure `rangeFilter`): only the low handle moved writes At
    least (`>= lo`); only the high handle writes At most (`<= hi`); otherwise
    Between `lo..hi` (both at the ends writes the full range). A handle at
    its end means "no bound on that side", so open-ended filters stay
    open-ended. Typing in the value field or changing the filter type moves
    the handles (`rangeFromFilter`); merely opening never rewrites the value.
  - The editor now preselects the stored filter type (previously "Exactly
    Equal" was always checked, so applying a reopened `40..80` unchanged
    sent it as an exact value).
  - States: loading, empty profile, server error (message shown), no single
    fixed relation, truncated (`The histogram covers the lowest N of M
    values (up to X; the largest is Y)`; with the top handle open the count
    adds the values beyond the sample, otherwise it may say "at least").
    A newer editor aborts an older request; stale responses are ignored.
  - Pure helpers in `query-calculations.js`: `rangeScale`, `histogramBins`,
    `countInRange`, `rangeFilter`, `rangeFromFilter`; CSS in `index2.css`.
    No new files or libraries.
  - Validation: `npm run test:query` 32 passed (3 new);
    `npm run test:browser` 73 passed (5 new, mocked
    `/api/query/numeric-profile` via `page.route`);
    `npm run check:frontend-types`; `node scripts/check-project-docs.mjs`;
    `git diff --check`. Kotlin/Gradle untouched, so no Kotlin gate.
    Playwright screenshots of the editor at 1280 px and 360 px checked.
  - Limitations: the Materialize stub never opens modals, so the browser
    tests show the modal through its style; the profile is fetched once per
    editor opening (no refresh while the editor is open); bins are
    equal-width over the sample, so a truncated profile shows only its lowest
    values; slider steps are 1 for whole numbers and a power of ten near 1%
    of the span otherwise.
- 2026-10-07: Accepted by the user after testing (with FE-030's Add value
  filter) and fast-forwarded into `main` at `1204dd1` (DEC-010).
