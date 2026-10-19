---
id: FE-053
title: Let the query editor start from a given query and endpoint and host an extra panel
status: BACKLOG
priority: P1
type: refactor
depends_on: [FE-048, DEC-014]
human_gate: false
created: 2026-10-19
updated: 2026-10-19
---
# Let the query editor start from a given query and endpoint and host an extra panel

## Objective

T8 preparation. The task page (STUDY-003) must use the same editor as `/`,
not a copy, start empty or from the task's starting graph, keep the task's
endpoint, and show a task panel and a submit button. Today
`frontend/src/lib/features/editor/query-editor.svelte` builds its own
`QueryStore` with no arguments, so a caller can pass nothing in.
Skill: `tcc-refactor` (`tcc-style` for any markup change).

## Scope

- `QueryEditor` takes optional props: an initial `QueryDocument`
  (FE-042 saved format) or nothing (empty graph, as today); an endpoint and a
  flag that locks the endpoint picker; a snippet for an extra side panel and
  one for extra toolbar actions.
- The page can read the current graph (for submit) through a callback or a
  bindable store reference; no global state.
- `/` passes no props and behaves exactly as before.

Excluded: any study API call or study UI (STUDY-003/004); changing editor
behavior on `/`.

## Acceptance criteria

- [ ] `/` is unchanged: the existing Vitest, browser, screenshot and
      Playwright suites pass without edited oracles or screenshots.
- [ ] A component test mounts `QueryEditor` with the
      `fire-speed-at-least-90.query.json` fixture and a locked PokemonGen1
      endpoint: the graph shows that query, the endpoint picker is disabled,
      and the extra panel/toolbar snippets render.
- [ ] Two editors mounted one after the other do not share graph state.

## Validation

Focused: `npm --prefix frontend run test:unit -- query-editor`
(proposed name for the new spec). Closing gate: the new frontend gate
from the Operational Map.
