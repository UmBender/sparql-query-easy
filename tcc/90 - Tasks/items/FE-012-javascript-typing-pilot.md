---
id: FE-012
title: Evaluate a limited JavaScript type-checking pilot
status: BACKLOG
priority: P1
type: investigation
depends_on: [FE-011]
human_gate: false
created: 2026-09-28
updated: 2026-09-28
---
# Evaluate a limited JavaScript type-checking pilot

## Objective and main skill

Determine whether JSDoc/checkJs catches real query-model or API-boundary mistakes at acceptable transition cost.
Use `tcc-frontend-audit`.

## Evidence and scope

Confirmed entry points: `package.json; extracted query module from FE-011; frontend-tests; build.gradle.kts`.

Evaluate the extracted module against the four audit scenarios. Propose compiler version/configuration, new commands and a small pilot only where useful; do not install dependencies, convert the entire UI or add Vite without an approved implementation task.

See [[../../04 - Frontend/Frontend Evolution Audit]] for reasoning and
[[../../09 - Decisions/Current Contracts]] for preserved behavior.

## Acceptance criteria

- [ ] Recommendation cites actual module boundaries and at least one meaningful error class; estimates are labeled.
- [ ] Costs for types, build/packaging and maintenance are documented; retaining untyped modules is a valid result.
- [ ] Any implementation follow-up is a small independently verifiable card.

## Validation

```sh
git diff --check
```

Apply the final area gate from [[../../06 - Development/Operational Map]].
A new pure-test command is proposed only in FE-011; confirm it exists before
reporting it as run.

## Dependencies and documentation

Depends on FE-011. Update this card, TASKS.md and the affected audit,
quality or frontend note only. No automatic implementation of later cards.

## Risks

Static typing does not solve stale responses or graph lifecycle automatically.

## Execution log

- 2026-09-28: Created by DEV-001 frontend audit; not started.
