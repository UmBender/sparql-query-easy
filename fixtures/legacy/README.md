# Legacy frontend fixtures

Characterization goldens (QUAL-008, QUAL-009): what the legacy page
`sparql/index2.html` sends to and receives from the real Ktor backend on the
built-in `PokemonGen1` dataset. The SvelteKit app (FE-042–FE-048) must send
the same requests for the same graph. They are not a specification of what is
right: never edit them to silence a failure; investigate the page and the
oracle instead.

## Provenance

- Dataset: `src/main/resources/pokemon_gen1.ttl` (endpoint id `PokemonGen1`).
- Command: `npm run fixtures:legacy` (all scenarios, stale files deleted
  first) or `npm run fixtures:legacy -- --grep <name>` (one scenario). It
  builds the Ktor distribution, starts it on 127.0.0.1:18091 and drives the
  page in Firefox through `playwright.fixtures.config.mjs`; no external
  endpoint is contacted.
- Scenarios: `frontend-tests/fixtures-capture/scenarios.mjs`; each checks its
  result against an independent oracle read from the Turtle file
  (`pokemon-oracle.mjs`).
- First captured 2026-10-17 from the commit that adds QUAL-008. Regenerate
  after any legacy page or backend change and review the diff.

## Files per scenario

- `<name>.request.json`: every `/api/*` request in order, as
  `{method, path, body}` (a multipart upload lists its field names).
- `<name>.response.json`: the matching `{status, body}`, rows in received
  order; compare unordered rows as multisets.
- `<name>.sparql`: the text View SPARQL showed at the end of the scenario.

Background requests (filter badges, funnel counts) are recorded too: the
harness waits until the page is quiet after each action, so their order is
fixed. JSON keys are sorted. Normalized fields are listed in
`frontend-tests/fixtures-capture/normalize.mjs` (Date.now() ID suffixes,
uploaded-graph ids).

## Scenarios

| Scenario | Covers |
|---|---|
| `fire-speed-at-least-90` | entity, variable, value variable with At least (2), one-stage Run Query, badge counts |
| `two-stage-apply` | two-stage Run Query, choose, Apply to graph, View SPARQL after Apply (400: no variable left) |
| `view-sparql-only` | value node with At most (3), View SPARQL, badge counts |
