---
id: BUG-011
title: Searching a team name on a built-in dataset lists goals and matches but not the team
status: BACKLOG
priority: P2
type: bug
depends_on: []
human_gate: false
created: 2026-10-27
updated: 2026-10-27
---
# Searching a team name on a built-in dataset lists goals and matches but not the team

## Objective

Found while checking DOC-009 on `CampeonatoBrasileiro2023`: **Search nodes**
with "Santos", "Palmeiras" or "Grêmio" lists only goals and matches whose
label contains the name (e.g. "Palmeiras x Santos"), never the team itself
(`rdfs:label "Santos"@en`). Flamengo, Internacional and Corinthians happen to
work. Participants hit the same thing on any built-in graph where many
labels contain a short name. Skill: `tcc-backend`.

## Evidence

- `WikidataQueryGenerator.search` sends no text filter and no limit for a
  local graph: it selects every labelled entity with its parent type.
- `ResultFilteringService.search` (local) keeps labels that contain the
  text (case-insensitive), type `objetoClasse`, then `take(20)` in the
  endpoint's row order (C# `EndpointService.GetSearch` parity). Nothing ranks
  an exact or prefix match first, so the team can fall past the 20th row.
- Contract: [[../../03 - Backend/API v1#`POST /api/query/search`]] ("filtered
  to `objetoClasse` and capped at 20"); the order is not specified.

## Scope and acceptance

- On a local graph, an entity whose label equals the text (ignoring case)
  comes first, then labels starting with it, then labels containing it;
  ties keep a stable order (e.g. by label). Still at most 20, still only
  `objetoClasse`.
- Searching "Santos", "Palmeiras" and "Grêmio" on `CampeonatoBrasileiro2023`
  lists the team; existing PokemonGen1 searches (e.g. "Fire") still list
  their entity.
- Wikidata search (MediaWiki client) unchanged.
- Record the order in the API v1 search section and Current Contracts.

## Decision note

This deliberately departs from the C# `take(20)` row order. If C# search
parity must be kept, this needs a decision before READY.

## Validation

- Focused: a `ResultFilteringService` unit test with more than 20 matches
  where the exact label is last in row order; a route test on the built-in
  dataset for "Santos".
- Closing: the Kotlin gate from the Operational Map; the frontend gate only
  if the frontend changes.

## Conclusion
