---
id: FE-018
title: Analyze index2.html size and plan agent-sized frontend files
status: DONE
priority: P1
type: analysis
depends_on: [FE-011, FE-012]
human_gate: false
created: 2026-09-28
updated: 2026-09-28
---
# Analyze index2.html size and plan agent-sized frontend files

## Objective

The user asked why `sparql/index2.html` is so large and what would make it
smaller and easier for agents to edit. Skill: `tcc-frontend-audit`. Analysis
only; no application code changes.

## Acceptance criteria

- [x] Size history, region map and coupling recorded in
      [[../../04 - Frontend/Frontend Evolution Audit]].
- [x] Behavior-preserving follow-up slices created as BACKLOG cards FE-019–FE-022.

## Execution log

- 2026-09-28: Measured 3,001 lines / 144 KB and the line count at each FE
  commit since `beb7058`, mapped CSS, markup, top-level script and
  `DOMContentLoaded` regions, checked for unused functions (none), duplicated
  Cytoscape style, `window` names used by tests and Gradle packaging. Wrote
  the audit section and four BACKLOG cards. Validation:
  `node scripts/check-project-docs.mjs` and `git diff --check`.
