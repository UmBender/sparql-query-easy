---
name: tcc-test
description: Diagnose failing SPARQL EasyQuery tests, add meaningful regressions, or select and execute validation for a change.
---
# tcc-test

Follow repository AGENTS.md and read the selected task first. Locate the
operational map at `tcc/06 - Development/Operational Map.md` and current
contracts at `tcc/09 - Decisions/Current Contracts.md` when needed.

1. Map the diff to observable risks and the nearest existing tests. Choose the minimum test that can fail for the defect.
2. Reproduce a bug before correction where possible and verify the failure reason; distinguish an environment failure from a product regression.
3. Use unit, HTTP contract, capture comparison and browser layers deliberately. Do not repeat the same oracle at every layer without a boundary risk.
4. Preserve RDF term detail, binding presence, duplicate multiplicity and the documented unordered/ORDER BY comparison rules.
5. Ordinary tests must not call external services. Browser tests currently stub JavaScript but still reference external CSS/fonts; QUAL-003 tracks full egress isolation. Do not claim offline coverage until unexpected network requests fail explicitly.
6. During editing, run focused checks. Before completion, run the area gate from the operational map once on the final state; reuse results for unchanged code.
7. Report exact commands, results, pre-existing failures and limitations. Historical reports do not prove a current test run.
8. If changes were made, update their task and commit under AGENTS.md.

Existing commands: `npm run test:browser -- --grep 'case text'`; Gradle `test --tests 'fully.qualified.TestClass'`; full gate `ktlintCheck detekt test`. Do not add `clean` routinely or skip a mandated closing gate because a focused test passed.

Use `CaptureDrivenCompatibilityTest`, `RetirementSuccessCompatibilityTest` and `OpenApiRoutesTest` when their contracts are affected; do not weaken them.
