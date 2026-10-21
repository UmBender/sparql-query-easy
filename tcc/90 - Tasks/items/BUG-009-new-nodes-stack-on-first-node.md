---
id: BUG-009
title: Nodes added by search or Explore relationships land on top of the first node
status: BACKLOG
priority: P1
type: bug
depends_on: []
human_gate: false
created: 2026-10-21
updated: 2026-10-21
---
# Nodes added by search or Explore relationships land on top of the first node

## Objective

Found by STUDY-012 on the real stack (PokemonGen1, Auto Layout on): search
Tentacruel, then Water, then Level up. All three nodes are drawn at the same
spot (store position `{x: 200, y: 200}` for each), so only the last one is
visible, the edges between them have zero length, and the next click on the
canvas hits whichever node is on top. A row added through Explore
relationships behaves the same. Skill: `tcc-frontend`.

## Evidence

- `addEntity` and `addRelationValue` in `frontend/src/lib/domain/operations.ts`
  give every new node `DEFAULT_POSITION` (`{ x: 200, y: 200 }`).
- `graph-canvas.svelte` `sync` only treats nodes without a position as
  unplaced, so `placeNew` (cose with Auto Layout, or a spread from the
  viewport centre without it) never runs for them.
- STUDY-012's spec (`frontend/tests-stack/study-query-creation.e2e.ts`)
  works around it by dragging each new node aside (`Drawing.search`,
  `Drawing.explore`).

## Acceptance criteria

- [ ] With Auto Layout on, a node added by search or Explore relationships
      gets a laid-out position that does not overlap an existing node.
- [ ] With Auto Layout off, new nodes are spread as `placeNew` does for
      unplaced nodes, not stacked.
- [ ] Saved queries with positions still load at their stored positions.
- [ ] Regression test (Vitest or offline Playwright); the STUDY-012 drags
      may stay, since they also cover dragging.

## Validation

Focused: the new regression test. Closing gate: frontend gate
(Operational Map), plus `test:stack` because STUDY-012 draws through these
paths.
