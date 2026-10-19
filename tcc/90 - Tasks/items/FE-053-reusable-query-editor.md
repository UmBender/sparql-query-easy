---
id: FE-053
title: Let the query editor start from a given query and endpoint and host an extra panel
status: DONE
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
endpoint, and show a task panel and a submit button. The admin task editor
(STUDY-006) uses it the same way to draw the reference and starting graphs. Today
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

- [x] `/` is unchanged: the existing Vitest, browser, screenshot and
      Playwright suites pass without edited oracles or screenshots.
- [x] A component test mounts `QueryEditor` with the
      `fire-speed-at-least-90.query.json` fixture and a locked PokemonGen1
      endpoint: the graph shows that query, the endpoint picker is disabled,
      and the extra panel/toolbar snippets render.
- [x] Two editors mounted one after the other do not share graph state.

## Validation

Focused: `npx vitest run --project client src/lib/features/editor`
(run in `frontend/`). Closing gate: the new frontend gate
from the Operational Map.

## Conclusion

- `query-editor.svelte` props: `initial` (QueryDocument), `endpoint` (wins
  over the document's), `lockEndpoint`, `panel` and `actions` snippets,
  `onready(store)`. Props are read once at creation (`untrack`); each editor
  builds its own `QueryStore`.
- `QueryStore` option `endpointLocked`: `setEndpoint` is a no-op and `load`
  keeps the endpoint. The toolbar disables the endpoint field (new
  `disabled` prop on the `combobox` primitive) and `file-actions.svelte`
  hides Upload Triples, which would replace the endpoint. Upload Query and
  Export Query stay.
- The side panel is an `aside` right of the canvas from `md` up (`w-96`),
  below it on narrow screens.
- Test: `query-editor.svelte.spec.ts` with `query-editor-harness.svelte`
  (query client and tooltip providers); `fetch` is stubbed to 503, so no
  network.

Validation (2026-10-19): new frontend gate (`check`, `lint`, `npm test`)
passes: Vitest 173 + 10 (3 new), Playwright 84, with screenshots and oracles
unchanged. No API change, so `test:stack` was not rerun (it passed for
AUTH-005 on the same backend).

Limitations: the guided tour still offers itself on a hosting page (it
remembers when it has been seen). Props are not reactive after creation.
