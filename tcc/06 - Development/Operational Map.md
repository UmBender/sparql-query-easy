# Operational Map

Start with root AGENTS, the selected card and one skill. Follow the links below
when the task crosses that responsibility. This is the canonical command map.

| Responsibility | Entry point |
|---|---|
| Ktor bootstrap/config | `src/main/kotlin/com/example/sparqlqueryeasy/Application.kt`; `src/main/resources/application.conf` |
| HTTP/JSON/OpenAPI | `src/main/kotlin/com/example/sparqlqueryeasy/http/{HttpModule,QueryHttpModels,OpenApiModule}.kt` |
| Services and endpoint/cache state | `src/main/kotlin/com/example/sparqlqueryeasy/application/` |
| RDF domain/ports/Jena | `src/main/kotlin/com/example/sparqlqueryeasy/{domain/model,rdf,rdf/jena}/` |
| SPARQL/remote and Wikidata search | `src/main/kotlin/com/example/sparqlqueryeasy/wikidata/{query,client,entitysearch}/` |
| Graph UI and its owner | `sparql/index2.html` (markup, DOMContentLoaded bootstrap: `cy` init) and classic scripts `app-core.js` (state, API, `runQuery`), `stage-order.js`, `stage-exploration.js`, `graph-nodes.js`, `graph-menus.js` (menus, connection, Alt+drag); pure modules `query-calculations.js`, `query-stages.js`, `graph-actions.js` |
| Browser oracles | `frontend-tests/index2.spec.mjs`, `server.mjs`, `cdn-stubs.mjs`, `external-assets.mjs`; end-to-end `frontend-tests/e2e/` with `fixtures/` |
| Kotlin tests/captures | `src/test/kotlin/`, `compatibility/expected/`, `compatibility/retirement-expected/` |
| Packaging | `build.gradle.kts` processResources explicit frontend includes; `Dockerfile` |
| Work selection and cards | [[../90 - Tasks/TASKS]], [[../90 - Tasks/WORKER_PROMPT]], [[../90 - Tasks/FORMAT]] |

## Commands confirmed in repository

Run from repository root. JDK 21; Kotlin 2.2.20, Ktor 3.5.1, Jena 6.2.0 are
declared in build.gradle.kts. npm has Playwright 1.63.0 and a checked-JavaScript
query-module pilot.
These are configured versions, not claims about a fresh successful build.

| Purpose | Command |
|---|---|
| Focused Kotlin | `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew test --tests 'com.example.sparqlqueryeasy.http.QueryRoutesTest' --no-daemon` (replace class with affected existing class) |
| Kotlin closing gate | `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon` |
| Format Kotlin when changed | `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat --no-daemon` then required checks |
| Focused browser | `npm run test:browser -- --grep 'predicate'` (choose existing test title) |
| Pure query calculations | `npm run test:query` |
| Checked JavaScript boundary | `npm run check:frontend-types` |
| Browser closing gate | `npm run test:browser` |
| Ordered exploration end to end (builds and starts Ktor on port 18090; offline) | `npm run test:e2e` |
| Distribution | `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew installDist --no-daemon` |
| Run | `./gradlew run` or `./build/install/sparql-query-easy-kotlin/bin/sparql-query-easy-kotlin` |
| Docs/skills | `node scripts/check-project-docs.mjs`; `git diff --check` |
| Task index text | `node scripts/check-project-docs.mjs --index` (stdout only; review/apply to TASKS.md) |
| Verify Codex discovery | `node scripts/check-skill-discovery.mjs` (local CLI diagnostic; no model request) |

## Closing gates by changed area

- Documentation/skills: changed links, YAML/task index/skill shape, instruction
  consistency, diff; validate skill discovery when changing the suite.
- Kotlin: focused checks while editing; ktlintCheck, detekt and test before commit.
- Frontend: focused browser case while editing; complete browser suite before
  commit, plus pure query tests and the type checker when query code changes.
- HTTP/fullstack: union of Kotlin/browser gates; OpenAPI and capture tests are
  already included in Gradle test. Do not weaken their assertions. Changes to
  staged exploration or `POST /api/query/stage` also run `npm run test:e2e`.
- Packaging/assets/dependencies: relevant area gates plus installDist and a local
  HTTP/static-resource smoke of the built distribution.
- No product tests are required for purely operational documentation changes.

Dependencies must already be available; gates do not authorize installation or
live Wikidata. Report environment failures distinctly. The browser harness
rejects unexpected external requests and uses local deterministic JavaScript,
CSS, logo and icon-layout fixtures. This does not vendor production assets.

## Canonical facts and navigation

- Current decisions/contracts: [[../09 - Decisions/Current Contracts]].
- Detailed HTTP: [[../03 - Backend/API v1]].
- Detailed graph interactions: [[../04 - Frontend/Frontend Architecture]],
  [[../04 - Frontend/Two Variable Exploration Contract]].
- Frontend evolution recommendation: [[../04 - Frontend/Frontend Evolution Audit]].
- Runtime/deployment: [[../07 - Operations/Local JVM and Container Runtime]].
- Migration evidence: relevant sections of root MIGRATION.md/MIGRATION_REPORT.md;
  capture provenance remains in compatibility/cases/capture-status.tsv.
- DEV-001 decision/calibration: [[../09 - Decisions/Development Workflow]],
  [[Development Calibration]].

Avoid duplicating these sources in each task. No validation wrapper is added:
the existing commands are short, and a wrapper would not reduce real repetition.

## Source files

`AGENTS.md`, `build.gradle.kts`, `package.json`, `playwright.config.mjs`,
`frontend-tests/index2.spec.mjs`, `src/main/resources/application.conf`.
