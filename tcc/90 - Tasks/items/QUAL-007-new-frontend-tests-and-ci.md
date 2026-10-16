---
id: QUAL-007
title: Add the new frontend test layers and a GitHub Actions CI for all gates
status: BACKLOG
priority: P1
type: quality
depends_on: [FE-040, FE-043]
human_gate: false
created: 2026-10-16
updated: 2026-10-16
---
# Add the new frontend test layers and a GitHub Actions CI for all gates

## Objective

T10. Skill: `tcc-test`. Deployment stays in OPS-005/OPS-006.

## Scope

- New app: Vitest browser mode, MSW handlers from the OpenAPI types, contract
  test against `/openapi.json`, Playwright e2e on the real stack with
  PokemonGen1, screenshot tests, @axe-core/playwright; all offline (QUAL-003
  egress rule).
- `.github/workflows/ci.yml`: Kotlin gate, legacy browser and query suites,
  new-app check/test/e2e; no deploy, no secrets.
- Operational Map: the new commands and closing gates.

## Acceptance criteria

- [ ] Each layer has at least one passing test and runs in CI.
- [ ] A deliberately failing test fails CI (verified once, then reverted).
