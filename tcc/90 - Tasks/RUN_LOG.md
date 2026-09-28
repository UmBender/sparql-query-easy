# Task Worker Run Log

## 2026-09-27 — Ordered multi-variable query planning only

- User requested a numbered, reorderable Scratch-like query menu beside Run
  Query for 2+ variables, with hover/focus preview of the next variable under
  a candidate assumption. User also paused implementation until revising
  `AGENTS.md`, tests, branches, and per-task commits.
- Inspected current `index2.html`, browser tests, Kotlin one-variable query
  request/response, existing DEC-008 and FE-004/005/006 cards. Created
  process/contract/investigation/backend/frontend/quality cards and dependency
  gates; expanded DEC-008 and FE-005/006. No application code, tests, Git
  branches, or deployment state changed.

## 2026-09-27 — MIG-002 publication decision

- Compared the staged removal with the approved 24-file manifest and confirmed
  exactly 24 C# solution/project/harness paths are deleted. The user requested
  commit and push after the local deletion review.
- Committed the approved JSON health contract, tests, and archived .NET
  workflow separately as pre-removal rollback anchor `03d8057`. The removal
  and current documentation form the next, separately reversible commit.
- `git diff --check` and `git diff --cached --check` passed. The post-deletion
  Kotlin, browser, and HTTP smoke results recorded below remain the final
  application verification. No deployment was performed.

## 2026-09-27 — MIG-002 C# removal preflight

- Inspected the 19 tracked C# application files, solution, four harness
  files, Gradle/Docker references, source-data files, fixture indexes, and
  provenance ledger. The 34 original plus three retirement capture IDs
  matched the 37 ledger IDs; result files were unchanged. Built-in Turtle
  bytes matched across C#, Kotlin resources, processed resources, and the
  installed application JAR (SHA-256 `2345428c9513651dcf184835538fa910abae6c95fcb399e508709d646af7993f`).
- The first Gradle invocation was interrupted by an accidental user click
  before a result; no process remained. The resumed
  `ktlintCheck detekt test installDist --no-daemon` run passed. Playwright
  passed 22/22. The temporary local distribution returned HTTP 200 for
  JSON `/health`, frontend, and OpenAPI, then was stopped. The C# harness
  built offline with zero errors and 20 existing warnings.
- Added [[../05 - Migration/CSharp Removal Review]] with the exact 24-file
  proposed deletion, preservation inventory, recovery anchors, and rollback
  steps. No C# or capture file was deleted. MIG-002 awaits human approval and
  a separate removal implementation diff; no production deployment occurred.

## 2026-09-27 — MIG-002 approved deletion applied for review

- User approved the exact 24-file scope and repository rollback plan in
  [[../05 - Migration/CSharp Removal Review]]. Deleted only the C# solution,
  project, and harness source/docs. Preserved both capture corpora, provenance,
  `files/` Turtle sources, Kotlin-owned built-in data, and archived workflow.
- Post-deletion `ktlintCheck detekt test installDist --no-daemon` passed,
  Playwright passed 22/22, and the installed distribution returned HTTP 200
  for `/health`, frontend, and OpenAPI before being stopped. Current
  compatibility and development docs now
  label C# commands as historical and identify Git commit `0f20091` for
  recovery. No commit, push, deployment, or GitHub setting change occurred.
- MIG-002 moved to REVIEW. The actual deletion diff still needs human review;
  no test assertion or capture baseline was weakened.

## 2026-09-27 — Archive legacy .NET deployment workflow

- User deferred selecting a Kotlin hosting/deployment path and asked that the
  old .NET workflow be disabled while preserving its configuration. Moved the
  YAML from `.github/workflows/` to `.github/archived-workflows/` on `kotlin`;
  the archived jobs and settings remain available for historical reference.
- Documented the old trigger, .NET build, artifact, and Azure deploy flow in
  [[../07 - Operations/Archived .NET Deployment Workflow]]. No secret values,
  remote workflow settings, Azure resources, or C# project files were changed.
  `master` still tracks the old YAML until this change is integrated. Created
  OPS-005 for a new workflow after a hosting
  decision rather than assuming a deployment target now.
