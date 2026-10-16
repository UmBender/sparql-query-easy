---
id: FE-039
title: Count value-variable filters as funnel steps and show each step on its badge
status: DONE
priority: P1
type: frontend
depends_on: [FE-028, FE-034, FE-036]
human_gate: false
created: 2026-10-16
updated: 2026-10-16
---
# Count value-variable filters as funnel steps and show each step on its badge

## Objective

User report (2026-10-16): the filter funnel ("filtering stack") does not work
properly, and the badges showing a filter's ratio do not work either.

Reproduced on PokemonGen1 with `?p primaryType Fire`, `?p speed ?speed ≥ 90`
and `?p hp ?hp ≥ 80` (value variables, FE-034/FE-037):

- The funnel listed only `primaryType = Fire`; both value-variable filters
  were applied to every count (FE-034 recorded choice), so the "any value"
  base was 6 instead of 151, and it counted distinct `?hp` values (first in
  the variable order): "Result: 1 ?hp of 6".
- Each badge profiled its relation under every other filter, so `speed ≥ 90`
  showed `2 / 2` (it looked like the filter did nothing) and disagreed with
  the funnel.

## Decisions (user, 2026-10-16: the recommended options)

1. A badge shows its funnel step: results kept after this filter / results
   reaching it from the earlier filters (Fire → speed ≥ 90 → hp ≥ 80 gives
   `7 / 12` and `2 / 7`). This replaces the FE-036 profile-based count.
2. A value-variable filter is a funnel step; relaxing it keeps its relation
   with any value. The funnel counts the first entity (non-value) variable by
   default; the picker still offers every variable.

## Scope

- `query-calculations.js` `filterFunnelPlan`, `filter-funnel.js`,
  `filter-badges.js`; unit and browser tests; Frontend Architecture and
  Current Contracts notes.
- Unchanged: the fixed-entity actual-value chip and ✓/✗ badge (FE-036),
  Run Query/View SPARQL payloads, preview-only funnel toggles.

## Acceptance

- Value-variable filters are toggleable funnel rows; the base relaxes them.
- Default counted variable is the first non-value variable.
- Every filtered node under a variable (numeric, text, MAX/MIN, value
  variable) shows `kept / total` from the funnel counts of its step, for the
  query as it runs (preview toggles ignored); red at 0; `?` on error; none
  beyond the counted steps or when the funnel cannot count.
- Badges and an open funnel share count results.

## Validation

`npm run test:query`, `npm run check:frontend-types`, focused then full
`npm run test:browser`; repeat the PokemonGen1 reproduction on the built app.

## Conclusion

- `filterFunnelPlan`/`funnelStepKind` take the value-variable filters: a
  filtered value variable is a step on its first incoming fixed relation;
  relaxed, the relation stays and the filter is left out. `filterBadgeCount`
  (profile-based badge) and the unused amber `truncated` badge style removed.
- `filter-funnel.js`: `currentFunnelPlan` (shared with badges),
  `defaultFunnelVariable` (first non-value variable), value-variable step
  labels (`speed ≥ 90`), shared count cache and in-flight requests
  (`loadResultCount`/`trackResultCount`; an aborted funnel request is asked
  again by a waiting badge).
- `filter-badges.js`: count badges read their funnel step (`before`/`after`
  requests, preview toggles ignored), one count at a time; the fixed-entity
  actual-value chip and ✓/✗ are unchanged.
- Validation: `npm run test:query` (70 pass, two new FE-039 cases);
  `npm run check:frontend-types` clean; `npm run test:browser` 123 pass
  (FE-036 badge tests rewritten to the count route, new FE-039 case; the
  debounce test now counts distinct requests because badges share them);
  `node scripts/check-project-docs.mjs`; `git diff --check`. Built app on
  PokemonGen1 with Fire + `speed ≥ 90` + `hp ≥ 80` value variables: funnel
  151 → 39 → 2 → 2 counting `?p`, badges `39 / 151` and `2 / 2` equal to
  their rows.
- Limitation: step order follows the graph component's traversal order (as
  before), not the order filters were added.
- Completion commit for this task.
