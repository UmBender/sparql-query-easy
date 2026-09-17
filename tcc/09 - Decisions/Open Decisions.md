# Open Decisions

| ID | Status | Decision needed |
|---|---|---|
| DEC-001 | Decision required | Canonical Brazilian football dataset and its intended endpoint identifier. |
| DEC-002 | Decision required | Whether `tcc/` and reference PDFs are versioned in this application repository. |
| DEC-003 | Decision required | Production hosting platform, domain, DNS, TLS termination, and frontend origin. |
| DEC-004 | Decision required | Production remote-SPARQL endpoint policy: arbitrary endpoint versus allow-list. |
| DEC-005 | Decision required | Upload graph size, cache size, persistence, retention, and access-control policy. |
| DEC-006 | Unverified | Role of `sparql/login.html`; no supporting authentication API was found. |
| DEC-007 | Decision required | Swagger/OpenAPI scope for Kotlin production deployment. |

## Already documented decisions

- **Intended:** Kotlin development uses port 8080.
- **Intended:** Explicit JSON `400`/`404`/`502` errors are the Kotlin contract.
- **Intended:** `index2.html` is the authoritative frontend client contract.

## Source files

- `MIGRATION.md`
- `build.gradle.kts`
- `sparql/index2.html`
- `sparql/login.html`
