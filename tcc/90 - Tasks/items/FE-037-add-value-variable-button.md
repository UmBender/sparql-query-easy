---
id: FE-037
title: Add a value variable from the toolbar, like Add Variable
status: DONE
priority: P1
type: frontend
depends_on: [FE-034]
human_gate: false
created: 2026-10-14
updated: 2026-10-14
---
# Add a value variable from the toolbar, like Add Variable

## Objective

User request (2026-10-14): a toolbar button for the FE-034 value variable,
like **+ Add Variable**.

## Scope

- **Add Value Variable** (`#add-value-variable-btn`) beside Add Variable calls
  `addNewValueVariable()` (`app-core.js`). It adds an unconnected value
  variable `?value_<n>` with no filter (any value).
- The user connects a subject to it with Connect with defined predicate and
  sets its filter with Edit filter (FE-034).
- Exclusions: no change to Add Variable, the value variable or the API.

## Layout decision

Three buttons do not fit in the left toolbar cell below about 1600 px wide
(the cell is 504 px at 1440 px; the buttons need about 570 px, and a shorter
label still needs 536 px). The user chose to keep the full **Add Value
Variable** label and let it wrap to a second row on narrower screens. A
combined Add Variable menu and icon-only buttons were the alternatives.

## Acceptance criteria

- The button adds one value variable with the FE-034 look and actions.
- A defined predicate connects a subject to it, and Edit filter filters it.

## Result

- 2026-10-14: implemented as scoped. Browser test `FE-037 Add Value Variable
  adds a value variable that a defined predicate connects and Edit filter
  filters`.
- Validation: `npm run check:frontend-types` (clean), `npm run test:query`
  (67 pass), `npm run test:browser` (120 pass).
