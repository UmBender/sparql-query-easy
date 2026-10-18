---
id: FE-046
title: Run the query as ordered stages, choose values and apply them to the graph
status: BACKLOG
priority: P1
type: frontend
depends_on: [FE-044]
human_gate: false
created: 2026-10-16
updated: 2026-10-16
---
# Run the query as ordered stages, choose values and apply them to the graph

## Objective

T5c. Skill: `tcc-frontend`. Spec: DEC-008, FE-004–FE-006, FE-008–FE-010,
FE-015, FE-017, FE-023–FE-025, BUG-003–BUG-006 and
[[../../04 - Frontend/Two Variable Exploration Contract]].

## Scope

Numbered reorderable variable chips, bounded stage requests, hover/focus
preview, possible-graph window, Assume and Apply to graph, View SPARQL.

## Fixture scenarios (QUAL-009)

`fire-speed-at-least-90`, `run-query-two-stage-apply`, `run-query-three-reordered-assume`, `value-variable-any`, `view-sparql-only`. See `fixtures/legacy/README.md` and [[../../04 - Frontend/Frontend Parity Checklist]].

## Acceptance criteria

- [ ] QUAL-006 rows for exploration pass; the offline e2e scenario of
      QUAL-002 passes against the new app.
