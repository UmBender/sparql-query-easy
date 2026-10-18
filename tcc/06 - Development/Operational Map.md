# Operational Map

Start with root AGENTS, the selected card and one skill. Follow the links below
when the task crosses that responsibility. This is the canonical command map.

| Responsibility | Entry point |
|---|---|
| Ktor bootstrap/config | `src/main/kotlin/com/example/sparqlqueryeasy/Application.kt`; `src/main/resources/application.conf`; settings from env/`.env` in `config/AppSettings.kt` (`.env.example`) |
| HTTP/JSON/OpenAPI | `src/main/kotlin/com/example/sparqlqueryeasy/http/{HttpModule,QueryHttpModels,OpenApiModule}.kt` |
| Services and endpoint/cache state | `src/main/kotlin/com/example/sparqlqueryeasy/application/` |
| RDF domain/ports/Jena | `src/main/kotlin/com/example/sparqlqueryeasy/{domain/model,rdf,rdf/jena}/` |
| SPARQL/remote and Wikidata search | `src/main/kotlin/com/example/sparqlqueryeasy/wikidata/{query,client,entitysearch}/` |
| Graph UI and its owner | `sparql/index2.html` (markup, DOMContentLoaded bootstrap: `cy` init) and classic scripts `app-core.js` (state, API, `runQuery`), `stage-order.js`, `stage-exploration.js`, `graph-nodes.js`, `graph-menus.js` (menus, connection, Alt+drag); pure modules `query-calculations.js`, `query-stages.js`, `graph-actions.js`, `graph-model.js`, `graph-binding.js` (headless-Cytoscape unit tests) |
| New SvelteKit frontend (DEC-011) | `frontend/`: `vite.config.ts` (adapter-static SPA fallback, dev proxy to 8080), design tokens `src/lib/design/` (`tokens.ts` → `tokens.generated.css` via `npm --prefix frontend run tokens`, `theme.css`, Cytoscape `cytoscape.ts`), `src/lib/{domain,stores,api,components,features}` (base components `components/ui/`, `/styleguide` route), `src/routes`, unit tests `src/**/*.spec.ts`, component tests `src/**/*.svelte.spec.ts` (Vitest browser mode, Firefox), offline Playwright `tests/*.e2e.ts` (guard `tests/support/offline.ts`, axe on `/styleguide`); see `frontend/README.md` |
| Browser oracles | `frontend-tests/index2.spec.mjs`, `server.mjs`, `cdn-stubs.mjs`, `external-assets.mjs`; end-to-end `frontend-tests/e2e/` with `fixtures/` |
| Legacy wire fixtures (QUAL-008) | `fixtures/legacy/` (README: provenance, scenarios), capture harness `frontend-tests/fixtures-capture/` (`scenarios.mjs`, independent `pokemon-oracle.mjs`, `normalize.mjs`), `playwright.fixtures.config.mjs` (Ktor on 18091), `scripts/capture-legacy-fixtures.mjs` |
| Kotlin tests/captures | `src/test/kotlin/`, `compatibility/expected/`, `compatibility/retirement-expected/` |
| Persistence (BE-005) | `persistence/PostgresDatabase.kt` (Hikari, Flyway, Exposed), `application/persistence/`, migrations `src/main/resources/db/migration/`; tests use embedded PostgreSQL 17 (`io.zonky.test`, binaries from a Maven artifact: no Docker or network) via `src/test/kotlin/.../persistence/TestPostgres.kt` |
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
| New frontend gate (FE-040) | `npm --prefix frontend run check && npm --prefix frontend run lint && npm --prefix frontend test` (Vitest, then build and offline Playwright smoke) |
| New frontend dev server | `npm --prefix frontend run dev` (port 5173, proxies `/api`, `/health`, `/openapi.json` to Ktor on 8080) |
| Ordered exploration end to end (builds and starts Ktor on port 18090; offline) | `npm run test:e2e` |
| Regenerate legacy fixtures (builds and starts Ktor on port 18091; offline) | `npm run fixtures:legacy` (one scenario: `npm run fixtures:legacy -- --grep <name>`); idempotence: run twice, `git diff --exit-code fixtures/legacy` |
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
- New frontend (`frontend/`): the new frontend gate; the legacy browser gate
  too when shared root files change. Add dependencies with
  `npx npm@11 install` (npm 10 fails in peer resolution); commit
  `frontend/package-lock.json`.
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
