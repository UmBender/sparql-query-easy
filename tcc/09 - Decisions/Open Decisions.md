# Open Decisions

| ID | Status | Decision needed |
|---|---|---|
| DATA-001 | Approved | Keep the C# Brazilian football asset as the sole canonical built-in dataset. |
| DEC-002 | Approved | Keep `tcc/` and reference PDFs external to this application repository. |
| DEC-003 | Decision required | Production hosting platform, domain, DNS, TLS termination, and frontend origin. |
| DEC-004 | Decision required | Production remote-SPARQL endpoint policy: arbitrary endpoint versus allow-list. |
| DEC-005 | Decision required | Upload graph size, cache size, persistence, retention, and access-control policy. |
| DEC-006 | Decision direction approved | Implement authentication for `sparql/login.html`; protocol, credential source, and protected routes remain unspecified. |
| DEC-007 | Approved | Add Swagger/OpenAPI to the Kotlin application now. |

## Already documented decisions

- **Intended:** Kotlin development uses port 8080.
- **Intended:** Explicit JSON `400`/`404`/`502` errors are the Kotlin contract.
- **Intended:** `index2.html` is the authoritative frontend client contract.
- **Approved (2026-09-16):** The `tcc/` vault and reference PDFs remain
  external to the application repository.

## Source files

- `MIGRATION.md`
- `build.gradle.kts`
- `sparql/index2.html`
- `sparql/login.html`
