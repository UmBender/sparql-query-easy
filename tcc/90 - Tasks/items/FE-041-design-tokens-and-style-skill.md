---
id: FE-041
title: Define design tokens, Tailwind and shadcn-svelte theme and the Cytoscape stylesheet from one source
status: DONE
priority: P1
type: frontend
depends_on: [FE-040]
human_gate: false
created: 2026-10-16
updated: 2026-10-17
---
# Define design tokens, Tailwind and shadcn-svelte theme and the Cytoscape stylesheet from one source

## Objective

T3 part 1. One set of design tokens drives Tailwind, shadcn-svelte components
and the Cytoscape stylesheet, so node colors and UI colors never drift. Skill:
`tcc-frontend`.

## Scope

- Tokens in `frontend/src/lib/design/tokens.ts` (adds `src/lib/design` to
  the FE-040 layout), emitted as CSS variables from that module.
- Token set: light and dark palettes; semantic colors (surface, text,
  border, accent, success, warning, danger); each node kind's fill, border
  and text color (entity blue circle, variable green circle, value pink box,
  value variable green box with pink border, class yellow); type scale,
  spacing, radii, shadows, z-index layers.
- Configure the Tailwind theme and the shadcn-svelte (Bits UI) theme
  variables from the tokens; both packages are already installed with
  defaults by FE-040. No hard-coded color outside `src/lib/design/`.
- A pure function in `src/lib/design/` building the Cytoscape stylesheet from
  the tokens: node kinds, selected and hover states, edge labels; unit-tested.
- A check (ESLint rule or a small script wired into `npm --prefix frontend run
  lint`) that fails on raw hex colors in `frontend/src` outside
  `src/lib/design/`. The legacy `sparql/` files are not checked.

Excluded: feature screens; installing Tailwind/shadcn-svelte and the
`frontend/` scaffold (FE-040); base components and `/styleguide`
([[FE-050-base-components-and-styleguide]]); the style skill
([[FE-051-style-skill]]).

## Acceptance criteria

- [x] A unit test changes one token and observes the change in both the
      generated CSS variables and the generated Cytoscape stylesheet.
- [x] Light and dark token sets define the same keys (test).
- [x] Node-kind colors match the legacy page (screenshot or value comparison).
- [x] The hex-color check fails on a planted `#ff0000` in a component and
      passes on the clean tree.

## Validation

Proposed `npm --prefix frontend run check|lint|test` (created by FE-040);
legacy `npm run test:browser`; docs check.

## Execution log

- 2026-10-16: User confirmed the T3 brief additions (full token set,
  `tokens.ts` path, hover/selected/edge-label styles, hex-color check) and
  they were merged into scope. Components and `/styleguide` moved to FE-050,
  the style skill to FE-051 (location decided there, D-T3a).
- 2026-10-17: Added `frontend/src/lib/design/`: `tokens.ts` (light/dark
  semantic palettes with shadcn aliases, node kinds with the legacy values,
  edge, selection, rejection, possible-graph states, type, spacing, radii,
  shadows, z-index), `css.ts` (CSS variables; `tokens.generated.css` is
  written by `npm run tokens` and a unit test fails when it drifts),
  `theme.css` (Tailwind `@theme inline` mapping, no values) and
  `cytoscape.ts` (main and possible-graph stylesheets keyed by
  `data(kind)` and state classes). `layout.css` now only imports the theme;
  the shadcn default oklch values were removed. `scripts/check-raw-colors.mjs`
  is part of `npm run lint`. Tests: same keys in both palettes; one changed
  token reaches the CSS and both stylesheets; node colors, value-variable
  border and shapes equal the legacy `graph-model.js` functions (live import,
  to be replaced at FE-049); a planted `#ff0000` fails the check and the tree
  passes. Validation: `npm --prefix frontend run check`, `lint`, `test`
  (10 Vitest, 1 Playwright) pass. Legacy files unchanged. Completion commit
  for this task.
