---
id: FE-050
title: Build the token-styled base components and a /styleguide route in both themes
status: DONE
priority: P1
type: frontend
depends_on: [FE-041]
human_gate: false
created: 2026-10-16
updated: 2026-10-17
---
# Build the token-styled base components and a /styleguide route in both themes

## Objective

T3 part 2 (follow-up of FE-041, conflict rule EXTENDS). Feature cards build
screens from one small component set styled only through the FE-041 tokens,
and a developer can see every token and component in light and dark themes
on one page. Skill: `tcc-frontend`. Stack: [[DEC-011-frontend-stack-decision]].

## Scope

- Components in `frontend/src/lib/components/ui/` on top of shadcn-svelte
  (Bits UI): Button, IconButton, Input, Select, Combobox, Chip (including the
  numbered variable-order chip), Badge (kept/total and pass/fail variants),
  Panel, Dialog, Tooltip, Toast, a rating scale and form field wrappers
  (label, description, error) usable with Superforms + Zod.
- Each component has visible focus, an accessible name and AA contrast in
  both themes; colors only through tokens (FE-041 hex check passes).
- `/styleguide` route: every token group (palettes, semantic colors, node
  kinds rendered on a small Cytoscape canvas, type, spacing, radii, shadows,
  z-index) and every component and variant, with a light/dark toggle.
- Short component tests (Vitest; browser mode if FE-040 provides it) for the
  variants with behavior: numbered chip, Badge variants, rating scale value,
  field wrapper error display.

Excluded: feature screens and their wiring (FE-044–FE-048, AUTH-003,
STUDY-001/002); the screenshot and axe CI layers (QUAL-007, which may use
`/styleguide` as a target); the style skill (FE-051).

## Dependencies

FE-041 (tokens, theme, Cytoscape stylesheet), which depends on FE-040.

## Acceptance criteria

- [x] `/styleguide` shows every token group and every listed component and
      variant in both themes; switching theme needs no reload.
- [x] Changing one node-kind token changes both the `/styleguide` canvas node
      and the matching Chip/Badge (manual check plus the FE-041 unit test).
- [x] Every interactive component is reachable by keyboard with a visible
      focus ring; an `@axe-core/playwright` run on `/styleguide` (proposed,
      offline) reports no violations in either theme.
- [x] The FE-041 hex-color check passes; `check`, `lint`, `test` pass.
- [x] Legacy gates unchanged: `npm run test:browser` still passes.

## Validation

Proposed `npm --prefix frontend run check|lint|test` (created by FE-040);
legacy `npm run test:browser`; docs check.

## Execution log

- 2026-10-17: Added shadcn-svelte primitives (button, input, label, select,
  dialog, tooltip, sonner, popover, command, checkbox, radio-group, badge,
  separator) and app components in `src/lib/components/ui/`: `icon-button`
  (accessible name doubles as tooltip), `combobox` (ARIA 1.2, caller-owned
  items), `chip` (numbered stage variant, emphasis halo), `count-badge`
  (kept/empty/pass/fail/loading/error), `panel`, `rating-scale`, `field`
  (Superforms error arrays). Layout mounts ModeWatcher, the toaster and the
  tooltip provider. `/styleguide` shows palettes, semantic colors, a
  Cytoscape canvas with every node kind from the token stylesheet, type,
  spacing, radii, shadows, layers and every component, with a theme toggle.
  Dependencies: cytoscape, zod, sveltekit-superforms, @axe-core/playwright,
  Vitest browser mode (vitest 4.1.12: 4.1.8 had advisories
  GHSA-p63j-vcc4-9vmv/GHSA-82fw-gwwq-j7x9; `npm audit` clean). Tests: 4
  component tests (numbered chip, badge variants, rating value, field errors)
  in Firefox; Playwright: token groups and theme switch without reload,
  keyboard focus ring, axe with no violations in light and dark. Validation:
  `npm --prefix frontend run check`, `lint`, `test` (14 Vitest, 5
  Playwright). Legacy files unchanged. Completion commit for this task.
