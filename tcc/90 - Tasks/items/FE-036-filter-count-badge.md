---
id: FE-036
title: Show a kept/total badge on filter nodes and, once the variable is assumed, its actual value next to the filter
status: BACKLOG
priority: P1
type: frontend
depends_on: [FE-035, BE-004]
human_gate: false
created: 2026-10-09
updated: 2026-10-09
---
# Show a kept/total badge on filter nodes and, once the variable is assumed, its actual value next to the filter

## Objective

Two parts, both display-only:

1. **Badge (DEC-010).** The FE-027 dot strip is dropped, but its live
   "kept / total" badge over filtered value nodes in the main graph is kept.
   Port the badge part of `sparql/filter-profile.js` from branch
   `FE-027-filter-dot-strip-badge` (commit `bfe1d8a`) onto `main`.
2. **Assumed value (user request 2026-10-09).** When exploration consolidates
   the variable into an entity (Assume `assumeStageCandidate` or Apply
   `applyExplorationToGraph`, both through `applyChoicesToGraph` /
   `replaceVariableNodeWithTerm` in `sparql/stage-exploration.js`), the
   filtered value node linked to it should also show that entity's actual
   value for the relation, e.g. Pikachu's speed `90` next to the filter
   `≥ 90`. The old filter is **not** removed, so the user can still see which
   filter produced that value.

Skill: `tcc-frontend`.

Current behavior (checked 2026-10-09): `replaceVariableNodeWithTerm` swaps the
variable node for the entity and moves its edges; the filtered value node is
untouched, so it keeps its filter (`value`, `filterType`, label `≥ 90`) but
never shows the entity's real value.

## Scope

- **Badge** on value nodes with a filter while their subject is still a
  variable: `kept / total` from the BE-003 profile, debounced refresh,
  green / amber (partial profile) / red with node border at 0, `+` for a lower
  bound, stale responses ignored. Covers ≥, ≤, Between and, since BE-004,
  MAX/MIN (count of tied entities). No editor dot strip.
- **Assumed value** after Assume/Apply, for each filtered value node now
  linked to a fixed entity by a fixed predicate: fetch the entity's values for
  that relation with the existing `POST /api/query/relationship-value`
  (`isLiteral: true`) and show them on the node (several values joined, e.g.
  `90, 95`) together with the kept filter label (`≥ 90`). The badge then
  shows whether the actual value passes the filter (✓, or ✗ in red), instead
  of a count.
- **Display only:** the resolved value is stored as separate display data;
  `value`, `filterType` and the generated query stay exactly as before
  (the filter keeps being sent). Editing the filter clears or refreshes the
  shown value; a failed or empty lookup keeps the filter label and says the
  value is unknown.
- Exclusions: no backend change; no change to Assume/Apply bindings.

## Acceptance criteria

- [ ] Badges behave as in FE-027 (plus MAX/MIN) on top of FE-026/FE-035; the
      editor shows no dot strip; element query data is unchanged.
- [ ] After Assume or Apply, a filtered value node shows the entity's actual
      value(s) and still shows and sends its filter; the badge shows pass/fail.
- [ ] Lookup errors, empty results and filter edits after consolidation are
      handled; stale lookups are ignored.
- [ ] Offline browser tests with mocked profile and relationship-value
      routes; `npm run test:browser` passes (and the Kotlin static-route test
      if a new script is packaged).

## Execution log

- 2026-10-09: Created as the badge port.
- 2026-10-09: Extended at the user's request with the assumed value next to
  the kept filter; MAX/MIN added to the badge after BE-004. Not started: the
  user wants to clear the session memory first.
