---
id: DEC-008
title: Decide the two-variable query exploration contract
status: BLOCKED
priority: P1
type: decision
depends_on: [API-001]
human_gate: true
created: 2026-09-27
updated: 2026-09-27
---
# Decide the two-variable query exploration contract

## Objective

Define a bounded staged exploration of two variables without an uncontrolled
Cartesian-product query.

## Scope

Approve: first-variable ordering/user choice; candidate cap, paging, and remote
request budget; supported variable positions; typed IRI/literal binding
substitution; second-stage preview/final action; and zero/one/more-than-two
variable behavior with loading/error/empty states.

## Out of scope

Implementation, authentication, live endpoints, or unrestricted raw SPARQL.

## Acceptance criteria

- [ ] All choices are recorded and approved.
- [ ] The request budget explicitly prevents accidental `n × m` exploration.
- [ ] `FE-005` and `FE-006` reflect the approved contract.

## Verification commands

```sh
rg -n 'variableName|buildFilters|extractVariableName' sparql src/main/kotlin tcc
git diff --check
```

## Risks

Unlimited candidate pages and unstable traversal selection can create expensive
or misleading queries. Literal values must never be converted to raw IRIs.

## Execution log

- 2026-09-27: Created from source evidence and the approved staged direction.