- Normalized comparison against the Git-tracked original showed the archived
  YAML retains the original configuration (apart from the archive comment).
  `rg --files .github` found only the archived YAML; `git diff --check` and
  `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon`
  passed. No commit or push was made in this task.
- User then clarified that the repository is a fork with no enabled workflow
  visible in GitHub Actions. Corrected the notes: tracked YAML on `master`
  does not establish that a workflow is running or enabled. Remote
  disablement is not a separate removal gate on the reported fork state.

## 2026-09-27 — DEC-009 health response decision

- User approved retaining Kotlin `GET /health` as `200 application/json`
  `{"status":"ok"}` instead of C# `200 text/plain Healthy`. This is an
  intentional difference, not a claim of equivalent responses. The original
  C# health capture and all 34 earlier captures remain unchanged.
- Strengthened status/body/MIME and OpenAPI schema tests; updated API,
  operations, compatibility, migration, and task notes. The Docker probe
  remains an HTTP-success check, not an external-service readiness check.
- `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon`
  and `git diff --check` passed. DEC-009 is DONE; MIG-002 still requires
  separate approval and the remaining removal gates.

## 2026-09-27 — FE-003 review follow-up

- Strengthened the predicate-edge Playwright assertion to compare the complete
  `/api/query` JSON body, including explicit endpoint and limit values.
- Tried to block all external browser requests with a local structural CSS
  stub. The focused predicate-edge test passed, but the full run exposed a
  node-menu click failure under that incomplete stylesheet. Removed the block
  and CSS stub; the normal harness still loads external styles and fonts.
  FE-003 remains REVIEW pending fully offline, deterministic browser coverage.

## 2026-09-27 — C# retirement success captures

- User approved three specific C# success captures, waived further C#
  middleware-error equivalence, and required the original 34-case corpus to
  remain unchanged. The new `--retirement-success` harness mode wrote only
  `compatibility/retirement-expected/` and refused overwrites. Captured the
  actual ASP.NET `/health` response plus controlled, offline C# Wikidata
  search and generic remote SPARQL controller/service success paths.
- Recorded timestamp, source SHA, .NET SDK/host, path, normalizations, and
  observations in `capture-status.tsv`. Existing 34 expected case files and
  index were not changed. The C# host and fail-closed handlers made no live
  external request.
- Added capture-driven Kotlin route/raw-result comparison. The first focused
  run exposed Kotlin's missing `rdf:langString` datatype on remote
  language-tagged SPARQL JSON literals; fixed the transport mapper and kept
  the exact raw-RDF assertion. Focused capture and transport tests passed.
- Actual C# health output is `200 text/plain Healthy`, while Kotlin is `200`
  JSON `{"status":"ok"}`. Recorded it as an unresolved non-equivalence under
  DEC-009 instead of changing either capture or Kotlin health contract.
- The initial Kotlin comparator compilation failed on an import and a later
  focused run found the real `rdf:langString` mismatch. Both were fixed.
  A combined format/check run raced KtLint against formatting; running the
  full `ktlintCheck detekt test --no-daemon` gate after formatting passed.
  The original 34-case `expected/` tree remains untouched; `git diff --check`
  passed. No deployment, push, or C# removal was performed.
- Final evidence review found a synthetic `application/json` content type on
  the two in-process C# controller cases. Corrected the harness to record
  `null` (no middleware header was observed), regenerated only the three new
  provisional captures, and updated their provenance timestamps. The real
  black-box health content type remains `text/plain`. No original capture
  was removed or rewritten.

## 2026-09-27 — OPS-001

- Implemented a Java 21 Gradle `installDist` package and local Docker image
  independent of the C# project. Copied the approved built-in Turtle bytes
  into Kotlin resources, added a SHA-256 regression, and kept frontend assets
  and port 8080 unchanged. No capture/golden data was modified.
