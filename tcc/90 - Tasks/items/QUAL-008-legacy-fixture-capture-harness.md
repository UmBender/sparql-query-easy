---
id: QUAL-008
title: Capture legacy request, response and SPARQL fixtures on PokemonGen1 with one command
status: BACKLOG
priority: P1
type: quality
depends_on: [QUAL-002, DATA-002]
human_gate: true
created: 2026-10-16
updated: 2026-10-16
---
# Capture legacy request, response and SPARQL fixtures on PokemonGen1 with one command

## Objective

T2, part 1 (user brief 2026-10-16). Record what `index2.html` sends to and
receives from the real Ktor backend, so the new frontend (FE-042–FE-048) can
be proven to send the same requests. This card builds the capture harness and
its regeneration command with three seed scenarios; QUAL-009 adds the full
corpus and QUAL-010 the format documentation. Skill: `tcc-test`.

Relation to existing work: QUAL-006 maps legacy behavior to tests (behavior
parity); this card records wire data (payload parity). QUAL-002 already
starts the built Ktor distribution on 127.0.0.1:18090 for the offline e2e
suite; the capture harness reuses that pattern. FE-001/QUAL-005 use a mocked
server (`frontend-tests/server.mjs`), so their payloads are not real backend
responses and are not reused as fixtures.

## Confirmed entry points

- `playwright.e2e.config.mjs` (installDist + Ktor on a fixed port, Firefox,
  offline), `frontend-tests/e2e/ordered-exploration.spec.mjs`.
- Built-in endpoint ID `PokemonGen1` (`EndpointContextResolver.kt`,
  `POKEMON_ENDPOINT_ID`), data in `src/main/resources/pokemon_gen1.ttl`.
- `sparql/app-core.js` declares `let cy` at top level; existing browser tests
  already reach it through `page.evaluate` (for example `cy.add(...)`), so a
  Cytoscape handle already exists for tests. `index2.html` has no
  `data-testid` attributes today.
- Routes: [[../../03 - Backend/API v1]]; flows: [[../../04 - Frontend/Request Flows]].

## Scope

- A separate Playwright config and spec for capture (proposed:
  `playwright.fixtures.config.mjs`, `frontend-tests/fixtures-capture/`) that
  starts the built Ktor distribution on its own port (proposed 18091), selects
  `PokemonGen1`, builds or loads each scenario in the legacy page, and records
  every `/api/*` request and response through Playwright network events.
- Output per scenario under `fixtures/legacy/`:
  - `<name>.request.json`: ordered list of `{method, path, body}` the page sent
    (multi-step scenarios produce several entries, in order);
  - `<name>.response.json`: the matching list of `{status, body}`;
  - `<name>.sparql`: the text shown by View SPARQL (`POST /api/query/sparql`).
  A short `fixtures/legacy/README.md` states provenance (commit, dataset,
  command, date) and that these are characterization goldens.
- One regeneration command (proposed `npm run fixtures:legacy`) that rebuilds
  every fixture from scratch and deletes stale ones.
- Deterministic output: stable JSON key order and indentation; any field that
  varies between runs is listed and normalized in one place, never dropped
  silently. Result rows keep their received order in the file; checks that
  compare them treat unordered rows as multisets.
- Seed scenarios: `fire-speed-at-least-90` (entity `pk:FireType` via
  `pk:hasType`, value variable on `pk:speed` with "at least" 90, Run Query),
  one two-stage Run Query with Apply to graph, and one View SPARQL only.
- Add the new paths and command to [[../../06 - Development/Operational Map]].

## Out of scope

- Changing legacy behavior or existing browser/e2e assertions.
- Legacy page edits (`data-testid`, a `window` Cytoscape handle) until
  decision D-T2a below is answered.
- Live Wikidata or any external endpoint; Wikidata entity search is not
  captured.
- The full scenario corpus (QUAL-009) and format docs (QUAL-010).
- Running the capture inside `npm run test:browser`.

## Pending decision D-T2a: test hooks in the legacy page

DEC-011 condition 2 says "the legacy page is not modified for the new app";
the T2 brief allows adding test hooks (`data-testid`, a window handle to
Cytoscape in test mode).

- Option A: no legacy edits. Use the existing global `cy` and current
  selectors (ids, classes, roles) as the 111 browser cases already do.
  Affects: nothing in `sparql/`; selectors may be more brittle.
- Option B: allow behavior-free hooks only (`data-testid` attributes on
  controls the capture uses), as an explicit exception to DEC-011 condition 2.
  Affects `sparql/index2.html`, possibly `StaticFrontendRoutesTest`, and the
  full browser gate.
- Recommendation: **A**. The `cy` handle the brief asks for already exists, so
  hooks add risk to the authoritative page with no new capability. Revisit
  with B only if a selector proves unstable during QUAL-009.

## Acceptance criteria

- [ ] `npm run fixtures:legacy` (or the command chosen) regenerates all
      fixtures from a clean `fixtures/legacy/` with Ktor started by the
      command itself; no external request is made (QUAL-003 rule).
- [ ] Running it twice in a row leaves `git diff --exit-code fixtures/legacy`
      clean, or only the documented normalized fields differ.
- [ ] `fire-speed-at-least-90` returns exactly `pk:Charizard`, `pk:Ninetales`,
      `pk:Arcanine`, `pk:Ponyta`, `pk:Rapidash`, `pk:Magmar`, `pk:Moltres`
      (independent oracle read from `pokemon_gen1.ttl`; 90 is inclusive),
      compared as a set.
- [ ] Each seed scenario has request, response and `.sparql` files; the
      two-stage one records the stage requests and the query after Apply.
- [ ] Existing gates stay green: `npm run test:browser`, `npm run test:e2e`.

## Validation

Focused: the capture command on one scenario (proposed `npm run
fixtures:legacy -- --grep fire`). Closing gate (frontend area, Operational
Map): `npm run test:browser`, `npm run test:e2e`, plus the regeneration
idempotence check above; docs check for the Operational Map change.

## Execution log

- 2026-10-16: Planned from the T2 brief; no code changed.
