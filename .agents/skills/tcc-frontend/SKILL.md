---
name: tcc-frontend
description: Implement or fix SPARQL EasyQuery browser interactions, Cytoscape graph actions, UI state and API communication.
---
# tcc-frontend

Follow repository AGENTS.md and read the selected task first. Locate the
operational map at `tcc/06 - Development/Operational Map.md` and current
contracts at `tcc/09 - Decisions/Current Contracts.md` when needed.

1. Start at the event or action in `sparql/index2.html` and the nearest case in `frontend-tests/index2.spec.mjs`.
2. Trace event → state/graph → filters → HTTP → result → graph application only for the affected flow.
3. Check the relevant frontend contract. Node and edge identity differ; predicate binding must retain edge identity, topology and unrelated metadata. A variable is a whole valid value, not a substring.
4. Preserve the current component-selection policy unless the task approves changing it. Keep the parallel-predicate guard and `filterType: 0` semantics.
5. Extract pure calculations only where the task benefits. Keep DOM/Cytoscape effects at an explicit boundary; do not undertake a broad extraction implicitly.
6. Handle empty/loading/error states, cancellation and stale responses where affected. Avoid duplicate listeners and references to removed graph elements.
7. Preserve keyboard focus, Escape and dismissal semantics of the specific menu being changed; do not impose one menu's dismissal rule on another.
8. Test transformations with deterministic data and important interactions through Playwright with simulated/local API. Use the browser gate from the operational map.

Known ownership: `index2.html` owns `cy`, `trData`, actions and initialization. The Ktor distribution copies an explicit list of frontend assets in `build.gradle.kts`; new files require packaging checks.

Do not change framework, bundler or transport library without its own task. Update the affected contract and make the scoped local commit.
