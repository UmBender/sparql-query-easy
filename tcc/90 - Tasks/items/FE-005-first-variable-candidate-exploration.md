---
id: FE-005
title: Fetch bounded candidates for the first query variable
status: BACKLOG
priority: P1
type: frontend
depends_on: [DEV-002, DEC-008, FE-009, BE-002]
human_gate: false
created: 2026-09-27
updated: 2026-09-27
---
# Fetch bounded candidates for the first query variable

## Objective

Fetch and render bounded, typed candidates for the first variable in the
user's numbered block order, without resolving later variables yet.

## Evidence and relevant files

`sparql/index2.html` (`runQuery`, `getQuery`, `#two-variable-panel`);
`frontend-tests/index2.spec.mjs`;
[[../../04 - Frontend/Two Variable Exploration Contract]]. Existing
`/api/query` returns display-oriented one-variable values; BE-002 provides
the approved typed candidate contract.

## Exact scope

Call the additive stage API once for the first ordered variable. Render
typed labels/IDs, bound/unbound and duplicate behavior as DEC-008 specifies,
loading/empty/error states, cap/paging and explicit selection. Preserve
zero/one-variable execution; do not request candidates for all later stages.

## Explicitly out of scope

Hover previews, second-stage binding, graph replacement, unbounded remote
calls, or changing the old `/api/query` response.

## Dependencies

DEV-002, DEC-008, FE-009, BE-002.

## Acceptance criteria

- [ ] First request uses the reordered first variable and approved cap/paging.
- [ ] Typed candidates and loading/empty/error states match API-002/DEC-008.
- [ ] Selection is explicit panel state; no later variable is queried eagerly.
- [ ] Offline browser and Kotlin checks pass with old flows unchanged.

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

Rows from the display-only legacy endpoint must not be used as binding terms.
Paging and request caps must follow the approved contract.

## Execution log

- 2026-09-27: Created; originally waited for `DEC-008` and `FE-004`.
- 2026-09-27: Re-scoped for the user's ordered 2+ variable design. Now waits
  for the revised workflow, order menu, and typed stage route. No code changed.
