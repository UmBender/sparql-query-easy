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
| New SvelteKit frontend (DEC-011) | `frontend/`: `vite.config.ts` (adapter-static SPA fallback, dev proxy to 8080), design tokens `src/lib/design/` (`tokens.ts` → `tokens.generated.css` via `npm --prefix frontend run tokens`, `theme.css`, Cytoscape `cytoscape.ts`), `src/lib/{domain,stores,api,components,features}` (base components `components/ui/`, `/styleguide` route), `src/routes`, unit tests `src/**/*.spec.ts`, component tests `src/**/*.svelte.spec.ts` (Vitest browser mode, Firefox), offline Playwright `tests/*.e2e.ts` (guard `tests/support/offline.ts`; page objects `tests/support/pages/` (`EditorPage` with node position, click, hover and drag helpers on the e2e hook, `TaskPage`, `QuestionnairePage`; QUAL-013), shared with `tests-stack/`; API mocks from the OpenAPI-typed `src/lib/api/mock-routes.ts`, shared with MSW in Vitest; axe on `/styleguide`, the editor and every main route in both themes (`tests/a11y.e2e.ts`, QUAL-015); canvas screenshots `tests/visual.e2e.ts` with baselines in `tests/visual.e2e.ts-snapshots/`; full-page screenshots of the main routes in both themes `tests/screens.e2e.ts` (QUAL-014; routes, sessions and typed data in `tests/support/screens.ts`, config `playwright.screens.config.ts`, run in the pinned image by `scripts/test-screens.mjs`, baselines in `tests/screens.e2e.ts-snapshots/`)), real-stack Playwright `tests-stack/` (PokemonGen1, live `/openapi.json` equals the snapshot); see `frontend/README.md` |
| Legacy wire fixtures (QUAL-008) | `fixtures/legacy/` (README: provenance, scenarios): requests and responses captured from the retired legacy page, the request-parity oracle of `frontend/src/lib/domain/request-parity.spec.ts`; loaded by name with `loadFixture`, replayed through MSW with `fixtureHandlers` and checked against the OpenAPI snapshot by `src/lib/testing/fixtures.spec.ts` (QUAL-012; helpers in `frontend/src/lib/testing/`); `node scripts/check-legacy-fixture-fields.mjs` checks every field is in Legacy Wire Format. The capture harness was removed in FE-049 (git history) |
| Kotlin tests/captures | `src/test/kotlin/`, `compatibility/expected/`, `compatibility/retirement-expected/` |
| Persistence (BE-005) | `persistence/PostgresDatabase.kt` (Hikari, Flyway, Exposed), `application/persistence/`, migrations `src/main/resources/db/migration/`; tests start one `postgres:17-alpine` container per test JVM through Testcontainers (DEC-012, QUAL-011; needs a reachable Docker daemon, fails naming Docker otherwise) via `src/test/kotlin/.../persistence/TestPostgres.kt` |
| CI (QUAL-007, QUAL-016) | `.github/workflows/ci.yml` (DEC-016 Q2 A): jobs `kotlin` (ktlint, detekt, test, with the OpenAPI snapshot contract), `frontend-fast` (check, lint, Vitest server with coverage and the contract/fixture checks, Vitest components) and `frontend-browser` (`test:e2e`, `test:screens`, `test:stack`, each pre-pulling its image). Every job on pull requests, pushes to `main`, the nightly schedule (03:17 UTC) and manual runs; a push to another branch skips `frontend-browser`. Artifact `playwright-reports` (HTML reports of e2e, screens and stack under `frontend/playwright-report/`) on every run, `test-results/` on failure; no deploy, no secrets |
| Accounts and sessions (AUTH-001) | `application/auth/` (`AuthService`, `AccountStore` port, `AttemptLimiter`), `security/Argon2PasswordHasher.kt` (BouncyCastle), `persistence/PostgresAccountStore.kt`, `http/AuthRoutes.kt` (cookie, Origin/JSON checks, `withSession` for protected routes), migration `V2__accounts.sql`; tests `AuthRoutesTest` (Testcontainers PostgreSQL), `AuthServiceTest` |
| Study consent and questionnaires (T9) | `src/main/resources/study/` (`study.json` manifest, `consent/v<n>.md`); `application/study/StudyConsent.kt`, `StudyResources.kt`, `persistence/PostgresConsentStore.kt`, `http/StudyConsentRoutes.kt` (`consented` gate in `StudyGates.kt`), migration `V9__study_consent.sql` (STUDY-008); `study/forms/*.json`, `application/study/Questionnaires.kt` (`FormDefinitions`, `FormAnswerValidator`), `QuestionnaireService.kt`, `persistence/PostgresFormStore.kt`, `http/StudyFormRoutes.kt`, `V10__study_forms.sql`, frontend `domain/forms.ts` (rules and Zod schema), `features/forms/` (paged form, one component per question type), shared fixtures `domain/fixtures/forms/parity.json` (STUDY-009); `persistence/PostgresFormResponseStore.kt`, `http/StudyGates.kt` (`consented`, `readyForTasks`), `V11__study_form_responses.sql`, frontend `features/forms/form-progress.ts`, `features/study/questionnaire-step.svelte` (STUDY-010); `application/study/FormResponsesCsv.kt`, `http/AdminFormRoutes.kt`, `/admin` download links (STUDY-011); frontend `features/study/consent-screen.svelte`; tests `StudyConsentRoutesTest`, `FormAnswerValidatorTest`, `FormDefinitionsTest`, `StudyFormRoutesTest`, `StudyFormResponseRoutesTest`, `FormResponsesCsvTest`, `AdminFormExportRoutesTest`, `domain/forms.spec.ts`, `features/forms/form-progress.spec.ts`, `features/forms/questionnaire-form.svelte.spec.ts`, `tests-stack/study-participant.e2e.ts`, `tests-stack/study-questionnaires.e2e.ts` (whole T9 flow) (`joinStudy` in `tests-stack/support.ts`) |
| Compose stack (OPS-006) | `compose.yaml` (db, backend, web), `compose.dev.yaml` (OPS-007: publishes only `db` on 127.0.0.1 for `./gradlew run`), `deploy/web.Dockerfile` (SPA build + Caddy), `deploy/Caddyfile` (mode `local`) and `deploy/caddy/` (`site.caddy`, modes `auto` and `proxy`, OPS-008), `backup` service (`deploy/backup.Dockerfile`, `deploy/backup/`, restore `scripts/restore-backup.sh`, OPS-009); smoke through Caddy (QUAL-017): `compose.test.yaml`, `deploy/compose-test.env`, `frontend/scripts/test-compose.mjs`, `frontend/playwright.compose.config.ts`, `frontend/tests-compose/`; runbook [[../07 - Operations/Docker Compose Stack]] |
| Packaging | `build.gradle.kts` processResources explicit frontend includes; `Dockerfile` |
| Work selection and cards | [[../90 - Tasks/TASKS]], [[../90 - Tasks/WORKER_PROMPT]], [[../90 - Tasks/FORMAT]] |