- Full `ktlintFormat ktlintCheck detekt test installDist --no-daemon` gate,
  resource/JAR hashes, distribution HTTP smoke, Docker build, non-root Docker
  health, frontend, and OpenAPI smoke checks passed. Sandbox socket limits
  required approved local host retries. The temporary container was removed;
  no image was pushed or deployed.
- Documented local packaging and future SEC-001/OPS-002/003/004 requirements.
  MIG-002 now separates repository-level C# removal from future production
  launch; the .NET workflow, remaining capture decision, and human review still
  block removal. Preserved pre-existing QUAL-001 and unrelated work.

## 2026-09-27 — QUAL-001

- The user's implementation request approved one public Wikidata success
  recording. Captured HTTP 200 with `Q42` and `Q28421831` at 18:18:27 UTC;
  stored the body, request, selected headers, body hash, and sanitation note.
- Added clearly labelled controlled local `429` and malformed-body fixtures,
  plus full Ktor search-route replay using `MockEngine`. The success response
  maps identifiers and labels exactly; the errors exercise the approved
  explicit JSON `502` contract. No normal test contacts Wikidata.
- Initial focused Gradle checks exposed test-only compilation and KtLint
  failures; corrected them. Focused route tests and the full offline
  `ktlintFormat ktlintCheck detekt test --no-daemon` gate passed. The immutable
  34-case C# baseline remains untouched; C# Wikidata search-route response
  capture is still a separate retirement gate.

## 2026-09-27 — integrated BUG-002, FE-003, and FE-004

- Integrated BUG-002 (`e040afc`), predicate-variable edges (`62b3eaf`), and
  the two-variable panel foundation (`04254db`) into the `kotlin` migration
  branch. The only frontend merge conflict was resolved by retaining both the
  edge action list and the independent two-variable panel.
- The integrated offline Kotlin gate
  `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon`
  and `node --check frontend-tests/index2.spec.mjs` passed. `BUG-002` is DONE.
- FE-003 and FE-004 remain REVIEW because `npm run test:browser` requires the
  uninstalled Playwright executable. No dependencies were installed.

## 2026-09-27 — FE-003 isolated implementation

- Created the approved predicate-variable edge contract and task after source
  evidence confirmed the Kotlin general-query route already accepts a variable
  predicate, while the frontend exposed it only through internal connection
  discovery.
- Implemented in isolated branch `feature/predicate-variable-edge`, commit
  `59a95f75cfe4dde67543e7f7ff24bbcaaafd63af`. The branch adds edge-only
  left-click actions, predicate conversion, query extraction, local-browser
  request assertions, and frontend documentation.
- The Kotlin quality gate and `git diff --check` passed. `npm run test:browser`
  was not executed because Playwright is absent in that worktree; dependencies
  were not installed. Keep FE-003 in `REVIEW` until integration and browser
  verification occur.

## 2026-09-27 — BUG-002 isolated implementation

- Implemented in isolated branch `bug/bug-002-upstream-errors`, commit
  `a2656b4`. The branch maps only `SparqlQueryExecutionFailure` to the existing
  JSON `502` envelope for both relationship routes and adds deterministic HTTP
  regressions.
- Focused route tests and the complete Kotlin quality gate passed. The task is
  in `REVIEW` until the branch is integrated into the dirty main worktree.

## 2026-09-27 — OAPI-001

- Resumed OAPI-001 after the stakeholder approved code-generated OpenAPI 3.1,
  public `/swagger` and `/openapi.json` in every environment, and no
  authentication until user testing. Recorded and completed `OAPI-000`; kept
  `AUTH-000` deferred and removed it as an OAPI implementation dependency.
- Added Ktor routing-OpenAPI and Swagger dependencies at the pinned Ktor 3.5.1
  version. Compiler inference was evaluated but reported a Kotlin 2.4+
  requirement, so the project retained Kotlin 2.2.20 and uses explicit runtime
  `.describe` metadata instead of an unrelated compiler upgrade.
