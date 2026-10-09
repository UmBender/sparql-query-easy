---
id: FE-033
title: Bind a variable to a value through one tested graph function
status: BACKLOG
priority: P1
type: refactor
depends_on: [FE-032]
human_gate: false
created: 2026-10-09
updated: 2026-10-09
---
# Bind a variable to a value through one tested graph function

## Objective

Replacing a variable with a chosen value is implemented twice:
`replaceWithNewNode` (`graph-nodes.js`, results table) and
`replaceVariableNodeWithTerm` (`stage-exploration.js`, Apply/Assume).
BUG-003 and BUG-006 were each caused by one copy behaving differently from
the other. Merge them without changing behavior. Skill: `tcc-refactor`.

## Scope

- One function, for example `bindVariable(cy, variableId, term, options)`, in
  a checked module. The one difference that exists on purpose becomes an
  explicit option: the results table removes the outgoing neighbours and
  fetches them again through the relationship request, while Apply/Assume
  do not.
- Covers: reusing an existing node, moving edges with their IDs and data,
  self-loops, predicate-variable edges and keeping the action menu targeted
  (`nodeActionMenuController.retarget`).
- Unit tests run on a headless Cytoscape graph under `node --test`. The
  bundled `sparql/cytoscape.min.js` is loaded as a global script; this was
  verified in FE-031. The relationship request is a mock.
- Exclusions: no change to the legacy re-fetch rules; no new kinds.

## Acceptance criteria

- Both call sites use the one function; the old copies are removed.
- Headless tests cover a new value, a value already in the graph (cycle), a
  self-loop, IRI vs literal neighbours (BUG-006) and predicate edges.
- QUAL-005 table and the full browser suite pass unchanged.

## Validation

`npm run test:query` (adds the headless test file), `npm run
check:frontend-types`, `npm run test:browser`. Rollback: revert the commit.
