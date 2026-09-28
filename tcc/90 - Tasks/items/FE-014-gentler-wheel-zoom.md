---
id: FE-014
title: Make mouse-wheel zoom on the graph less sensitive
status: DONE
priority: P2
type: frontend
depends_on: []
human_gate: false
created: 2026-09-28
updated: 2026-09-28
---
# Make mouse-wheel zoom on the graph less sensitive

## Objective

Scrolling the mouse wheel over the graph zooms in and out too sharply. One
wheel notch should change the zoom gently enough to keep the graph readable.

## Evidence

Skill: tcc-frontend. `sparql/index2.html` creates Cytoscape with
`userZoomingEnabled: true`, `minZoom: 0.15` and `maxZoom: 3`. It sets no
`wheelSensitivity`, so the Cytoscape default (1) applies. The `+`, fit and
`-` buttons in `#zoom-controls` use fixed 1.25× steps and are separate from
wheel zoom.

## Scope

- Lower wheel-zoom sensitivity. The expected approach is Cytoscape's
  `wheelSensitivity` option, with a value chosen by manual trial on a mouse
  wheel and a touchpad. Cytoscape logs a console warning for non-default
  values, so check whether that warning is acceptable or should be avoided
  with a small wheel handler.
- Keep pinch zoom, the zoom buttons and min/max zoom limits unchanged.

## Out of scope

Pan speed, layout, zoom-button step size, and graph-menu positioning (it
already follows zoom events).

## Acceptance criteria

- [x] One wheel notch changes the zoom noticeably less than before; a
      touchpad remains usable.
- [x] Zoom buttons, min/max limits and action-menu repositioning are
      unchanged.
- [x] An offline browser test asserts the zoom change for a synthetic wheel
      event stays within the chosen bound.
- [x] `npm run test:browser` and `git diff --check` pass.

## Execution log

- 2026-09-28: Created at user request; not started.
- 2026-09-28: Set Cytoscape `wheelSensitivity: 0.2`. Cytoscape zooms by
  `10^(-deltaY/250 × sensitivity)` and multiplies line-mode deltas by 33, so
  one mouse notch (100 px, or 3 lines in Firefox) went from 2.51× to about
  1.20×, close to the 1.25× buttons. Touchpad deltas scale down by the same
  factor. The one-time Cytoscape console warning for a non-default value is
  accepted: a custom wheel handler would duplicate its wheel and pinch logic.
  Buttons, pinch zoom and 0.15–3 limits are unchanged. A new browser test
  dispatches pixel and line notches in both directions and bounds the factor
  to 1.1–1.25; with the old value it failed at 2.51. Validation: browser
  suite 49/49 offline, `git diff --check`. Physical mouse and touchpad feel
  was not checked in this environment.