- Documented exactly eight application operations; hid generated documentation
  and static-asset routes. The contract includes multipart `ttlFile`, JSON
  defaults/nullability, numeric filters, success/error schemas, side effects,
  and the deliberate absence of authentication/security requirements.
- Added `OpenApiRoutesTest`: HTTP smoke tests, exact route/method inventory,
  Swagger Parser OpenAPI 3.1 validation, and semantic schema/error assertions.
  Normal tests remain offline.
- The audit exposed an existing executor-error mapping gap on the two
  relationship routes. Documented current behavior and created `BUG-002`; no
  unrelated HTTP behavior was changed in OAPI-001.
- Verification passed:
  `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintFormat
  ktlintCheck detekt test --no-daemon` and `git diff --check`.
- Updated API, development, quality, migration, decision, README, blocker,
  task-index, and task documentation. Completed OAPI-001. No commit was created
  because the worktree contains pre-existing DOC-002 changes and the unrelated
  `tcc/.obsidian/workspace.json` modification.

## 2026-09-21 — OAPI-001 blocked audit

- The requested implementation was audited three consecutive times. Its
  required decision tasks `OAPI-000` and `AUTH-000` remain human-gated and
  `BLOCKED`; no explicit approval was received for source ownership, paths,
  environment exposure, security scheme, or protected routes.
- Marked `OAPI-001` `BLOCKED` to make its actual eligibility visible. No
  dependency, production source, route, build file, specification, or test was
  changed. The existing approval questions remain in `BLOCKERS.md`.

## 2026-09-21 — DOC-002

- Selected the only eligible documentation reconciliation after confirming
  `BUG-001` and `MIG-001` were `DONE`; moved it through `IN_PROGRESS` to
  `DONE` in this run.
- Reconciled the migration checklist/report, corpus guide/catalogue,
  remaining-work list, vault home/migration/quality notes, and new root README
  against source, call sites, Git history, 34 captures/provenance rows, the
  comparator, Ktor tests, and Playwright tests.
- Preserved historical phase records but labeled superseded state. Documented
  the real `case.json` layout, 34-capture baseline, complete valid-capture
  comparison, all six exception-only non-equivalences, approved Kotlin JSON
  errors, existing browser coverage, and the actual open decision/task chain.
- Focused comparator and full `ktlintCheck detekt test` passed using the
  existing Gradle cache after the temporary-cache download timed out. The
  authorized local-server Playwright run passed 8/8 after the sandbox correctly
  rejected the first bind attempt. Ten-document link validation, capture/index
  count checks, stale-claim searches, and `git diff --check` passed.
- No application source, capture, expected result, blocker, secret, or Mermaid
  changed. The unrelated pre-existing Obsidian workspace-state modification
  was preserved, so no autonomous commit was created.

## 2026-09-21 — DEC-001

- Resumed the human-gated scope decision after approval that PDF binaries do
  not belong in Git and that login plus Swagger/OpenAPI will be implemented.
- Confirmed three PDFs are currently tracked under `tcc/PDF/` (about 7.7 MB),
  with no ignore rule or Markdown links. Created `REPO-001` to untrack/ignore
  them while preserving local copies; history rewriting remains out of scope.
- Confirmed `login.html` only posts to removed `index.html`, with placeholder
  registration/recovery links and no Ktor/C# authentication contract. Created
  human-gated `AUTH-000`, followed by `AUTH-001` backend and `AUTH-002`
  frontend implementation tasks.
- Confirmed C# uses default Swashbuckle while Kotlin has eight application
  routes, a reviewed Markdown API contract, and no OpenAPI dependency. Reviewed
  official Ktor static and generated Swagger/OpenAPI options; created
  human-gated `OAPI-000` followed by `OAPI-001` implementation.
- Updated the repository-scope decision note, open decisions, inventory,
  frontend note, blockers, and dependency-ordered task index. No application
  code, PDF, credential, or Obsidian workspace state was changed. Completed
  `DEC-001`; `REPO-001` is the next eligible P0 task.

