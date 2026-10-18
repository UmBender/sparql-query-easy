---
name: tcc-frontend
description: Implement or fix SPARQL EasyQuery browser interactions, Cytoscape graph actions, UI state and API communication.
---
# tcc-frontend

Follow repository AGENTS.md and read the selected task first. Locate the
operational map at `tcc/06 - Development/Operational Map.md` and current
contracts at `tcc/09 - Decisions/Current Contracts.md` when needed.

1. Start at the feature in `frontend/src/lib/features/` that owns the event (see `tcc/04 - Frontend/Frontend Architecture.md`), the store or domain operation it calls, and the nearest case in `frontend/tests/` or the domain specs; the parity checklist names the retired page's expected behavior.
2. Trace event → state/graph → filters → HTTP → result → graph application only for the affected flow.
3. Check the relevant frontend contract. Node and edge identity differ; predicate binding must retain edge identity, topology and unrelated metadata. A variable is a whole valid value, not a substring.
4. Preserve the current component-selection policy unless the task approves changing it. Keep the parallel-predicate guard and `filterType: 0` semantics.
5. Keep query state in the store and domain; Cytoscape is a view driven by `viewElements`. Do not undertake a broad extraction implicitly.
6. Handle empty/loading/error states, cancellation and stale responses where affected. Avoid duplicate listeners and references to removed graph elements.
7. Preserve keyboard focus, Escape and dismissal semantics of the specific menu being changed; do not impose one menu's dismissal rule on another.
8. Test transformations in Vitest and interactions in Playwright with the typed mock API (`frontend/tests/support/mock-api.ts`); use `test:stack` when the real backend matters. Use the frontend gate from the operational map.

Known ownership: `query-store.svelte.ts` owns query state; `editor-controller.svelte.ts` owns menus, connections, results and View SPARQL; `graph-canvas.svelte` owns the Cytoscape instance. Visual changes also follow `tcc-style`.

Do not change framework, bundler or transport library without its own task. Update the affected contract and make the scoped local commit.
