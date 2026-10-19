# Open Decisions

For active development use [[Current Contracts]] and [[Development Workflow]].
The decision index and dated approvals below provide rationale and history.

| ID | Status | Decision needed |
|---|---|---|
| DATA-001 | Approved | Keep the C# Brazilian football asset as the sole canonical built-in dataset. |
| DEC-002 | Approved | Version the Markdown vault; keep PDF binaries external to Git. Applied by `REPO-001`. |
| DEC-003 | Approved (2026-10-16) | University server with Docker Compose (`db`, `backend`, `web` same origin); server DNS/TLS/access facts still open in OPS-002/005. [[../90 - Tasks/items/DEC-003-production-hosting-target]]. |
| DEC-004 | Decision required | Production remote-SPARQL endpoint policy: arbitrary endpoint versus allow-list. |
| DEC-005 | Decision required | Upload graph size, cache size, persistence, retention, and access-control policy. |
| DEC-006 | Approved (2026-10-16) | AUTH-000: self-registration at login, anonymous query editor, study routes need a session, no recovery. [[Authentication Contract]]. |
| DEC-007 | Approved | Generate OpenAPI 3.1 from Ktor code; publish public `/swagger` and `/openapi.json` endpoints in every environment; defer authentication. |
| DEC-011 | Approved (2026-10-16) | SvelteKit app in `frontend/` beside `index2.html`, cutover by FE-049. [[../90 - Tasks/items/DEC-011-frontend-stack-decision]]. |
| DEC-009 | Resolved | Keep Kotlin `200 application/json {"status":"ok"}` as an approved intentional difference from captured C# `200 text/plain Healthy`; do not claim equivalence. |
| DEC-012 | Approved (2026-10-18) | Persistence and real-stack tests move from embedded PostgreSQL to Testcontainers `postgres:17-alpine` (user choice B); implemented by QUAL-011. [[../90 - Tasks/items/DEC-012-test-database-engine]]. |
| DEC-013 | Approved (2026-10-18) | T7 brief changes nothing in AUTH-000: keep `username` (no email), keep `GET /api/auth/session`, keep the application-owned session guard instead of the Ktor auth plugins; roles deferred to T9 (STUDY-002). [[../90 - Tasks/items/DEC-013-t7-auth-brief-differences]]. |
| DEC-014 | Decision required | T8 brief vs STUDY-001: attempts per task, feedback visibility, seed file vs admin routes, set vs multiset comparison, server-side graph mapping, LGPD for submissions. [[../90 - Tasks/items/DEC-014-t8-study-brief-differences]]. |

## Already documented decisions

- **Intended:** Kotlin development uses port 8080.
- **Intended:** Explicit JSON `400`/`404`/`502` errors are the Kotlin contract.
- **Intended:** `index2.html` is the authoritative frontend client contract.
- **Approved (2026-09-21):** The Markdown Obsidian vault remains versioned;
  PDF binaries are external; `REPO-001` untracked and ignored them without a
  history rewrite.
- **Approved direction (2026-09-21):** Implement authentication and
  Swagger/OpenAPI after their decision-first tasks are approved.
- **Approved (2026-09-27):** Generate OpenAPI 3.1 from Ktor code and publish
  public `/swagger` and `/openapi.json` endpoints in development and
  production. Authentication remains deferred until user testing.
- **Approved (2026-09-27):** Capture three remaining C# success cases before
  retirement, preserve the original 34, and waive further C# middleware-error
  equivalence. The health capture exposed a success-response difference that
  was approved under [[../90 - Tasks/items/DEC-009-health-response-contract]].
- **Approved (2026-09-27):** Archive the legacy .NET workflow outside the
  active GitHub Actions directory on `kotlin`, retain its configuration, and
  create no Kotlin deployment workflow until hosting and release choices are
  made. The archive change is included in the direct `main` integration; the user reports
  no enabled workflow in this fork's GitHub Actions UI.
  See [[../07 - Operations/Archived .NET Deployment Workflow]] and OPS-005.

## Source files

- `MIGRATION.md`
- `build.gradle.kts`
- `sparql/index2.html`
- `sparql/login.html`
- `tcc/09 - Decisions/Repository Login and OpenAPI Scope.md`
- `tcc/09 - Decisions/OpenAPI and Swagger Contract.md`
- `compatibility/retirement-expected/README.md`
