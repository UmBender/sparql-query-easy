# Frontend Migration Conflict Report

Discovery and conflict audit, 2026-10-16. Read-only: no task, code or other
note was created, edited or deleted. It compares the planned migration
slices T1–T12 (SvelteKit frontend, PostgreSQL, authentication, study forms,
Docker Compose deploy) with the existing backlog under the user's conflict
rules (DUPLICATE, EXTENDS, CONTRADICTS, SUPERSEDES, IN PROGRESS). Nothing
here is approved; CONTRADICTS rows wait for the user's answer.

## Pipeline summary

1. Entry: root `AGENTS.md` → the selected card → one skill in `.agents/skills/<name>/SKILL.md` (`tcc-plan-task`, `tcc-backend`, `tcc-frontend`, `tcc-fullstack`, `tcc-refactor`, `tcc-test`, `tcc-frontend-audit`); paths and gates in [[../06 - Development/Operational Map]], behavior in [[../09 - Decisions/Current Contracts]].
2. Cards: `tcc/90 - Tasks/items/<AREA>-<NNN>-<slug>.md`, YAML `id, title, status, priority (P0–P2), type, depends_on, human_gate, created, updated` ([[../90 - Tasks/FORMAT]]).
3. Statuses: BACKLOG, READY, IN_PROGRESS, BLOCKED, REVIEW, DONE, CANCELLED. No "superseded": the precedent (DEV-002) is `CANCELLED` plus a "**Superseded by X (date).**" line. "Blocked by" is `depends_on` plus `BLOCKED` and an entry in `BLOCKERS.md`.
4. Body: objective, skill and entry paths, scope/exclusions, dependencies, observable acceptance criteria, validation commands, execution log ending in "Completion commit for this task".
5. Selection ([[../90 - Tasks/WORKER_PROMPT]]): named task, else the READY card with DONE dependencies, highest priority then lowest ID; BACKLOG is never promoted automatically; human gates stay with the user.
6. Execution: mark IN_PROGRESS, implement one slice, add tests with behavior changes, update the canonical note (Current Contracts, API v1, Frontend Architecture…), update `TASKS.md` (`node scripts/check-project-docs.mjs --index` prints it).
7. Gates: Kotlin `./gradlew ktlintCheck detekt test`; browser `npm run test:browser`; `npm run test:query` and `npm run check:frontend-types` for pure modules; `npm run test:e2e` for staged exploration; `installDist` plus a smoke check for packaging; docs `node scripts/check-project-docs.mjs` and `git diff --check`.
8. Finish: one selective local commit prefixed with the task ID (no `git add .`, no amend/push unless authorized); DONE needs verified acceptance and a commit, REVIEW is for a human judgment.
9. Decisions live as `DEC-*` cards with `human_gate: true`, rows in [[../09 - Decisions/Open Decisions]], and the compact register in Current Contracts.

## Repo map

**Backend** (`src/main/kotlin/com/example/sparqlqueryeasy/`, Kotlin 2.2.20, Ktor 3.5.1, Jena 6.2.0, JDK 21):

| Layer | Files |
|---|---|
| Bootstrap/config | `Application.kt`, `config/AppSettings.kt` (env or `.env`, only `EASYQUERY_EXTREME_RESULT_LIMIT` today), `resources/application.conf` (port 8080) |
| HTTP | `http/HttpModule.kt` (routes, JSON, StatusPages), `http/QueryHttpModels.kt` (DTOs), `http/OpenApiModule.kt` |
| Services | `application/query/{GeneralQuery,StageQuery,ResultCount,NumericProfile,ResultFiltering}Service.kt`, `querygeneration/`, `relationships/`, `search/`, `localdatabase/{LocalDatabaseUploadService,LocalGraphCache}.kt` (in-memory), `endpoints/` |
| RDF/remote | `rdf/`, `rdf/jena/`, `wikidata/{query,client,entitysearch}/` |
| Data | `resources/futebol_completo.ttl` (default), `pokemon_gen1.ttl` |

