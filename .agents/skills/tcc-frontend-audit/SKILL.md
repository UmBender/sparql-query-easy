---
name: tcc-frontend-audit
description: Audit SPARQL EasyQuery frontend structure and compare incremental tooling options before a modularization or stack decision.
---
# tcc-frontend-audit

Follow repository AGENTS.md and read the selected task first. Locate the
operational map at `tcc/06 - Development/Operational Map.md` and current
contracts at `tcc/09 - Decisions/Current Contracts.md` when needed.

1. Inspect authoritative HTML, scripts/styles, global state, event/Ajax call sites, Cytoscape initialization, Ktor packaging and tests. Measure concentration without treating line count as proof of poor design.
2. Choose two actual backlog extensions and two documented defects as evaluation scenarios.
3. Map proposed graph domain, query extraction, actions, UI state, transport, rendering and initialization boundaries.
4. Compare at most three options: modularize current stack; add typing/build incrementally; adopt a component framework only if a concrete scenario justifies it.
5. Read current official documentation for finalists to check integration and limitations. If unavailable, label compatibility unverified; do not install dependencies for the audit.
6. Compare initial change scope, context per task, locality, pure testability, bug prevention, Cytoscape ownership, DTO/mock alignment, Ktor packaging/offline operation and thesis schedule. Label estimates; invent no benchmarks.
7. Explain DOM and Cytoscape ownership, listener disposal, state and stale-response handling for each option. AJAX alone is not evidence for a rewrite.
8. Recommend a first reversible slice with success criteria and rollback; make follow-up cards in the existing backlog.
9. Do not migrate production code as part of analysis. Finish with evidence, recommendation, tasks and scoped local commit.

Current entry points: `sparql/index2.html`, `build.gradle.kts`, `frontend-tests/index2.spec.mjs`, `frontend-tests/server.mjs`, and `http/HttpModule.kt`.

Consult the operational map and current contracts only as needed. Use the audit as the decision source; avoid duplicating it across the vault.
