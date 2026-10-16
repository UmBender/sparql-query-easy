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
