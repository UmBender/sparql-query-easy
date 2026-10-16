---
id: FE-041
title: Define design tokens, Tailwind and shadcn-svelte styling shared with Cytoscape, and a style skill
status: BACKLOG
priority: P1
type: frontend
depends_on: [FE-040]
human_gate: false
created: 2026-10-16
updated: 2026-10-16
---
# Define design tokens, Tailwind and shadcn-svelte styling shared with Cytoscape, and a style skill

## Objective

T3. One set of design tokens drives Tailwind, shadcn-svelte components and
the Cytoscape stylesheet, so node colors and UI colors never drift. Skill:
`tcc-frontend`.

## Scope

- Tokens (CSS variables + a TS export) for the node kinds: entity blue
  circle, variable green circle, value pink box, value variable green box
  with pink border, class yellow; plus UI colors, spacing, type, dark mode.
- Configure the Tailwind theme and shadcn-svelte (Bits UI) components from
  the tokens; both packages are already installed with defaults by FE-040.
- A pure function building the Cytoscape stylesheet from the tokens, unit-tested.
- A new repository skill `.agents/skills/tcc-style/SKILL.md` and its entry in
  `AGENTS.md`: how to use tokens/components and what not to hard-code.

Excluded: feature screens; installing Tailwind/shadcn-svelte and the
`frontend/` scaffold (FE-040).

## Acceptance criteria

- [ ] Changing one token changes both a component and the Cytoscape style (test).
- [ ] Node-kind colors match the legacy page (screenshot or value comparison).
- [ ] Skill passes `node scripts/check-project-docs.mjs` and `node scripts/check-skill-discovery.mjs`.

## Proposed amendment (2026-10-16, pending user confirmation)

The T3 brief duplicates this card (conflict rule DUPLICATE) for tokens,
theme and the Cytoscape stylesheet, and extends it with base components, a
`/styleguide` route and a Claude Code skill. It does not change the approved
scope above; apply only after the user confirms. The skill location
contradicts the brief and waits for decision D-T3a in
[[FE-051-style-skill]].

Additional scope:

- Tokens live in `frontend/src/lib/design/tokens.ts` (adds `src/lib/design`
  to the FE-040 layout) and are emitted as CSS variables from that module.
- Token set: light and dark palettes; semantic colors (surface, text,
  border, accent, success, warning, danger); each node kind's fill, border
  and text color; type scale, spacing, radii, shadows, z-index layers.
- No hard-coded color outside `src/lib/design/`: Tailwind theme and the
  shadcn-svelte theme variables read the tokens.
- The Cytoscape stylesheet builder (in `src/lib/design/`) also covers
  selected and hover states and edge labels.
- A check (ESLint rule or a small script wired into `npm --prefix frontend run
  lint`) that fails on raw hex colors in `frontend/src` outside
  `src/lib/design/`. The legacy `sparql/` files are not checked.

Moved out (proposed): base components and `/styleguide` go to
[[FE-050-base-components-and-styleguide]]; the style skill goes to
[[FE-051-style-skill]], because its checklist must match the styleguide.
This card's title would become "Define design tokens, Tailwind and
shadcn-svelte theme and the Cytoscape stylesheet from one source".

Additional acceptance criteria:

- [ ] A unit test changes one token and observes the change in both the
      generated CSS variables and the generated Cytoscape stylesheet.
- [ ] Light and dark token sets define the same keys (test).
- [ ] The hex-color check fails on a planted `#ff0000` in a component and
      passes on the clean tree.
