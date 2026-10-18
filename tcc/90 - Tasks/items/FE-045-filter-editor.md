---
id: FE-045
title: Edit value and value-variable filters with histogram and text suggestions
status: BACKLOG
priority: P1
type: frontend
depends_on: [FE-044]
human_gate: false
created: 2026-10-16
updated: 2026-10-16
---
# Edit value and value-variable filters with histogram and text suggestions

## Objective

T5b. Skill: `tcc-frontend`. Spec: BE-003, BE-004, FE-026, FE-030, FE-034,
FE-035, FE-038 and the Numeric filters / Value variables rows of
[[../../09 - Decisions/Current Contracts]].

## Scope

Exact, starts with, contains, at least, at most, between, MAX/MIN (not on
value variables); histogram of real values from `numeric-profile`; cycling
over kept entities; text suggestions via `stage`; Superforms + Zod validation.

## Fixture scenarios (QUAL-009)

`filter-exact-literal`, `filter-starts-with`, `filter-contains`, `numeric-profile-edit-between`, `filter-max-tie`, `filter-min-tie`, `value-variable-*`, `text-suggestions-*`, `add-value-filter`. See `fixtures/legacy/README.md` and [[../../04 - Frontend/Frontend Parity Checklist]].

## Acceptance criteria

- [ ] QUAL-006 rows for filters pass; request payloads equal the legacy ones.
