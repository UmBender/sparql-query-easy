---
id: QUAL-004
title: Make browser tests wait for the startup layout before setting the viewport
status: DONE
priority: P1
type: quality
depends_on: [QUAL-003]
human_gate: false
created: 2026-09-28
updated: 2026-09-28
---
# Make browser tests wait for the startup layout before setting the viewport

## Objective

The full browser suite failed intermittently in the FE-017 possible-graph test
(main viewport expected zoom 1 / pan 0, received zoom 2.89) and once in the
FE-013 edge-menu test. Each passed in isolation. Skill: `tcc-test`.

## Evidence

The page's animated startup `cose` layout (`fit: true`) calls `cy.fit()` when
it stops. That can happen after `page.goto` resolves on `load`: an instrumented
run logged `load` reset at 181 ms and the layout stop with the fit at 262 ms.
`disableAutoLayout` then reset the viewport too early. This was a test
harness race, not a product regression.

## Change

`beforeEach` wraps the `cytoscape` factory in an init script so the startup
layout's `stop` callback resolves `window.__startupLayoutDone`;
`disableAutoLayout` awaits it before resetting the viewport. No product code
changed.

## Acceptance criteria

- [x] Full browser suite passes repeatedly without the viewport race.

## Execution log

- 2026-09-28: Baseline at `c328875`: 51/53 and 52/53 with the two failures
  above, passing in isolation. After the fix: `npm run test:browser` 53/53
  twice in a row.
