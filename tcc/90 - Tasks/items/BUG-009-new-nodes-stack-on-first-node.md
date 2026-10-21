---
id: BUG-009
title: Nodes added by search or Explore relationships land on top of the first node
status: DONE
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

- [x] With Auto Layout on, a node added by search or Explore relationships
      gets a laid-out position that does not overlap an existing node.
- [x] With Auto Layout off, new nodes are spread as `placeNew` does for
      unplaced nodes, not stacked.
- [x] Saved queries with positions still load at their stored positions.
- [x] Regression test (Vitest or offline Playwright); the STUDY-012 drags
      may stay, since they also cover dragging.

## Validation

Focused: the new regression test. Closing gate: frontend gate
(Operational Map), plus `test:stack` because STUDY-012 draws through these
paths.

## Conclusion

- **Positions:** `addEntity` (search result) and `addRelationValue`
  (search with a discovered relation, Explore relationships) no longer give
  new nodes the fixed `{x: 200, y: 200}`. `addEntity` keeps an optional
  explicit position. The canvas's `placeNew` now sees these nodes as unplaced:
  - **Auto Layout on:** cose runs and its positions are written back.
  - **Auto Layout off:** the new `freeSpots` (`features/editor/graph-view.ts`)
    picks the viewport centre, or the nearest free point on rings of 90 px
    around it, never closer than 90 px to an existing node or another new
    one. Before, each one-node add went to the centre again.
- **Saved queries:** they carry positions, so they still load where they
  were saved. Reused nodes in `addRelationValue` are not moved.
- **Tests:**
  - `operations.spec.ts`: no position by default, an explicit position is
    kept, and relation values carry no position.
  - `graph-view.spec.ts`: three `freeSpots` cases.
  - `tests/editor.e2e.ts`: "BUG-009 related search results get their own
    place" with Auto Layout on and off. Three related search results are
    pairwise more than 30 px apart on screen. Both cases fail on the old
    code and pass now.
- **STUDY-012 spec:** with Auto Layout now running on every add and fitting
  the view, nodes grow and move. So the fixed drag offsets (which pushed nodes
  off the canvas) and the click on a fixed corner (which hit a node) were
  replaced:
  - `freePoint` finds canvas space clear of the graph and of overlays.
  - `clickBackground` clicks there.
  - `placeAside` drags each Add value filter node there, so dragging is
    still covered.
  - Search and Explore results are no longer dragged.

Validation:
- `npm run lint` and `npm run check`: pass.
- `npm test`: Vitest server 248 and components 25 pass; e2e 118 pass,
  including both BUG-009 cases. The `/api/query/count` proxy
  `AggregateError` printed during the component run is existing noise; the
  tests pass.
- `test:stack`: 20 of 21 passed with the first fix; STUDY-012 failed on the
  spec's fixed corner click. After the spec change, STUDY-012 passes on a
  fresh stack (1.2 min). No product code changed between the two runs.
