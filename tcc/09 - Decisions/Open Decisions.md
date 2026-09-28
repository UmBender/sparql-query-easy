# Open Decisions

| ID | Status | Decision needed |
|---|---|---|
| DATA-001 | Approved | Keep the C# Brazilian football asset as the sole canonical built-in dataset. |
| DEC-002 | Approved | Version the Markdown vault; keep PDF binaries external to Git. `REPO-001` applies the decision. |
| DEC-003 | Decision required | Production hosting platform, domain, DNS, TLS termination, and frontend origin. |
| DEC-004 | Decision required | Production remote-SPARQL endpoint policy: arbitrary endpoint versus allow-list. |
| DEC-005 | Decision required | Upload graph size, cache size, persistence, retention, and access-control policy. |
| DEC-006 | Decision direction approved | Implement authentication; `AUTH-000` must decide identity, sessions, anonymous access, protected routes, and security controls first. |
| DEC-007 | Approved | Generate OpenAPI 3.1 from Ktor code; publish public `/swagger` and `/openapi.json` endpoints in every environment; defer authentication. |
| DEC-009 | Resolved | Keep Kotlin `200 application/json {"status":"ok"}` as an approved intentional difference from captured C# `200 text/plain Healthy`; do not claim equivalence. |

## Already documented decisions

- **Intended:** Kotlin development uses port 8080.
- **Intended:** Explicit JSON `400`/`404`/`502` errors are the Kotlin contract.
- **Intended:** `index2.html` is the authoritative frontend client contract.
- **Approved (2026-09-21):** The Markdown Obsidian vault remains versioned;
  PDF binaries are external and will be untracked by `REPO-001` without a
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
  made. `master` still needs the archive change integrated; the user reports
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
