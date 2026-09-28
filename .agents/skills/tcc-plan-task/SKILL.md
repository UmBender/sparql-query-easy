---
name: tcc-plan-task
description: Plan SPARQL EasyQuery extensions into small verifiable task cards and maintain its backlog without implementing product behavior.
---
# tcc-plan-task

Follow repository AGENTS.md and read the selected task first. Locate the
operational map at `tcc/06 - Development/Operational Map.md` and current
contracts at `tcc/09 - Decisions/Current Contracts.md` when needed.

1. Read the request and search existing cards by feature and ID in `tcc/90 - Tasks/items/`.
2. Inspect only the relevant source entry points; use the operational map if unfamiliar.
3. Distinguish current behavior, authorized behavior, reversible assumptions and product decisions.
4. Split work into small user-verifiable slices. Prefer a vertical slice over separate layer cards unless the boundary has an independent acceptance test.
5. Reuse existing cards and the YAML/status vocabulary in `tcc/90 - Tasks/FORMAT.md`; do not create a parallel backlog.
6. Record scope, exclusions, source symbols, dependencies, expected behavior and a meaningful oracle. Mark real decision blockers, not every implementation choice.
7. Define the smallest focused check and the closing gate from the operational map. Label proposed commands as proposed until they exist.
8. Update `tcc/90 - Tasks/TASKS.md`. Leave implementation cards BACKLOG unless execution is authorized and dependencies allow READY.

For ordered exploration, consult DEC-008 and existing FE-005/006/008/009/010 before adding work. Do not turn a formatted display label into a typed RDF binding or assume an additive API is approved merely because it is planned.

Finish with cards, execution order, actual open decisions and the scoped local commit.
