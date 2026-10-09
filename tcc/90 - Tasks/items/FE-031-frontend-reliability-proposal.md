---
id: FE-031
title: Propose how to make frontend changes less error prone
status: DONE
priority: P1
type: analysis
depends_on: []
human_gate: false
created: 2026-10-09
updated: 2026-10-09
---
# Propose how to make frontend changes less error prone

## Objective

User request (2026-10-09): "every modification I made it became really bug
after", especially interactions with value nodes. Find out why and propose
how to fix it. Skill: `tcc-frontend-audit`. Analysis only; no application
code changes.

## Acceptance criteria

- [x] Evidence, cause and proposal recorded in
      [[../../04 - Frontend/Frontend Evolution Audit]] (Reliability proposal).
- [x] Follow-up slices created as BACKLOG cards: QUAL-005, FE-032, FE-033.
      The requested new node type is FE-034.

## Execution log

- 2026-10-09: Compared the BUG-003/005/006 root causes and the FE-030
  follow-up. Counted the node-kind checks and the graph-change sites with
  `rg`, compared the two variable-replacement paths and the type-check
  scope, and confirmed that the bundled Cytoscape 3.29.1 runs headless in
  Node. Validation: `node scripts/check-project-docs.mjs` and
  `git diff --check`. Completion commit for this task.
