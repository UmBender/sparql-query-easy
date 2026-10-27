---
id: FE-060
title: Zoom the graph at a comfortable speed with the mouse wheel and trackpad
status: DONE
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

Done 2026-10-27. Measured before: Cytoscape 3.33 clamps the first wheel
deltas to 5 px and divides multiples of 5 by their smallest value, so with
`wheelSensitivity: 0.2` one 100 px mouse notch zoomed only ~1.01x. No single
sensitivity fixes that without trackpad jumps, so the app now owns wheel zoom
(`frontend/src/lib/features/editor/wheel-zoom.ts`, installed by
`graph-canvas.svelte` in the capture phase, Cytoscape's handler suppressed):
zoom × 10^(−0.0016 · deltaY), lines = 33 px, pages = 800 px, one event capped
at 200 px. After: one mouse notch (100 px or 3 Firefox lines) ≈ 1.45x, a 4 px
trackpad delta < 1.02x, symmetric in/out; `minZoom`/`maxZoom` and the zoom
buttons unchanged. Tests: `wheel-zoom.spec.ts` (fixed rate, notch, lines,
trackpad, cap) and `editor.e2e.ts` P-13 (1.4–1.5x per notch, back to 1,
gentle 4 px). Gate: `npm --prefix frontend run check && npm --prefix
frontend run lint && npm --prefix frontend test` — 0 errors, lint clean,
Vitest 252 + 25 passed, Playwright 120 passed.
