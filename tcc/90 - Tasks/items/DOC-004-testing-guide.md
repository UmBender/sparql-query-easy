---
id: DOC-004
title: Write a testing guide that a clean clone can follow layer by layer
status: DONE
priority: P1
type: documentation
depends_on: [QUAL-012, QUAL-013, QUAL-014, QUAL-015, QUAL-016, QUAL-017]
human_gate: false
created: 2026-10-20
updated: 2026-10-20
---
# Write a testing guide that a clean clone can follow layer by layer

## Objective

T10 documentation. Testing facts are spread over `frontend/README.md`
("Test layers (QUAL-007)"), the Operational Map and
`tcc/08 - Quality/Quality and Compatibility.md`. Skill: `tcc-test`.

## Scope

- `tcc/08 - Quality/Testing Guide.md`: which layer to use for what (domain
  unit, store, component, MSW integration, contract, offline Playwright,
  real stack, compose smoke, visual, a11y, Kotlin), one command per layer, prerequisites
  (JDK 21, Node 22, `npx npm@11 ci`, Firefox via Playwright, Docker), how to
  add a fixture and a mock route, how to update API types and screenshots,
  what CI runs when.
- Link it from `frontend/README.md` and the Operational Map; keep commands
  in the Operational Map as the canonical list (no duplicated tables).

## Out of scope

- New commands or wrappers.

## Acceptance criteria

- [x] From a fresh `git clone` into a temporary directory, each documented
  command runs and passes (results recorded in the execution log).
- [x] `node scripts/check-project-docs.mjs` passes.

## Validation

Docs check and `git diff --check`; the clean-clone run above.

## Execution log

- 2026-10-20: `tcc/08 - Quality/Testing Guide.md`: prerequisites, a layer
  table (use, location, command), the closing-gate additions, the helpers
  (`src/lib/testing/`, page objects, `mockApi`), adding a fixture (legacy
  corpus frozen and read-only, saved queries, typed mock routes and
  overrides, Turtle for the stack, API seeding), updating API types and both
  kinds of screenshots, and the CI tiers. Linked from `frontend/README.md`
  and the Operational Map navigation; commands stay canonical in the map.
- Clean clone: `git clone` of `0a84c5e` into a scratch directory, then each
  guide command in order, all exit 0: `npm@11 ci` + Firefox (50 s), Kotlin
  gate (219 s), check, lint, `npm test` (Vitest 232 + 25, Playwright 110;
  334 s), `test:screens` 20, `test:stack` 20, `test:compose` 4 (no
  `easyquery-test` container left).
- Limitation: the machine's Playwright browser cache, Gradle cache
  (`/tmp/sparql-query-easy-gradle`) and Docker images were already present,
  so downloads were not timed; a first run on a new machine needs network
  for them.
- Validation: docs check, `git diff --check`.
- Commit: completion commit for this task.
