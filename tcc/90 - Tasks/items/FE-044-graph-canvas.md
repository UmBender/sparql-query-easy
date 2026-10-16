---
id: FE-044
title: Draw and edit the query graph on a Cytoscape canvas driven by the store
status: BACKLOG
priority: P1
type: frontend
depends_on: [FE-041, FE-050, FE-043]
human_gate: false
created: 2026-10-16
updated: 2026-10-16
---
# Draw and edit the query graph on a Cytoscape canvas driven by the store

## Objective

T5a. Skill: `tcc-frontend`. Spec: legacy cards FE-002, FE-003, FE-007,
FE-013, FE-014, FE-016, FE-030, FE-032–FE-034, FE-037 and
[[../../04 - Frontend/Predicate Variable Edge Contract]].

## Scope

Cytoscape view rendering from the store; gestures become store actions.
Endpoint picker; add entity/variable/value/value variable/class; search nodes
by name; left-click action list; connect nodes with defined or variable
predicates; convert, remove; zoom behavior.

## Acceptance criteria

- [ ] The QUAL-006 rows for these features pass against the new app.
- [ ] Cytoscape never holds state the store lacks (test: rebuild view from store).
