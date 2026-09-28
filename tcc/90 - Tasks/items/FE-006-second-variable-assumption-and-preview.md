---
id: FE-006
title: Explore the second variable under an assumed first binding
status: BACKLOG
priority: P1
type: frontend
depends_on: [DEV-002, DEC-008, FE-005]
human_gate: false
created: 2026-09-27
updated: 2026-09-27
---
# Explore the second variable under an assumed first binding

## Objective

On hover or keyboard focus of a first-stage candidate, show bounded possible
values for the next ordered variable under that temporary typed binding;
selection commits it and advances to the next stage.

## Evidence and relevant files

`sparql/index2.html`; `frontend-tests/index2.spec.mjs`;
[[../../04 - Frontend/Two Variable Exploration Contract]];
[[../items/FE-005-first-variable-candidate-exploration]].

## Exact scope

Debounce/budget hover and focus requests, cancel or ignore stale responses,
cache per query signature/binding according to DEC-008, and show
loading/empty/error preview states. Display typed next-variable candidates
without altering graph data. Click/Enter commits the first binding and
advances. Changing assumption or order clears dependent preview/state.

## Explicitly out of scope

Three-or-more-stage completion, eager `n × m` candidate fetching, graph
replacement on hover, changing legacy `/api/query`, or live Wikidata tests.

## Dependencies

DEV-002, DEC-008, FE-005.

## Acceptance criteria

- [ ] Hover and keyboard focus produce equivalent next-stage previews.
- [ ] Only one bounded assumption path is requested at a time; rapid pointer
      movement cannot flood the API or display a stale response.
- [ ] Typed binding display and commitment match DEC-008/API-002.
- [ ] Changing an assumption clears dependent state safely; no graph mutation
      occurs during preview.
- [ ] Offline browser and Kotlin checks pass.

## Verification commands

```sh
npm run test:browser
GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew ktlintCheck detekt test --no-daemon
git diff --check
```

## Expected documentation updates

[[../../04 - Frontend/Request Flows]];
[[../../04 - Frontend/Two Variable Exploration Contract]].

## Risks

Hover-triggered remote work can be costly; cancellation alone does not
refund a request already sent. Use hard request budgets and delayed dispatch.

## Execution log

- 2026-09-27: Created; originally described a selected first binding.
- 2026-09-27: Re-scoped for hover/focus preview followed by explicit
  commitment; no implementation started.
