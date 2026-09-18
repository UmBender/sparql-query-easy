---
title: SPARQL EasyQuery Thesis Knowledge Base
updated: 2026-09-16
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
- [[90 - Tasks/TASKS|Task index]]

## Evidence vocabulary

- **Confirmed** — directly supported by current source/configuration.
- **Intended** — documented target or approved policy, not necessarily verified at runtime.
- **Inferred** — reasonable conclusion that still needs direct verification.
- **Potential issue** — risk or suspicious behavior requiring investigation.
- **Confirmed bug** — reproducible or source-proven defect.

## Current headline

**Confirmed:** Kotlin/Ktor implements the original controller routes and core
services. C# remains in the repository as the baseline. The compatibility
corpus contains reviewed C# harness captures; after the `BUG-001` harness
repair, both local-search cases are included in the passing Kotlin comparator.

**Source files:** `AGENTS.md`, `MIGRATION.md`, `MIGRATION_REPORT.md`, `compatibility/Compatibility.Harness/Program.cs`, `src/main/kotlin/com/example/sparqlqueryeasy/http/HttpModule.kt`.
