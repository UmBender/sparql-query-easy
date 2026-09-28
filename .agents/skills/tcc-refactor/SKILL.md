---
name: tcc-refactor
description: Prepare SPARQL EasyQuery code for an identified extension or remove demonstrated coupling while preserving behavior.
---
# tcc-refactor

Follow repository AGENTS.md and read the selected task first. Locate the
operational map at `tcc/06 - Development/Operational Map.md` and current
contracts at `tcc/09 - Decisions/Current Contracts.md` when needed.

1. Name the concrete motivating task and the source coupling that obstructs it.
2. Identify the smallest useful boundary and existing behavioral coverage. Add characterization only where a relevant risk has no oracle.
3. Plan a short sequence of extractions; keep structure, stack changes and behavior changes independently reviewable.
4. Preserve script initialization order, global entry points used by inline handlers, serialization, graph metadata and listener lifecycle where affected.
5. Validate each changed boundary with focused checks, then use the final area gate from the operational map.
6. Stop when the motivating task is easier to implement; do not build abstractions for hypothetical features.
7. Update only affected architecture/contract references and the task, then commit the scoped slice.

For frontend extraction, `build.gradle.kts` uses an explicit frontend resource include list and tests call browser globals through `window`. Moving code without updating these consumers can break distribution or tests even if the HTML still loads in a file browser.

For backend extraction, retain application-owned types at the RDF boundary and shared-client lifecycle ownership. A refactor does not authorize golden changes or altered error/status behavior.
