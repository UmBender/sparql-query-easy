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

| Scenario | What the page does | Covers |
|---|---|---|
| `fire-speed-at-least-90` | Fire-type Pokémon with speed of at least 90 (value variable filter), staged Run Query. | entity; variable; value variable with filter; at least (2); Run Query 1 stage + value variable; funnel counts (badge) |
| `run-query-two-stage-apply` | Members of the Charmander family and their types; choose Charizard, then Flying, Apply to graph. | entity; variable; Run Query 2 stages; choose and apply to graph; query after apply |
| `view-sparql-only` | Water-type Pokémon with speed at most 50 as a filtered value node; only View SPARQL. | entity; variable; value node with filter; at most (3); View SPARQL; funnel counts (badge) |
| `filter-exact-literal` | Grass-type Pokémon at evolution stage 3, the stage as an exact value node. | value node exact (no filterType); Run Query 1 stage |
| `filter-starts-with` | Pokémon whose label starts with "Char". | value node starts with (0); Run Query 1 stage |
| `filter-contains` | Pokémon whose category contains "Mouse". | value node contains (1); Run Query 1 stage |
| `numeric-profile-edit-between` | Water-type Pokémon with HP 80..100, set through Edit value and its histogram editor. | value node between (6); Edit value; histogram (numeric-profile); Run Query 1 stage |
| `filter-max-tie` | Electric-type Pokémon with the highest attack: Raichu and Zapdos tie at 90. | value node MAX (4); MAX tie (BE-004); staged Run Query rejects MAX (400); Run query node action (legacy /api/query) |
| `filter-min-tie` | Fighting-type Pokémon with the lowest attack: Mankey and Machop tie at 80. | value node MIN (5); MIN tie (BE-004); staged Run Query rejects MIN (400); Run query node action (legacy /api/query) |
| `value-variable-any` | Pikachu's speed through a value variable that keeps any value. | entity; value variable without filter; Run Query 1 variable (literal) |
| `value-variable-between-at-most` | Ghost-type Pokémon weighing 0..1 kg with HP at most 45, both as value-variable filters. | value variable between (6); value variable at most (3); Run Query 3 variables reordered |
| `value-variable-contains` | Pokémon whose category contains "Dragon", as a value-variable filter. | value variable contains (1); Run Query 1 stage |
| `text-suggestions-starts-with` | Psychic-type Pokémon named through a value variable: Starts with "Ka", pick the suggestion Kadabra. | value variable starts with (0); Edit filter; text suggestions (stage); suggestion becomes exact; Run Query 1 stage |
| `text-suggestions-contains` | A category value node edited to Contains "Flame"; suggestions use a stand-in variable. | value node contains (1); Edit value; text suggestions with a stand-in variable; Run Query 1 stage |
| `add-value-filter` | Add value filter on a Fire-type variable: choose speed, set at least 100. | Add value filter; value relations list (relationships); profile seed and histogram (numeric-profile); value variable at least (2); Run Query 1 stage + value variable |
| `class-explore-values` | Explore values of the Type class: properties whose domain is Type. | class; Explore values (legacy /api/query) |
| `explore-relationship-value` | Explore Pikachu's relationships and add its speed value. | entity; Explore relationships; relationship value node |
| `node-run-query-table` | Run query on the variable that evolves into Raichu, then choose Pikachu. | variable; Run query node action (legacy /api/query); results-table choice binds and refetches |
| `predicate-variable-edge` | Convert the Pikachu → Electric relation to a predicate variable and run it. | entity; predicate variable edge (FE-003); Convert relation to variable; Run Query 1 stage (predicate) |
| `run-query-three-reordered-assume` | Order ?type, ?next, ?pokemon; Assume ?type = Fire, then choose Charizard and Charmeleon and Apply. | Run Query 3 variables reordered; Assume; next query after Assume; choose and apply to graph |
| `funnel-step-off` | Water type, speed ≥ 80 and MAX attack as funnel steps; untick the speed step. | funnel counts (count); funnel step switched off; MAX after the other steps |
| `funnel-value-variable` | Grass type and a value variable HP ≥ 80 as funnel steps on ?pokemon. | value-variable filter as funnel step (FE-039); funnel counts (count); badge counts |
| `actual-value-check` | Pikachu's speed filtered at least 100 shows the actual value 90 and ✗. | fixed-entity subject: actual value chip and pass/fail badge (relationship-value) |
| `upload-local-graph` | Upload a three-Pokémon Turtle file, then stage the Fire-type ones. | Turtle upload (local-database); query on the uploaded graph |

## Coverage (QUAL-009)

| Item | Scenarios |
|---|---|
| Entity node | `fire-speed-at-least-90`, `explore-relationship-value`, `predicate-variable-edge`, `actual-value-check` |
| Variable node | most scenarios; `node-run-query-table` |
| Value node (literal) | `view-sparql-only`, `filter-*`, `numeric-profile-edit-between`, `text-suggestions-contains`, `funnel-step-off`, `actual-value-check` |
| Value variable with a filter / without | `fire-speed-at-least-90`, `value-variable-between-at-most`, `value-variable-contains`, `add-value-filter`, `funnel-value-variable` / `value-variable-any` |
| Class node | `class-explore-values` |
| Predicate variable edge (FE-003) | `predicate-variable-edge` |
| Value node: exact, starts with (0), contains (1), at least (2), at most (3), between (6), MAX (4), MIN (5), MAX/MIN tie | `filter-exact-literal`, `filter-starts-with`, `filter-contains`, `funnel-step-off`, `view-sparql-only`, `numeric-profile-edit-between`, `filter-max-tie`, `filter-min-tie` |
| Value variable: exact, starts with (0), contains (1), at least (2), at most (3), between (6) | `text-suggestions-starts-with` (exact after the suggestion; starts with in the suggestion request), `value-variable-contains`, `fire-speed-at-least-90`, `value-variable-between-at-most`. MAX/MIN are not offered on value variables. |
| Run Query: 1 variable; 2; 3+ reordered; choose per variable and Apply; next query | `value-variable-any`; `run-query-two-stage-apply`; `run-query-three-reordered-assume`, `value-variable-between-at-most`; `run-query-two-stage-apply`, `run-query-three-reordered-assume`; `run-query-three-reordered-assume` (Assume reopens Run Query) |
| Histogram (`numeric-profile`) | `numeric-profile-edit-between`, `add-value-filter` |
| Text suggestions (`stage`) | `text-suggestions-starts-with`, `text-suggestions-contains` |
| Funnel counts (`count`), a step switched off | `funnel-step-off`, `funnel-value-variable`; badges in every filtered scenario |
| Turtle upload then a query | `upload-local-graph` (`frontend-tests/fixtures/legacy-upload.ttl`) |

## Legacy behaviors these fixtures record

- Staged Run Query rejects MAX and MIN with 400 ("not supported in staged
  exploration"); their tied results come from the variable's Run query node
  action (`POST /api/query`, BE-004). See `filter-max-tie`, `filter-min-tie`.
- Explore values on a class node sends the prefixed predicate `rdfs:domain`,
  which Ktor rejects with 400, so the action shows "Query failed". See
  `class-explore-values`; the new app may send the full IRI (recorded in the
  parity checklist).
- View SPARQL with no variable left (after Apply or a results-table choice)
  sends `variableName: ""` and gets 400; the modal says "Could not generate
  query. Please try again."
- View SPARQL renders MAX/MIN value nodes as `str(?x) = "MAX"`, unlike
  `/api/query` (see `filter-max-tie.sparql`).
- Run Query stages variables in sorted name order unless reordered, so a
  value variable such as `?hp` comes before `?pokemon`.