Routes (all public, no auth, no CORS plugin, same origin): `GET /` → redirect `/index2.html`;
`GET /health`; `POST /api/local-database` (multipart `ttlFile`); `POST /api/query`
(general query), `/api/query/{relationships, relationship-value, search, stage,
numeric-profile, count, sparql}`; `GET /openapi.json` (OpenAPI 3.1, code-generated
from route `describe` blocks, API version `1.0.0`) and `GET /swagger`; static
`frontend` resources at `/`. Envelopes `DataResponse`/`ErrorResponse`, errors 400/404/502.
No database, no persistence, no users.

**Legacy frontend** (`sparql/`, ≈7,100 lines): `index2.html`, `index2.css`,
`grafos.css`; classic scripts `app-core.js`, `stage-order.js`,
`stage-exploration.js`, `graph-nodes.js`, `graph-menus.js`, `filter-funnel.js`,
`filter-badges.js`; checked pure modules `graph-model.js`, `graph-binding.js`,
`graph-actions.js`, `query-calculations.js`, `query-stages.js`; vendored
`cytoscape.min.js`, `cytoscape-cxtmenu.js`; non-functional `login.html`;
`databases/`. jQuery/Materialize from CDN. Packaged by explicit includes in
`build.gradle.kts` `processResources`.

**Tests**: Kotlin unit/route/compatibility tests (33 classes under `src/test`,
including `OpenApiRoutesTest`, `StaticFrontendRoutesTest`,
`CaptureDrivenCompatibilityTest` against `compatibility/expected/`); opt-in
`src/integrationTest` (live Wikidata). Browser: `frontend-tests/index2.spec.mjs`
(111 Playwright cases, egress-guarded, CDN stubs), `e2e/ordered-exploration.spec.mjs`
(4 cases on a real Ktor at 18090), five `*.unit.mjs` `node --test` suites,
`tsconfig.frontend.json` (`checkJs`, TypeScript 5.9.3).

**Docker/deploy**: `Dockerfile` (multi-stage, JRE 21, non-root `10001`,
`/health` HEALTHCHECK, port 8080), `.dockerignore`, `.env.example`. No Compose
file, no proxy config, no database container.

**CI**: none active. `.github/workflows/` is empty; the old .NET Azure workflow
is archived in `.github/archived-workflows/`.

## Existing tasks

100 cards; none is IN_PROGRESS. Full links in [[../90 - Tasks/TASKS]].

