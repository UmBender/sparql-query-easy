---
title: SPARQL EasyQuery Thesis Knowledge Base
updated: 2026-09-27
---

# SPARQL EasyQuery

This vault is the evidence-based working knowledge base for the undergraduate thesis project. Application source remains the authority; notes label uncertainty instead of filling gaps with assumptions.

## Start here

- [[01 - Project/Workspace Inventory|Workspace inventory]]
- [[02 - Architecture/System Architecture|System architecture]]
- [[03 - Backend/API Contract|Current API contract]]
- [[04 - Frontend/Frontend Architecture|Frontend architecture]]
- [[05 - Migration/Migration Status|C# to Kotlin migration status]]
- [[06 - Development/Development Environment|Development environment]]
- [[08 - Quality/Quality and Compatibility|Quality and compatibility]]
- [[09 - Decisions/Open Decisions|Open decisions]]
- [[09 - Decisions/OpenAPI and Swagger Contract|OpenAPI and Swagger contract]]
- [[90 - Tasks/TASKS|Task index]]
- [Repository README](../README.md)

## Evidence vocabulary

- **Confirmed** — directly supported by current source/configuration.
- **Intended** — documented target or approved policy, not necessarily verified at runtime.
- **Inferred** — reasonable conclusion that still needs direct verification.
- **Potential issue** — risk or suspicious behavior requiring investigation.
- **Confirmed bug** — reproducible or source-proven defect.

## Current headline

**Confirmed:** Kotlin/Ktor implements the original controller routes and core
services. C# remains in the repository as the baseline. The corpus contains 34
reviewed C# harness captures; after the `BUG-001` repair, both local-search
cases are included with every other valid capture in the passing offline
comparator. Six exception-only captures remain documented intentional
non-equivalences. Browser flows are covered by offline Playwright tests.
Current remaining work is tracked in `remaining.md` and the task index rather
than in historical phase notes.

**Source files:** `README.md`, `AGENTS.md`, `MIGRATION.md`,
`MIGRATION_REPORT.md`, `remaining.md`,
`compatibility/Compatibility.Harness/Program.cs`,
`src/main/kotlin/com/example/sparqlqueryeasy/http/HttpModule.kt`,
`src/test/kotlin/com/example/sparqlqueryeasy/http/CaptureDrivenCompatibilityTest.kt`.
