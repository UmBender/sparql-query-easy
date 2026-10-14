---
id: FE-038
title: Suggest matching text values while typing a filter, like Search nodes
status: DONE
priority: P1
type: frontend
depends_on: [FE-034]
human_gate: false
created: 2026-10-14
updated: 2026-10-14
---
# Suggest matching text values while typing a filter, like Search nodes

## Objective

User request (2026-10-14): when filtering by text, show the possible values
while typing, as the Search nodes field does.

## Decisions (user, 2026-10-14: the recommended options)

1. Both editors: the value variable's **Edit filter** and **Edit value** on a
   value node. The node needs exactly one relation from a fixed predicate
   (the histogram's rule).
2. Matching follows the filter type: **Starts with** lists values starting
   with the text; any other type lists values containing it.
3. Case-sensitive, like the filter that will be applied.
4. Choosing a suggestion fills the input with that value and selects
   **Exact match**; the type can still change before Apply.

## Contract

- No API change. 400 ms after typing, the editor sends `POST /api/query/stage`
  (`textSuggestionRequest`, `query-calculations.js`):
  - `variableName` is the value variable itself, or the stand-in
    `?suggestedValue` that replaces a value node in that relation;
  - `where` is the rest of the query;
  - `variableFilters` holds the other value variables' filters and, for the
    suggested variable, Starts with (0) or Contains (1) on the typed text
    (FE-034);
  - `limit` is 20.
- The list shows the distinct literal texts (`suggestedTexts`), with a status
  line for empty or failed results. A newer request aborts an older one, and
  stale answers are ignored. An empty text hides the list and sends nothing.
  Arrow Down moves from the input into the list.

## Result

- 2026-10-14: implemented as above in `graph-nodes.js`
  (`attachFilterSuggestions`), `app-core.js` (`textSuggestionRequestFor`),
  `query-calculations.js` and `index2.css`.
- Tests:
  - unit tests for the request and the texts;
  - two FE-038 browser tests (value variable with Starts with, debounce,
    choice → Exact match; value node with Contains, empty, failure and
    cleared text);
  - `VariableFilterRoutesTest` on PokemonGen1: `Mouse` suggests
    `Mouse Pokémon`@en, and `mouse` suggests nothing.