## Commands confirmed in repository

Run from repository root. JDK 21; Kotlin 2.2.20, Ktor 3.5.1, Jena 6.2.0 are
declared in build.gradle.kts; the frontend's tools (SvelteKit, Vitest,
Playwright 1.63.0) in `frontend/package.json`.
These are configured versions, not claims about a fresh successful build.

| Purpose | Command |
|---|---|
| Focused Kotlin | `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew test --tests 'com.example.sparqlqueryeasy.http.QueryRoutesTest' --no-daemon` (replace class with affected existing class) |
| Kotlin closing gate | `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon` |
| Format Kotlin when changed | `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat --no-daemon` then required checks |
| New frontend gate (FE-040) | `npm --prefix frontend run check && npm --prefix frontend run lint && npm --prefix frontend test` (Vitest, then build and offline Playwright smoke) |
| New frontend API types (FE-043) | After a route/schema change: `UPDATE_FRONTEND_OPENAPI=1 GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew test --tests 'com.example.sparqlqueryeasy.http.FrontendOpenApiSnapshotTest' --no-daemon`, then `npm --prefix frontend run api:types` |
| New frontend screenshots | Refresh only for an intended visual change: `(cd frontend && npx playwright test visual --update-snapshots)`, then review the PNG diff (labels and overlays are hidden: only canvas shapes and colours are compared) |
| New frontend screen screenshots (QUAL-014) | `npm --prefix frontend run test:screens` (needs Docker and `mcr.microsoft.com/playwright:v<@playwright/test version>-noble`; offline, no container network); refresh only for an intended change with `npm --prefix frontend run test:screens -- --update-snapshots`, then review each changed PNG; failures leave diffs in `frontend/test-results/screens/` |
| New frontend on the real stack (FE-046) | `npm --prefix frontend run test:stack` (builds Ktor and starts it on 18096 with an empty `postgres:17-alpine` container (`StackPostgres` via Testcontainers, test classpath via `writeStackPostgresClasspath`; the JDBC URL with Docker's mapped port goes through `build/stack-postgres.ready`; needs Docker), serves the e2e build through `vite preview` with `API_TARGET`; offline) |
| Compose smoke (QUAL-017) | `npm --prefix frontend run test:compose` (builds the images, starts the project `easyquery-test` on 127.0.0.1:18097 with a tmpfs database, runs `tests-compose/` through Caddy, then removes it; needs Docker Compose v2.24+ and network for the image builds) |
| HTTPS modes (OPS-008) | `node scripts/check-https-modes.mjs [auto] [proxy]` (throwaway projects `easyquery-https-<mode>` from `deploy/test/` with `compose.test.yaml`; curl checks of HTTPS, redirect, HSTS, `Secure` cookie, trusted-proxy client address; needs Docker Compose v2.24+ and curl) |
| Backup and restore drill (OPS-009) | `node scripts/check-backup-restore.mjs` (throwaway projects `easyquery-drill-a`/`-b` on 127.0.0.1:18200 with a temporary backup directory; retention, scheduled and failed dumps, encrypted copy, restore into a fresh stack with every table compared; needs Docker Compose v2.24+) |
| New frontend dev server | `npm --prefix frontend run dev` (port 5173, proxies `/api`, `/health`, `/openapi.json` to Ktor on 8080) |
| Distribution | `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew installDist --no-daemon` |
| Run | `./gradlew run` or `./build/install/sparql-query-easy-kotlin/bin/sparql-query-easy-kotlin` |
| Docs/skills | `node scripts/check-project-docs.mjs`; `git diff --check` |
| Task index text | `node scripts/check-project-docs.mjs --index` (stdout only; review/apply to TASKS.md) |
| Verify Codex discovery | `node scripts/check-skill-discovery.mjs` (local CLI diagnostic; no model request) |

## Closing gates by changed area

- Documentation/skills: changed links, YAML/task index/skill shape, instruction
  consistency, diff; validate skill discovery when changing the suite.
- Kotlin: focused checks while editing; ktlintCheck, detekt and test before commit.
- Frontend (`frontend/`): the new frontend gate; `test:screens` when a page,
  component, style or token changes; `test:stack` when API calls,
  accounts, saved queries or exploration change.
- CI (`.github/workflows/ci.yml`): the Kotlin and frontend gates plus
  `test:screens` and `test:stack`, and `test:compose` for its job; change the workflow with the
  gate it runs. Add dependencies with
  `npx npm@11 install` (npm 10 fails in peer resolution); commit
  `frontend/package-lock.json`.
- HTTP/fullstack: union of Kotlin/frontend gates; OpenAPI and capture tests are
  already included in Gradle test. Do not weaken their assertions. Changes to
  staged exploration or `POST /api/query/stage` also run `test:stack`.
- Packaging/assets/dependencies: relevant area gates plus installDist and a local
  smoke of the built distribution (`test:stack` does both); Compose, image
  or Caddy changes run `test:compose` (QUAL-017); Caddyfile or `web` port/env changes also run `node scripts/check-https-modes.mjs`; `backup` service or `deploy/backup/` changes run `node scripts/check-backup-restore.mjs`.
- No product tests are required for purely operational documentation changes.

Dependencies must already be available; gates do not authorize installation or
live Wikidata. Report environment failures distinctly. The browser suites
reject unexpected external requests (`frontend/tests/support/offline.ts`).

## Canonical facts and navigation

- Current decisions/contracts: [[../09 - Decisions/Current Contracts]].
- Test layers, helpers, fixtures, screenshot updates and CI tiers:
  [[../08 - Quality/Testing Guide]] (DOC-004).
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

`AGENTS.md`, `build.gradle.kts`, `frontend/package.json`, `src/main/resources/application.conf`.
