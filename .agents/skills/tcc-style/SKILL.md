---
name: tcc-style
description: Make any UI or CSS change in the SvelteKit frontend (frontend/) follow the design tokens, the base components and the /styleguide.
---
# tcc-style

Use for every visual change in `frontend/`: a new screen, component, color,
spacing, icon or graph style. Follow repository AGENTS.md and the selected
task; use `tcc-frontend` for behavior.

## Sources

- Values: `frontend/src/lib/design/tokens.ts`, the only place a color, size,
  radius, shadow or layer is written. After editing it run
  `npm --prefix frontend run tokens` to regenerate `tokens.generated.css`.
- Tailwind names: `frontend/src/lib/design/theme.css` maps the tokens to
  utilities (`bg-surface`, `text-muted-foreground`, `bg-node-entity`,
  `border-stage-border`, `shadow-md`, `z-(--z-menu)`, …).
- Graph look: `frontend/src/lib/design/cytoscape.ts` (`graphStylesheet`,
  `possibleGraphStylesheet`); elements carry `data(kind)` and state classes
  (`selected`, `rejected`, `emphasis`, `hover`).
- Visual reference: run `npm --prefix frontend run dev` and open
  `/styleguide`, which renders every token group and component in both themes.

## Token rules

1. Use a semantic utility from the Semantic colors group on `/styleguide`
   (`primary`, `secondary`, `accent`, `muted`, `success`, `warning`, `danger`,
   `brand`, `surface`), never a Tailwind palette color (`blue-600`) or a raw
   value. Raw hex outside `src/lib/design/` fails `npm run lint`.
2. Node and relation colors come from the Graph node kinds group; never
   restyle a kind locally. A new kind or state is a token plus a stylesheet
   rule, covered by `src/lib/design/tokens.spec.ts`.
3. Every color token has a light and a dark value; add both.
4. Sizes use the type scale, spacing, radii, shadows and layer groups shown on
   `/styleguide` (`text-sm`, `gap-2`, `rounded-md`, `shadow-md`,
   `z-(--z-panel)`); no pixel literals except intrinsic graph geometry.

## Which component

| Job | Component (`#lib/components/ui/...`) |
|---|---|
| Action | `button` (`default` for the main action, `secondary`/`outline` otherwise, `destructive` for removal) |
| Icon-only action | `icon-button` (its `label` is the accessible name and tooltip) |
| Text entry / choice | `input`, `select`, `radio-group`, `checkbox`, wrapped in `field` |
| Search with suggestions | `combobox` |
| Stage order and variable tokens | `chip` (`number` for stage chips, `emphasized` for the shared halo) |
| Counts and checks over nodes | `count-badge` |
| Floating region with a title | `panel` |
| Modal content (View SPARQL, filter editor) | `dialog` |
| Hints | `tooltip`; transient messages `toast` from `sonner` |
| Questionnaire scale | `rating-scale` |

Add a missing primitive with `npx shadcn-svelte@1.7.0 add <name>` and show it
on `/styleguide` in the same change.

## Layout

Compose with flex/grid and the spacing scale; panels float over the canvas
on wide screens and become full-width sheets on narrow ones (no horizontal
scroll at 360 px). Keep the graph canvas the largest region.

## Accessibility

AA contrast in both themes (the axe run on `/styleguide` checks the
components), a visible focus ring on everything interactive (the components
provide `focus-visible:ring-3`), an accessible name for every control and
region (`label`, `aria-label`, panel titles), and keyboard paths with Escape
closing only the element that has focus.

## Checklist before commit

- [ ] No raw color, Tailwind palette color or pixel size outside
      `src/lib/design/`; `npm --prefix frontend run lint` passes.
- [ ] Every color used is in the Semantic colors or Graph node kinds group.
- [ ] Each control is one of the components in the table above.
- [ ] New tokens or components appear on `/styleguide` in both themes.
- [ ] Focus ring, accessible names and keyboard path checked;
      `npm --prefix frontend test` (axe on `/styleguide`) passes.