| ID | Status | Title | Scope |
|---|---|---|---|
| DOC-001 | DONE | Bootstrap evidence-based thesis knowledge base | Created the Obsidian vault structure |
| DOC-002 | DONE | Reconcile migration and compatibility documentation | Removed stale migration claims |
| DOC-003 | DONE | Document every deployment step and a hands-on learning path | AWS deployment roadmap, LEARN-001–014, tracker |
| DEC-001 | DONE | Resolve vault ownership login page and OpenAPI scope | Vault in Git, implement auth, add OpenAPI |
| DEC-008 | DONE | Decide the ordered multi-variable query exploration contract | Staged, bounded, ordered exploration |
| DEC-009 | DONE | Decide captured C# versus Kotlin health response contract | Keep JSON `{"status":"ok"}` |
| DEC-010 | DONE | Choose which numeric-filter visualization is merged | Histogram + funnel kept; dot strip/live graph dropped |
| DEV-001 | DONE | Tornar o desenvolvimento econômico, autônomo e verificável | Current AGENTS/pipeline policy |
| DEV-002 | CANCELLED | Approve the revised feature delivery workflow | Superseded by DEV-001 |
| AUTH-000 | BLOCKED | Decide the authentication and authorization contract | Human-gated: identity, sessions, anonymous use, protected routes, CSRF |
| AUTH-001 | READY | Implement the approved Ktor authentication backend | Login/logout/session routes per AUTH-000 (depends on it) |
| AUTH-002 | READY | Integrate the login and logout frontend flow | Wire `login.html` and `index2.html` to AUTH-001 |
| BUG-001 | DONE | Repair C# local-search capture instrumentation | Recaptured two C# baselines |
| BUG-002 | DONE | Map relationship executor failures to JSON 502 | Error contract on relationship routes |
| BUG-003 | DONE | Keep result-table selection working in cyclic graphs | Legacy UI fix |
| BUG-004 | DONE | Run Query uses the graph group that contains the variables | Legacy UI fix |
| BUG-005 | DONE | A single remaining variable is staged | Legacy UI fix |
| BUG-006 | DONE | Choosing a result keeps a fixed IRI neighbour as an IRI node | Legacy UI fix |
| MIG-001 | DONE | Complete valid capture-driven C# to Kotlin compatibility | Capture replay tests |
| MIG-002 | DONE | Retire the C# project | Removed C# after gates |
| OAPI-000 | DONE | Decide the Swagger and OpenAPI publication contract | Code-generated 3.1, public |
| OAPI-001 | DONE | Implement and verify Kotlin Swagger/OpenAPI | `/openapi.json`, `/swagger`, route test |
| REPO-001 | DONE | Stop tracking thesis reference PDFs | Untracked PDFs |
| API-001 | DONE | Publish versioned API contract | `03 - Backend/API v1` |
| API-002 | DONE | Specify staged-candidate API | Contract for `/api/query/stage` |
| INV-001 | DONE | Investigate HTTP-client and runtime resource lifecycle | Client ownership/shutdown |
| INV-002 | DONE | Characterize typed staged-query data | Typed binding design |
| INV-003 | DONE | Propose other query types the tool could support | Query-type proposal (aggregation, ASK…) |
| BE-001 | DONE | Typed bounded stage-query service | Service for stages |
| BE-002 | DONE | Expose the stage-query service over Ktor | `POST /api/query/stage` |
| BE-003 | DONE | Numeric relation profile and between filter | `numeric-profile`, filterType 6 |
| BE-004 | DONE | MAX and MIN keep every tie, capped | Env-configurable cap |
| COM-001 | DONE | Characterize frontend-to-backend request flows | `04 - Frontend/Request Flows` |
| DATA-001 | DONE | Decide canonical Brazilian football dataset | Keep the C# asset byte-identical |
| DATA-002 | DONE | Built-in PokemonGen1 dataset | Second built-in graph |
| DATA-003 | DONE | PokemonGen1 strengths and Pokédex lore | Dataset extension |
| FE-001 | DONE | Browser-level tests for authoritative frontend flows | First Playwright suite |
| FE-002 | DONE | Left-click node action list | Replaces radial menu |
| FE-003 | DONE | Graph relation → predicate variable | Predicate variables |
| FE-004 | DONE | Two-variable exploration panel foundation | Side panel |
| FE-005 | DONE | Candidates for the first query variable | Stage 1 |
| FE-006 | DONE | Second variable under an assumed first binding | Stage 2 + preview |
| FE-007 | DONE | Connect existing nodes with predicates | Edge connector |
| FE-008 | DONE | Stable registry of query variables and stages | `query-stages.js` |
| FE-009 | DONE | Numbered reorderable query blocks | Order chips |
| FE-010 | DONE | Ordered exploration across 3+ variables | Multi-stage completion |
| FE-011 | DONE | Extract pure query calculations | `query-calculations.js` |
| FE-012 | DONE | Pilot checked JavaScript | `checkJs` pilot |
| FE-013 | DONE | Consistent relation visuals and removal | Edge visuals |
| FE-014 | DONE | Gentler wheel zoom | Zoom tuning |
| FE-015 | DONE | Concrete graph hover preview | Canvas preview (replaced by FE-017) |
| FE-016 | DONE | Red Remove relation action | Styling |
| FE-017 | DONE | Possible-graph window | Separate preview window |
| FE-018 | DONE | index2.html size audit | Recommended no framework (Option A/B) |
| FE-019 | DONE | Move inline CSS to its own stylesheet | `index2.css` |
| FE-020 | DONE | Split the top-level script into classic files | Script split |
| FE-021 | DONE | Pure possible-graph and menu decisions | Checked modules |
| FE-022 | DONE | Graph menu controller | `graph-menus.js` |
| FE-023 | DONE | Variable/order hover emphasis | Hover sync |
| FE-024 | DONE | Larger possible-graph window, readable labels | Preview window |
| FE-025 | DONE | Assume a stage value immediately | Assume button |
| FE-026 | DONE | Numeric filter range slider over a histogram | Filter editor |
| FE-027 | CANCELLED | Dot strip with live count badge | Dropped by DEC-010 |
| FE-028 | DONE | Filter funnel | Funnel panel + `count` route |
| FE-029 | CANCELLED | Live filtered result graph | Dropped by DEC-010 |
| FE-030 | DONE | Add value filter from a node's action list | Node action |
| FE-031 | DONE | Propose how to make frontend changes less error prone | Kept Option C rejected; proposed QUAL-005/FE-032/033 |
| FE-032 | DONE | Graph element kinds in one checked module | `graph-model.js` |
| FE-033 | DONE | Bind a variable through one tested function | `graph-binding.js` |
| FE-034 | DONE | Value variable node holding a filter | `variableFilters` API + node kind |
| FE-035 | DONE | Cycle over entities a filter keeps | Filter preview |
| FE-036 | DONE | kept/total badge and actual value | Badges |
| FE-037 | DONE | Add value variable from the toolbar | Toolbar button |
| FE-038 | DONE | Text suggestions while typing a filter | Suggestions via `stage` |
| FE-039 | DONE | Value-variable filters as funnel steps | Funnel/badge fix |
| QUAL-001 | DONE | Replay recorded Wikidata routes | Offline fixtures |
| QUAL-002 | DONE | Ordered exploration end to end offline | `npm run test:e2e` |
| QUAL-003 | DONE | Fail browser tests on external traffic | Egress guard |
| QUAL-004 | DONE | Wait for startup layout before viewport | Flake fix |
| QUAL-005 | DONE | Node kind × action regressions | Kind/action table in browser suite |
| SEC-001 | BACKLOG | Production endpoint, upload and cache boundaries | Human-gated security limits |
| OPS-001 | DONE | Container and JVM runtime packaging | `Dockerfile`, local only |
| OPS-002 | BLOCKED | DNS, TLS, reverse proxy, production CORS policy | Design only; waits for domain |
| OPS-003 | BLOCKED | AWS deployment plan | AWS architecture; waits for hosting |
| OPS-004 | BLOCKED | Monitoring, backup and recovery plan | Plan only; waits for architecture/SEC-001 |
| OPS-005 | BLOCKED | Kotlin deployment workflow after hosting is chosen | CD pipeline; waits for hosting |
| LEARN-001 | REVIEW | Linux shell and networking | Lesson |
| LEARN-002 | REVIEW | Containers with Docker | Lesson |
| LEARN-003 | READY | AWS account, IAM, MFA, cost alarms | AWS lesson |
| LEARN-004 | READY | AWS networking (VPC) | AWS lesson |
| LEARN-005 | READY | Run the app on EC2 by hand | AWS lesson |
| LEARN-006 | READY | Amazon ECR | AWS lesson |
| LEARN-007 | READY | PostgreSQL by hand, then RDS | Lesson: psql, pg_dump, Flyway, HikariCP, RDS |
| LEARN-008 | READY | Passwords, sessions, login protection | Lesson: Argon2id/bcrypt, cookies, CSRF |
| LEARN-009 | READY | Configuration and secrets on AWS | Lesson: env config, SSM |
| LEARN-010 | READY | Domains and DNS with Route 53 | AWS lesson |
| LEARN-011 | READY | HTTPS and reverse proxy with Caddy | Lesson, platform-neutral |
| LEARN-012 | READY | GitHub Actions deploying to AWS | Lesson: CI + OIDC to AWS |
| LEARN-013 | READY | Monitoring, logs, backups, runbooks | Lesson (CloudWatch, RDS backups) |
| LEARN-014 | READY | Go-live checklist for user testing | Lesson incl. privacy notice, consent, LGPD |

