---
id: FE-060
title: Zoom the graph at a comfortable speed with the mouse wheel and trackpad
status: READY
priority: P1
type: frontend
depends_on: []
human_gate: false
created: 2026-10-27
updated: 2026-10-27
---
# Zoom the graph at a comfortable speed with the mouse wheel and trackpad

## Objective

User report (2026-10-27): scrolling to zoom in and out is too slow.
FE-014 set Cytoscape `wheelSensitivity: 0.2` (~1.2x per notch) in
`frontend/src/lib/features/editor/graph-canvas.svelte`. Skill:
`tcc-frontend`.

## Scope and acceptance

- Measure the zoom change per wheel notch (and per small trackpad delta)
  under the current setting, then raise it so one mouse notch zooms
  noticeably (target about 1.4–1.5x) without a trackpad pinch jumping;
  keep `minZoom`/`maxZoom`. Record measured before/after factors.
- A test fixes the configured sensitivity/factor so it does not regress.
- Zoom buttons unchanged unless measurement shows the same problem.

## Validation

- Focused: the spec covering the canvas options.
- Closing: the new frontend gate.

## Conclusion
