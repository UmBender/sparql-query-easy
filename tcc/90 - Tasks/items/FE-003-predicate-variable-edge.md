---
id: FE-003
title: Let users convert a graph relation into a projected predicate variable
status: REVIEW
priority: P1
type: frontend
depends_on: [API-001, FE-002]
human_gate: false
created: 2026-09-27
updated: 2026-09-27
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

- [ ] A user can left-click an edge and select **Convert relation to variable**.
- [ ] The converted edge preserves its topology/metadata and holds a valid
      `?predicate_…` value used by query construction.
- [ ] Running the graph submits a general-query request that projects the edge
      predicate variable while retaining its known subject and object.
- [ ] Node action-list behavior and graph-background-only dismissal remain
      intact.
- [ ] Playwright coverage is deterministic and offline; Kotlin quality checks
      and browser tests pass.
- [ ] Frontend architecture/request-flow documentation is updated.

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

## Source files

- `sparql/index2.html`
- `frontend-tests/index2.spec.mjs`
- `frontend-tests/server.mjs`
- `src/main/kotlin/com/example/sparqlqueryeasy/http/QueryHttpModels.kt`
- `src/main/kotlin/com/example/sparqlqueryeasy/wikidata/query/WikidataQueryGenerator.kt`
