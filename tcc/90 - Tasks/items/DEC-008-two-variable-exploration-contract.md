---
id: DEC-008
title: Decide the ordered multi-variable query exploration contract
status: DONE
priority: P1
type: decision
depends_on: [API-001]
human_gate: true
created: 2026-09-27
updated: 2026-09-28
---
# Decide the ordered multi-variable query exploration contract

## Objective

Define user-ordered, bounded staged exploration for two or more variables
without an uncontrolled Cartesian-product query. The user has specified an
orderable Scratch-like menu near Run Query: numbered variable entries can be
reordered, and hovering or focusing a candidate previews the possible values
of the next variable under that temporary assumption. A deliberate selection
advances the staged exploration. This is intended behavior, not current code.

## Evidence and relevant files

`sparql/index2.html` currently opens a panel only for exactly two distinct
variables, detects node values and edge predicates, then sends no candidate
request. `POST /api/query` projects one variable and returns display-oriented
`PropertyDtoResponse`, not a typed RDF binding. See
[[../../04 - Frontend/Two Variable Exploration Contract]].

## Scope

Approve and document:

- Whether the order menu covers only variable **nodes**, or also variable
  predicates and repeated variables; how disconnected graph components and
  parallel predicate variables are handled.
- Numbering, drag/drop and keyboard reorder semantics; whether order is saved
  with graph export/import or is session-only; when graph edits invalidate it.
- Hover/focus preview versus click/Enter commitment, and what “possible state”
  means (next-variable candidates, graph replacement, or both).
- Candidate cap, pagination, concurrency, debounce, cancellation, cache and
  remote request budget so pointer movement cannot create unbounded requests.
- Typed IRI/literal/blank-node binding constraints, duplicate and unbound
  rows, ordered results, zero/one/two/more-than-two variables, final action,
  empty/loading/error states and endpoint changes.
- Whether staged queries need an additive typed API. Existing `/api/query`
  response and captured C# contracts must not be silently changed.

## Out of scope

Implementation, authentication, live endpoints, changing C# captures, or
unrestricted raw SPARQL.

## Acceptance criteria

- [x] All choices above are recorded in the frontend contract and approved.
- [x] Request budget explicitly prevents accidental `n × m` exploration and
      unbounded hover-triggered remote calls.
- [x] Follow-on `API-002`, `FE-005`, and `FE-006` match the approved contract.

## Verification commands

```sh
rg -n 'variableName|buildFilters|extractVariableName|getQueryVariables' sparql src/main/kotlin tcc
git diff --check
```

## Risks

Unlimited candidate pages, hover floods and unstable traversal selection can
create expensive or misleading queries. Literal values must not be converted
to raw IRIs; labels alone are insufficient to reconstruct RDF bindings.

## Execution log

- 2026-09-27: Created from source evidence and the approved staged direction.
- 2026-09-27: Expanded planning scope to ordered 2+ variables and hover/focus
  previews at the user's request. No product choices beyond that direction
  were assumed; implementation waits for the revised development loop and
  this human contract decision.
- 2026-09-28: User approved the recommended bundle: blocks for every distinct
  node/predicate variable name in the first component; sorted initial order,
  drag plus Move up/down, session-only and reset on signature change; 300 ms
  hover/focus preview with one in-flight aborted request and in-memory cache;
  Limit-sized pages capped at 50 with offset "Load more"; typed IRI/literal
  terms, unbound dropped, blank nodes unselectable; additive typed stage API;
  final summary with explicit **Apply to graph**. Recorded in the contract.