## Conflict table

| Existing task | Planned | Classification | Proposed action |
|---|---|---|---|
| FE-018, FE-031 and [[../04 - Frontend/Frontend Evolution Audit]] (user chose incremental Option B 2026-09-28; Option C "stays rejected"); Current Contracts Frontend row | T1, T3, T4, T5 | CONTRADICTS | Decision note below (D1). No card until answered. |
| FE-012 (checked-JS pilot) | T1, T4 | EXTENDS | Keep for the legacy page; strict TS applies only to the new app. |
| FE-001, QUAL-002, QUAL-003, QUAL-004, QUAL-005 (111 browser + 4 e2e + 5 unit suites) | T2 | EXTENDS (largely DUPLICATE) | Existing suite is the characterization base. T2 shrinks to a follow-up depending on them: fill uncovered legacy features (to be listed by reading the spec titles, e.g. tour, auto layout) and write a parity checklist mapping each legacy case to a new-app test. |
| — (no styling or design-token card; skills list in AGENTS.md) | T3 | New | New card after D1; adds a style skill to the AGENTS.md skills list. |
| FE-008, FE-011, FE-021, FE-032, FE-033 (pure modules + unit tests) | T4 | EXTENDS | Port them to the TS domain; their unit tests are the oracle. Done work untouched. |
| OAPI-001, API-001, API-002 | T4 (typed client) | EXTENDS | Generate types from `/openapi.json`; gaps under Backend gaps. |
| FE-002…FE-039 (DONE, legacy UI), BUG-003…006, DEC-008, DEC-010 | T5 | SUPERSEDES (at cutover) | Proposed: no status change now. Their contracts are T5's spec. Proposal D3 on whether to mark them after T12. FE-027/FE-029 stay CANCELLED and must not reappear. |
| LEARN-007 (lesson only) | T6 | EXTENDS | No implementation card exists; T6 is new and cites LEARN-007 as background. DEC-005 (upload persistence) stays separate. |
| AUTH-000 (BLOCKED, human gate) | T7 | DUPLICATE | Do not create T7 decision work; AUTH-000 is the gate. Proposed criteria for AUTH-000: Argon2id or bcrypt, credentials in PostgreSQL (T6), same-origin `HttpOnly` cookie session (already its recommendation). |
| AUTH-001 (READY) | T7 backend | DUPLICATE | Reuse AUTH-001. Proposed added criteria: depends on T6; Flyway migration for users/sessions. |
| AUTH-002 (READY, targets `login.html` + `index2.html`) | T7 frontend | SUPERSEDES (after confirmation) | After D1=B: `CANCELLED` + "Superseded by <new card>" line. |
| Current Contracts "Authentication deferred to user testing" | T7 | EXTENDS | Consistent; T7 is the user-testing step. |
| INV-003 (query types) | T8 | No overlap | Different subject. T8 new; needs a saved-query format (Backend gaps). |
| LEARN-014 (lesson: privacy notice, consent, LGPD) | T9 | EXTENDS | Lesson only; T9 new, cites it. Data rules need D5. |
| SEC-001 (BACKLOG, human gate) | T8, T9, T11 | EXTENDS | Make go-live depend on SEC-001 (upload and remote-endpoint limits for public users). |
| QUAL-003 (egress guard), FE-001 harness | T10 tests | EXTENDS | Keep the "no external traffic" rule in Vitest/MSW/Playwright for the new app. |
| OPS-005 (BLOCKED, deploy workflow) | T10 CI | EXTENDS | T10 = CI test gates only (no card exists); deployment stays in OPS-005/T11. |
| LEARN-012 (Actions → AWS via OIDC) | T10, T11 | CONTRADICTS (AWS) | Part of D2. |
| OPS-001 (DONE, Dockerfile) | T11 backend | EXTENDS (base) | Reuse the image as the `backend` service. |
| OPS-002 (BLOCKED, DNS/TLS/proxy/CORS design) | T11 web proxy, HTTPS | EXTENDS | T11 depends on OPS-002, which unblocks once D2 answers the domain/TLS questions. |
| OPS-004 (BLOCKED, backup plan) | T11 backups | EXTENDS | T11 backup job depends on OPS-004's plan. |
| OPS-005 (BLOCKED) | T11 deploy method | EXTENDS | Same card, university target. |
| OPS-003 (BLOCKED, AWS plan); DOC-003 and Deployment Roadmap (goal "deploy on AWS"); LEARN-003/004/005/006/010; AWS halves of LEARN-007/009/013 | T11 | CONTRADICTS | Decision note below (D2). After the answer: OPS-003 and AWS-only lessons `CANCELLED` + "Superseded by" (confirm first); DOC-003 not rewritten, only a dated note. |
| Current Contracts frontend row, Operational Map, `GET /` redirect, `StaticFrontendRoutesTest`, `processResources` includes, FE-019…FE-022 | T12 | SUPERSEDES (at T12, after confirmation) | T12 updates contracts and gates; MIG-002 (C# retirement) is the precedent for a gated removal. |
| — | any | IN PROGRESS | None found. LEARN-001/002 are REVIEW lessons with no code; unaffected. |

**T11 against the existing deploy work.** There is no deploy implementation
card; the deploy scope is spread over one done and four blocked cards:

| T11 part | Covered by | Status |
|---|---|---|
| backend service | OPS-001 `Dockerfile` (non-root, healthcheck, env file) | Done; reusable as is |
| db (PostgreSQL + named volume) | LEARN-007 lesson only | Not covered |
| web proxy (Caddy/Nginx, SPA + `/api`) | OPS-002 design (blocked), LEARN-011 lesson | Policy only; no config |
| env and secrets | OPS-001 non-secret config, `.env.example`; LEARN-009 (AWS SSM) | Non-secret only; no secret mechanism |
| HTTPS | OPS-002 (blocked on domain), LEARN-011 | Not covered |
| backups | OPS-004 plan (blocked), LEARN-013 (RDS) | Not covered |
| migrations at startup | none (LEARN-007 mentions Flyway) | Not covered |

## Open decisions for me

- **D1 Frontend stack (CONTRADICTS).** A: keep incremental Option B in `sparql/` (recorded decision; lowest cost; the audit found the bugs came from scattered node-kind rules, not jQuery). B: SvelteKit app beside the legacy page, then cutover (your target; highest cost, every feature re-proven; adds routing/forms needed by T7–T9). Affects AGENTS.md skills, Operational Map gates, Current Contracts, Frontend Architecture, the audit, `package.json`, `Dockerfile`. **Recommendation: B**, if the first slice is the framework-free TS domain ported from the checked modules with their tests, and cutover is its own approved card. Also: the new app's directory name (proposal `web/`).
- **D2 Hosting (CONTRADICTS).** A: AWS per DOC-003 roadmap (EC2, RDS, ECR, Route 53, SSM, OIDC). B: Docker Compose on the university server. Affects OPS-003, LEARN-003/004/005/006/010/012 and parts of 007/009/013. **Recommendation: B** if the server is publicly reachable on 80/443. Needed facts: DNS name and who issues TLS, deploy access (SSH/VPN/none from GitHub), off-host backup location.
- **D3 Done legacy cards.** Mark FE-*/BUG-* as superseded at T12, or leave them DONE as history and spec? Recommendation: leave them DONE; supersede only open legacy cards (AUTH-002, OPS-003 if D2=B).
- **D4 AUTH-000 points your target does not answer:** identity source and registration (self sign-up, invite, researcher-created accounts), anonymous use of the query editor, the protected-route matrix, password recovery in the first release.
- **D5 Research data/LGPD:** which data T8/T9 collect, consent text and its owner, retention and deletion, who may export it, and whether an ethics committee review applies.
- **D6 Saved-query compatibility:** must the new app import existing `query_exported.json` files (raw Cytoscape `cy.json()`), or only a new versioned format?
- **D7 Open since September:** DEC-004 remote-endpoint policy (arbitrary vs allow-list) and DEC-005 upload limits/persistence, both via SEC-001, before public user tests.

## Backend gaps

- **OpenAPI:** present: OpenAPI 3.1 at `/openapi.json`, code-generated from route `describe` blocks, covered by `OpenApiRoutesTest`. To verify in T4 by actually generating a TypeScript client: whether every request/response schema is complete, and that `filterType` is published as string enums `"0"…"6"` while the JSON uses integers. `/health`, `/swagger` and `/openapi.json` sit outside `/api`, so the web proxy must forward them or the contract must call them internal.
- **Drawn-graph JSON:** none. The API takes a flat `where` list of `{subject, predicate, object, filterType}` strings plus `variableFilters`; node identity, kinds and stage order exist only in the browser (Cytoscape data plus `graph-model.js`). T4 needs a `QueryGraph` schema with kinds, typed RDF terms (datatype/language are lost today, per the audit) and a mapping to the existing request DTOs, so the backend contract does not change.
- **CORS/same origin:** no CORS plugin; same origin is assumed (Current Contracts Runtime). Keep it: Vite dev server proxies to `:8080`, production proxies through the `web` service. Cookie sessions (AUTH-000) also depend on same origin.
- **Saved-query format:** none on the server. Export is `JSON.stringify(cy.json())` saved as `query_exported.json` and imported with `cy.json({elements})` (`app-core.js`, `index2.html`): Cytoscape-internal, unversioned, includes positions and styles. T4/T8 need a versioned format (`formatVersion` field); no legacy importer (D6b).
- **Persistence and identity:** no database, users or sessions; uploaded graphs live in memory (`LocalGraphCache`) and are lost on restart. T6 adds PostgreSQL; graph persistence remains DEC-005.

## Decisions taken (2026-10-16)

| Decision | Answer | Recorded in |
|---|---|---|
| D1 | SvelteKit, directory `frontend/` | DEC-011, Current Contracts, audit note |
| D2 | University server | DEC-003, Open Decisions, roadmap note, BLOCKERS |
| D3 | Done legacy cards stay DONE; AUTH-002 and OPS-003 `CANCELLED` + "Superseded by" | AUTH-002, OPS-003 |
| D4 | Login creates users; anonymous query editor without questionnaires; no recovery | AUTH-000 (DONE), [[../09 - Decisions/Authentication Contract]] |
| D5 | LGPD ignored for now | DEC-003, STUDY-002 exclusions |
| D6 | Answered as: no access to proposed queries after final submission | STUDY-001 |
| D6b | Legacy `query_exported.json` files are not imported; new versioned format only | FE-042, FE-048 |

Planned cards (all BACKLOG): T1 FE-040, T2 QUAL-006, T3 FE-041, T4 FE-042 +
FE-043, T5 FE-044–FE-048, T6 BE-005, T7 AUTH-001 (reused) + AUTH-003, T8
STUDY-001, T9 STUDY-002, T10 QUAL-007, T11 OPS-006 (+ OPS-002/004/005 for the
server), T12 FE-049. D7 (SEC-001, DEC-004/005) is unchanged.

## Source files

- `AGENTS.md`, `tcc/90 - Tasks/{WORKER_PROMPT,FORMAT,TASKS}.md`, `tcc/90 - Tasks/items/*.md`
- `src/main/kotlin/com/example/sparqlqueryeasy/http/{HttpModule,QueryHttpModels,OpenApiModule}.kt`
- `sparql/app-core.js`, `sparql/index2.html`, `build.gradle.kts`, `Dockerfile`, `.env.example`, `package.json`
- [[../04 - Frontend/Frontend Evolution Audit]], [[../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap]], [[../09 - Decisions/Open Decisions]]