## 2026-09-17 — BUG-001

- Resumed the approved P0 blocker and changed it to `IN_PROGRESS` before
  application/harness changes.
- Replaced the harness decorator with a capturing `LocalQueryExecutor`
  subclass plus a runtime-type guard, then ran the .NET 8 harness and reviewed
  all generated differences. Accepted only `SEARCH-LOCAL-001` and
  `BUILTIN-GRAPH-001`; restored unrelated unordered-row recapture noise.
- Recorded reviewed provenance for both recaptures. The real C# local branch
  generates an unfiltered query without the request limit, then applies its
  label/`objetoClasse`/`Take(20)` filter in memory.
- Re-enabled both cases in the Kotlin capture comparator. The raw built-in
  result comparison exposed `.NET Uri.AbsoluteUri` empty-authority-path
  normalization, so the Jena boundary now maps `http://host#fragment` to the
  captured `http://host/#fragment` form. Added a focused regression.
- Passed the focused RDF and capture tests, `ktlintFormat`, the full
  `ktlintCheck detekt test` gate, and `git diff --check`. No dedicated
  Markdown-link or Mermaid checker is configured.
- Updated migration reports, vault notes, blockers, the task, and the task
  index. Completed `BUG-001`. No commit was created because the working tree
  contains unrelated pre-existing changes.

## 2026-09-17 — FE-002

- Implemented the approved persistent node action list in the authoritative
  frontend. Real left-click selects/retargets it, graph-background click closes
  it, replacement follows the new node, and Remove closes the unanchored list.
  The circular right-click plugin is no longer loaded.
- Preserved entity, variable, default, link, Boolean, literal, Convert, and
  Remove behavior behind explicit semantic buttons. Added repositioning for
  pan, zoom, layout, node movement, window resize, narrow/wide viewports, and
  off-screen recovery.
- Expanded the deterministic Playwright suite to eight tests, including
  success/loading/empty/error paths. Corrected its previously empty HTML-label
  CDN stub after it was proven to abort initialization before graph handlers.
- Verification: `npm run test:browser` passed 8/8; `./gradlew ktlintCheck detekt
  test --no-daemon --console=plain` was `BUILD SUCCESSFUL`; `git diff --check`
  passed. Restricted-sandbox network/bind failures were rerun with approved
  escalation and are recorded in the task log.
- Updated frontend architecture/request-flow/quality notes and `MIGRATION.md`;
  completed `FE-002` with every acceptance criterion checked.

## 2026-09-17 — FE-002 task definition

- Created `FE-002` for the approved node-menu interaction change after reading
  repository instructions, migration documentation, `FE-001`, frontend source,
  tests, request-flow notes, the cxtmenu bundle, and relevant Git history.
- Confirmed that right-click/long-press currently opens a radial
  Cancel/Remove/Convert menu, while left-click immediately performs node-type
  actions. The new task requires one persistent vertical action list and moves
  those existing actions behind explicit choices so selecting a node does not
  trigger both behaviors.
- Added source-backed scope, edge cases, acceptance criteria, deterministic
  browser verification, risks, and documentation requirements. No application
  code or runtime behavior was changed.
- Verified frontmatter, dependency eligibility, index synchronization, and
  Obsidian link targets with `rg`; reviewed the Mermaid state diagram directly
  because no Markdown/Mermaid checker is present. `git diff --check` passed.

## 2026-09-16 — Worker pass with no eligible task

- Recomputed task eligibility from all item frontmatter and the dependency
  graph. `DOC-002` is the only `READY` task, but it depends on `BUG-001`, which
  is `BLOCKED`; therefore no task is eligible for execution.
- Confirmed the task index remains synchronized with item statuses. No task was
  started and no application or task status was changed.

## 2026-09-16 — DEC-001

- Selected DEC-001 as the highest-priority eligible task after `DOC-001` and
  `DATA-001` were `DONE` (other P2 documentation is blocked by BUG-001).
