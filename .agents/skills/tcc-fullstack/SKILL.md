---
name: tcc-fullstack
description: Deliver one SPARQL EasyQuery feature that requires coordinated API and browser changes.
---
# tcc-fullstack

Follow repository AGENTS.md and read the selected task first. Locate the
operational map at `tcc/06 - Development/Operational Map.md` and current
contracts at `tcc/09 - Decisions/Current Contracts.md` when needed.

1. Define the minimum authorized input/output/error contract and one user-visible acceptance case.
2. Identify a small vertical slice in the existing task system; inspect its API and frontend entry points.
3. Read the backend skill only for its service/HTTP phase and the frontend skill for the browser phase. Do not create separate agents or load all skills.
4. Implement the service and route contract test, then connect the client and verify local integration.
5. Keep browser fixture responses aligned with DTOs and OpenAPI. Add a boundary test where an actual mismatch could escape mocks.
6. Exercise meaningful empty/error/cancellation paths and typed RDF handling in the affected flow.
7. Run the union of required area gates once on the final state. Packaging changes require the distribution gate too.
8. Update the canonical contract and task conclusion, then make one coherent local commit for the accepted slice.

Use `http/HttpModule.kt` and `sparql/index2.html` as entry points. Existing `/api/query` projects one variable; new staged-query behavior is governed by DEC-008/API-002 and is not preapproved by this skill.

Preserve old capture tests. Separate product decisions from routine implementation choices and report a concrete blocker if a required contract is still unresolved.
