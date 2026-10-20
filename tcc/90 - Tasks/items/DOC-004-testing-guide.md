---
id: DOC-004
title: Write a testing guide that a clean clone can follow layer by layer
status: BACKLOG
priority: P1
type: documentation
depends_on: [QUAL-012, QUAL-013, QUAL-014, QUAL-015, QUAL-016]
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
  real stack, visual, a11y, Kotlin), one command per layer, prerequisites
  (JDK 21, Node 22, `npx npm@11 ci`, Firefox via Playwright, Docker), how to
  add a fixture and a mock route, how to update API types and screenshots,
  what CI runs when.
- Link it from `frontend/README.md` and the Operational Map; keep commands
  in the Operational Map as the canonical list (no duplicated tables).

## Out of scope

- New commands or wrappers.

## Acceptance criteria

- [ ] From a fresh `git clone` into a temporary directory, each documented
  command runs and passes (results recorded in the execution log).
- [ ] `node scripts/check-project-docs.mjs` passes.

## Validation

Docs check and `git diff --check`; the clean-clone run above.