- Inspected the vault, `sparql/login.html`, C# launch settings, and Kotlin
  routes. The requested repository-scope, login, and OpenAPI outcomes require
  human/product approval.
- Set DEC-001 to `BLOCKED` and recorded the three-part decision question in
  `BLOCKERS.md`. No application files or assets were changed.
- Stakeholder approved repository scope: keep the `tcc/` vault and reference
  PDFs external. Updated the open-decision inventory and narrowed the blocker
  to login-page and OpenAPI scope; DEC-001 remains `BLOCKED`.
- Stakeholder selected authentication implementation. Blocked implementation
  pending credential source, session/token mechanism, and protected-route
  policy; no speculative security code was added.
- Stakeholder approved adding Kotlin OpenAPI now. Updated the open-decision
  inventory; DEC-001 remains blocked only on authentication contract details.

## 2026-09-16 — DATA-001

- Resumed the task after human approval of option 1: keep
  `Sparql.QueryEasy/futebol_completo.ttl` as the sole canonical built-in
  dataset; no data or C# baseline was modified.
- Verified resource packaging:

  ```sh
  GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew processResources --no-daemon --console=plain
  sha256sum Sparql.QueryEasy/futebol_completo.ttl build/resources/main/futebol_completo.ttl
  ```

  Result: `BUILD SUCCESSFUL`; both files have SHA-256
  `2345428c9513651dcf184835538fa910abae6c95fcb399e508709d646af7993f`.
- Ran the focused endpoint/resource test:
  `./gradlew test --tests 'com.example.sparqlqueryeasy.application.endpoints.EndpointContextResolverTest' --no-daemon`.
  Result: `BUILD SUCCESSFUL`.
- Revalidated packaging and the focused test after approval. Gradle could not
  initialize its file-lock service in the restricted sandbox; the approved
  outside-sandbox retry was `BUILD SUCCESSFUL`, and both source and packaged
  resources retained the recorded SHA-256.
- Updated the decision, inventory, API, migration report, task index, and
  blockers documentation. Completed `DATA-001`.

## 2026-09-16 — MIG-001

- Selected `MIG-001` as the only eligible highest-priority task after
  verifying that `DOC-001` is `DONE`.
- Read `AGENTS.md`, `MIGRATION.md`, the selected task, capture documentation,
  migration documentation, and `CaptureDrivenCompatibilityTest.kt`.
- Ran the focused offline comparator:

  ```sh
  GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew test --tests 'com.example.sparqlqueryeasy.http.CaptureDrivenCompatibilityTest' --no-daemon --console=plain
  ```

  Result: `BUILD SUCCESSFUL` (2026-09-16). No live Wikidata request was made.
- Ran the broader offline quality gate:

  ```sh
  GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon --console=plain
  ```

  Result: `BUILD SUCCESSFUL` (2026-09-16).
- Reviewed `git diff --check`, the task-related diff, and working-tree status.
  No capture baseline was altered. The pre-existing unrelated migration,
  frontend, and test changes remain uncommitted and untouched.
- Completed `MIG-001`. No C# capture baseline, provenance record, or unrelated
  worktree change was modified.

## 2026-09-16 — API-001

- Selected `API-001` as the single eligible P1 task with the lowest task ID;
  its only dependency, `DOC-001`, is `DONE`.
- Published [[../03 - Backend/API v1|API v1]] from Kotlin route/model/service
  code, route tests, and C# controller evidence. Updated the concise backend
  API inventory to link to it. No application code was changed.
- Ran the deterministic Ktor route suite:

  ```sh
  GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew test --tests 'com.example.sparqlqueryeasy.ApplicationTest' --tests 'com.example.sparqlqueryeasy.http.QueryRoutesTest' --tests 'com.example.sparqlqueryeasy.http.LocalDatabaseRoutesTest' --tests 'com.example.sparqlqueryeasy.http.StaticFrontendRoutesTest' --no-daemon --console=plain
  ```

  Result: `BUILD SUCCESSFUL` (2026-09-16).
