---
id: FE-003
title: Let users convert a graph relation into a projected predicate variable
status: DONE
priority: P1
type: frontend
depends_on: [API-001, FE-002]
human_gate: false
created: 2026-09-27
updated: 2026-09-28
---
# Let users convert a graph relation into a projected predicate variable

## Objective

Expose the existing general-query capability for a variable predicate through
an intentional frontend edge interaction, so a user can query which predicate
connects known subject and object values.

## Evidence and relevant files

- General-query request parsing accepts a `?variable` predicate.
- The Kotlin generator emits `TriplePattern.predicate` directly.
- The frontend's connection-discovery helper already performs an internal
  subject–`?predicate`–object query but has no user-visible edge conversion.
- The current persistent action menu applies only to nodes.

## Exact scope

- Implement the approved interaction in [[../../04 - Frontend/Predicate Variable Edge Contract]].
- Add an edge-specific accessible action list opened by left-clicking an edge.
- Add **Convert relation to variable**. Preserve source/target, edge identity,
  and non-predicate metadata while replacing the edge predicate with a valid,
  collision-safe SPARQL variable and visible `?` label.
- Ensure graph-query construction recognizes the edge predicate variable as the
  projected `variableName` and sends the fixed subject/variable predicate/fixed
  object pattern to the existing `POST /api/query` route.
- Add deterministic Playwright coverage that asserts the exact request body,
  resulting UI state, node-menu preservation, and background dismissal.
- Update frontend request-flow and architecture documentation.

## Explicitly out of scope

- New backend HTTP routes, RDF/Jena changes, C# baseline changes, or live
  Wikidata tests.
- Changing the existing request shape or general-query response mapping.
- Designing multi-variable query selection beyond any minimal deterministic
  guard needed by this interaction.

## Dependencies

- `API-001` documents the general-query request contract.
- `FE-002` establishes the persistent left-click action-list pattern.

## Acceptance criteria

- [x] A user can left-click an edge and select **Convert relation to variable**.
- [x] The converted edge preserves its topology/metadata and holds a valid
      `?predicate_…` value used by query construction.
- [x] Running the graph submits a general-query request that projects the edge
      predicate variable while retaining its known subject and object.
- [x] Node action-list behavior and graph-background-only dismissal remain
      intact.
- [x] Playwright coverage is deterministic and offline; Kotlin quality checks
      and browser tests pass.
- [x] Frontend architecture/request-flow documentation is updated.

## Verification commands

```sh
npm run test:browser
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew \
  ktlintCheck detekt test --no-daemon
git diff --check
```

## Expected documentation updates

- `tcc/04 - Frontend/Predicate Variable Edge Contract.md`
- `tcc/04 - Frontend/Frontend Architecture.md`
- `tcc/04 - Frontend/Request Flows.md`
- `tcc/90 - Tasks/TASKS.md`

## Risks

The graph builder currently finds a project variable by scanning graph items.
An edge predicate variable must be selected deterministically and must not
cause a node-only menu action or silently project the wrong variable.

## Execution log

- 2026-09-27: Created after source review established that Kotlin already
  supports variable predicates and that the frontend uses the capability only
  internally. Stakeholder approved exposing it as an edge interaction.
- 2026-09-27: Started implementation in the isolated
  `feature/predicate-variable-edge` branch.
- 2026-09-27: Implemented and committed in isolated branch
  `feature/predicate-variable-edge`, commit `59a95f75cfe4dde67543e7f7ff24bbcaaafd63af`.
  Kotlin's complete `ktlintCheck detekt test` gate and `git diff --check`
  passed. `npm run test:browser` could not run because Playwright is not
  installed in that worktree; no dependency was installed. Status is `REVIEW`
  pending integration and the required browser-test execution in an environment
  with the committed Node dependencies available.
- 2026-09-27: Integrated as merge commit `62b3eaf` on `kotlin`. The integrated
  Kotlin quality gate and JavaScript syntax check passed. Remains `REVIEW`
  solely because the required Playwright browser run cannot start without its
  uninstalled dependency; no dependency was installed during integration.

- 2026-09-28: Human review accepted the implemented behavior. The last
  blocking evidence gap closed with QUAL-003 (browser suite 23/23 under the
  external-request guard; Kotlin quality gate passed at commit `31f6624`).
  No code changed during closure. Status DONE.

## Predicate-result follow-up (2026-09-27)

2026-09-28 offline-test follow-up: QUAL-003 now rejects unexpected external
browser traffic and supplies local deterministic CSS/font-layout fixtures.
The full 23-case browser suite and Kotlin quality gate pass with the current
predicate-variable behavior. This removes the historical browser-egress
limitation; this card remains REVIEW for its existing human validation.

The result-selection path still used node replacement after predicate queries.
A nonempty mocked result reproduced an extra node while the edge remained a
variable. Predicate results now bind the existing edge in place, preserving
its topology and metadata and clearing the variable marker. Result rows retain
edge IDs and ignore removed or rebound edges. Ordinary node-result selection
is also covered.

The first full browser run reported 12 passed and an existing FE-004 fixture
failure: it declared three variables while expecting the exactly-two-variable
panel. The related parallel-predicate follow-up corrected that fixture to
contain exactly two variables; the production exactly-two guard is preserved.
The complete Kotlin `ktlintCheck detekt test` gate passes. Existing installed
Playwright/Firefox were reused without installing dependencies. API responses
are mocked; the existing browser harness still loads CDN styles/fonts.

Final validation passed: all 17 browser tests, all 107 Kotlin tests with
`ktlintCheck detekt`, JavaScript syntax checks, and `git diff --check`.

## Review follow-up (2026-09-27)

The predicate-edge browser test now asserts the complete `POST /api/query` JSON
body, including explicit `endpointUrl` and `limit` values, with exact equality.
A focused run of that test passed under the attempted local CSS stub.

An attempted test-only external-request block exposed a browser-layout
dependency on Materialize CSS. A small local CSS stub made the focused FE-003
test pass, but the full browser run failed an existing node-menu click test:
the menu stayed hidden. The incomplete CSS stub and network block were removed
to preserve the established interaction tests. FE-003 remains `REVIEW` until
the browser suite can be shown to run deterministically without external
assets. No production code or compatibility expectation was changed.

## Source files

- `sparql/index2.html`
- `frontend-tests/index2.spec.mjs`
- `frontend-tests/server.mjs`
- `src/main/kotlin/com/example/sparqlqueryeasy/http/QueryHttpModels.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/wikidata/query/WikidataQueryGenerator.kt`
