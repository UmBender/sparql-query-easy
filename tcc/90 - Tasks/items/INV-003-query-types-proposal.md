---
id: INV-003
title: Propose other query types the tool could support
status: DONE
priority: P2
type: analysis
depends_on: []
human_gate: false
created: 2026-10-15
updated: 2026-10-15
---
# Propose other query types the tool could support

## Objective

User request (2026-10-15): "Make a proposal what other types of queries can
be useful in this tool. Document it, it can be useful in the future."
Skill: `tcc-plan-task`. Analysis only; no application code changes.

## Acceptance criteria

- [x] Current query capabilities taken from the generator and contracts.
- [x] Proposal with examples, SPARQL shape, graph notation, cost, open
      decisions and a recommended order recorded in
      [[../../01 - Project/Query Types Proposal]].
- [x] No implementation cards created: the user asked for a reference
      document, so cards are added when a query type is chosen.

## Execution log

- 2026-10-15: Read `WikidataQueryGenerator.kt` (patterns, filters, count,
  stage and profile queries, unused `/` sequence paths) and the datatypes of
  both built-in graphs. Validation: `node scripts/check-project-docs.mjs` and
  `git diff --check`. Completion commit for this task.