- Verified the Obsidian link target, enumerated eight configured application
  routes, and ran `git diff --check` successfully. No commit was created because
  the worktree contains unrelated pre-existing changes.
- Completed `API-001`.

## 2026-09-16 — COM-001

- Selected `COM-001` as the next eligible P1 task; `API-001` is `DONE`.
- Published [[../04 - Frontend/Request Flows|Frontend-to-Backend Request
  Flows]], and linked it from frontend architecture and quality notes. It
  records payload mapping, response consumption, displayed errors, API
  references, and the browser-test boundary for every actual `index2.html`
  request flow.
- Extended `StaticFrontendRoutesTest` with an assertion that the served client
  declares `/health`, upload, search, relationship, relationship-value, query,
  and SPARQL-preview routes, the same-origin base, and `ttlFile` form field.
- Ran:

  ```sh
  GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck test --tests 'com.example.sparqlqueryeasy.ApplicationTest' --tests 'com.example.sparqlqueryeasy.http.QueryRoutesTest' --tests 'com.example.sparqlqueryeasy.http.LocalDatabaseRoutesTest' --tests 'com.example.sparqlqueryeasy.http.StaticFrontendRoutesTest' --no-daemon --console=plain
  ```

  Result: passed; no test-result XML contains a failure/error. Also verified
  documented route declarations, link targets, and `git diff --check`.
- Completed `COM-001`. No application route or API contract was changed; no
  commit was created because unrelated worktree changes remain.

## 2026-09-16 — FE-001

- Selected `FE-001` as the next eligible P1 task; `DOC-001` and `API-001` are
  `DONE`.
- Added a pinned Playwright Firefox browser-test setup. It serves the actual
  `index2.html` from a local Node server, intercepts only CDN scripts with
  controlled stubs, and serves test-local health/upload/query responses.
- The first run exposed a missing `M.Sidenav.init` test-stub method, which
  prevented page initialization. Added the method; this was not a production
  frontend defect.
- Passed:

  ```sh
  npm run test:browser
  GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon --console=plain
  ```

  The browser suite covers autocomplete callback-to-node insertion, relative
  URLs, Turtle upload endpoint replacement, relationship expansion, SPARQL
  preview, and query execution. The Gradle quality gate was `BUILD SUCCESSFUL`.
- Updated frontend/quality notes, reviewed the task diff and `git diff --check`,
  and completed `FE-001`.

## 2026-09-16 — INV-001

- Selected `INV-001` as the only eligible remaining P1 task after `DOC-001`.
- Confirmed that the default factory creates one shared CIO client for remote
  SPARQL and Wikidata entity search but had no lifecycle owner. Made
  `HttpDependencies` own resources it creates, registered its close action on
  Ktor `ApplicationStopped`, and retained empty ownership for test-injected
  dependencies.
- Added `HttpModuleLifecycleTest`, which forces an application stop and proves
  the owned resource is closed exactly once.
- Ran the focused lifecycle test with `--rerun-tasks`, then
  `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon --console=plain`.
  The focused XML has zero failures/errors; the full test-result set has zero
  failures/errors. `git diff --check` passed.
- Updated architecture, development, and quality notes; completed `INV-001`.
  Did not commit because `tcc/.obsidian/workspace.json` changed outside this
  task and was preserved untouched.

## 2026-09-16 — DATA-001

- Selected `DATA-001` as the next READY P2 task after verifying `DOC-001` is
  `DONE`.
- Compared the C# runtime Turtle, its `files/` copy, and the frontend-associated
  Turtle by SHA-256, size, line count, diff, and packaging configuration.
  Confirmed the C# asset is the one Kotlin packages, while the frontend asset
  is materially different and not packaged.
- No data was changed. The task is `BLOCKED` at its required human gate.
  Added a decision note and `BLOCKERS.md` question: keep the C# asset
  canonical (recommended), replace it with approved baseline recapture, or
  support both under separate endpoint identifiers.
