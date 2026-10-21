---
id: QUAL-018
title: Fail CI if jQuery or legacy page files come back, and confirm every test layer is green
status: BACKLOG
priority: P2
type: quality
depends_on: [DEC-018, FE-054, DOC-006, DOC-007]
human_gate: false
created: 2026-10-20
updated: 2026-10-20
---
# Fail CI if jQuery or legacy page files come back, and confirm every test layer is green

## Objective

T12 acceptance: "no jQuery or legacy CSS left in the repo" and "all test
layers green after the removal". Both held when FE-049 closed (2026-10-18),
but nothing stops them regressing. Skill: `tcc-test`.

## Scope

- A proposed check, `node scripts/check-legacy-free.mjs`, run in the CI
  `frontend` job: fails on a `jquery`, `materialize` or `intro.js`
  dependency in any `package.json`/lockfile, on a tracked `sparql/` or
  `frontend-tests/` path, on tracked `.css` outside `frontend/src`, and on
  `jquery`/`$.ajax` in tracked source. History is allowed by an explicit
  list: `tcc/`, `MIGRATION*.md`, `fixtures/legacy/`, and the oracles kept
  by DEC-018 Q2.
- Run every layer once on the final state and record the results here.

## Out of scope

- Removing the kept oracles (DEC-018 Q2 A keeps them); new product tests.

## Acceptance criteria

- [ ] The check passes on the final tree and fails when a test fixture adds
  `jquery` to a `package.json` or a file under `sparql/`.
- [ ] Kotlin gate, new frontend gate, `test:screens`, `test:stack` and
  `test:compose` pass on the final state (results in the log).

## Validation

The check's own test; the CI gate from the Operational Map (workflow
changed), plus the five layers above.
