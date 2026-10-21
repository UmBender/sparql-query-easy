---
id: FE-056
title: Show variables with readable names and make the exploration order clearer
status: DONE
priority: P1
type: frontend
depends_on: []
human_gate: false
created: 2026-10-21
updated: 2026-10-21
---
# Show variables with readable names and make the exploration order clearer

## Objective

User request (2026-10-21): the stage order showed generated names such as
`?node_1760012341877` in orange monospace chips with ◀ ▶ buttons, and the
canvas showed every variable as `?`, which a non-developer cannot read or
match. The approved proposal (design mockup in this session): readable
names everywhere, a calmer numbered order with a Change order list, and the
exploration panel as a list of steps. Recommended scope accepted: display
names only (SPARQL keeps the real names), no user renaming yet. Skills:
`tcc-frontend`, `tcc-style`.

## Scope and acceptance

- `variableNames(graph)` (`frontend/src/lib/domain/variable-names.ts`): a
  given name without `?`; else the class label; else the fixed relation
  leading to it ("has"/"is" dropped, capitalised); else Item A/B or
  Relation A/B by age; taken labels numbered. Each name has a short
  description of its relations. Vitest covers every rule.
- Canvas: a variable labelled `?` shows its name, also before a value
  variable's filter (`speed ≥ 90`); stored labels are unchanged.
- Toolbar: numbered neutral chips with an orange number, joined by arrows,
  and **Change order** opening a list (grip, number, name, description,
  Move earlier/later, pointer drag, hover emphasis, live announcement).
- Panel "Find matching values": steps in order; finished steps show their
  value and **Change** (back to that step); the current step keeps loading,
  error/retry, Load more, preview and Assume; later steps wait.
- Names also in the possible graph, the funnel and the study/admin answer
  variable choice. `/help`, tour text and help images updated.
- Requests, saved queries, View SPARQL and exports are unchanged.

## Conclusion

- `Exploration.back(stage)` returns to any earlier stage.
- Commands: `npm --prefix frontend run check`, `run lint`, `test` (Playwright
  116 pass), `run test:screens` (22 pass after refreshing help and
  styleguide baselines), `run test:stack` (20 pass), `run help:screens`;
  canvas visual baselines refreshed (same shapes and colours, the fit moved
  with the new label sizes).
- Limitations: names cannot be edited yet (needs a saved-format decision);
  after Assume or Apply the remaining names are derived from the changed
  graph, so a fallback letter can shift; the `stageBorder` and `stageNumber`
  tokens are no longer used by the chip.
