---
id: DEV-002
title: Approve the revised feature delivery workflow
status: BLOCKED
priority: P0
type: development
depends_on: []
human_gate: true
created: 2026-09-27
updated: 2026-09-27
---
# Approve the revised feature delivery workflow

## Objective

Honor the user's pause before implementing ordered multi-variable exploration.
The user will first change the development loop and `AGENTS.md` to make task
ownership, testing, branches, and one focused commit per task reliable.

## Evidence and relevant files

`AGENTS.md`; [[../WORKER_PROMPT]]; `build.gradle.kts`; `package.json`;
`playwright.config.mjs`; [[../TASKS]]. Existing browser and Kotlin suites run
separately, and the current worker prompt makes commits conditional.

## Exact scope

Record the approved new process: task/branch ownership, isolation or
parallelism rules, focused test command per slice, broader gate, review/merge
policy, and a required task-ID commit before starting the next task. Reconcile
the worker prompt and cards with the user's new `AGENTS.md` only after that
file is actually changed and approved. Record the user's preference for a
stronger reasoning model on this complex feature when model selection is
available; do not assume parallel workers are safe under the old loop.

## Explicitly out of scope

Changing `AGENTS.md` on the user's behalf now, implementing the query feature,
installing dependencies, or rewriting Git history.

## Dependencies

Human-provided workflow changes and explicit approval.

## Acceptance criteria

- [ ] User's revised `AGENTS.md` and development-loop choices are available.
- [ ] Task worker, test commands, branch policy, and per-task commit rule are
      consistent and documented; unrelated in-progress work is preserved.
- [ ] User approves starting the ordered-query implementation cards.

## Verification commands

```sh
git diff --check
rg -n 'commit|branch|test|parallel' AGENTS.md 'tcc/90 - Tasks/WORKER_PROMPT.md'
```

## Expected documentation updates

[[../WORKER_PROMPT]], [[../TASKS]], [[../../06 - Development/Development Environment]].

## Risks

Starting implementation under the old process would repeat the user's known
branch/test/commit problems. Do not mark this DONE based on an inferred policy.

## Execution log

- 2026-09-27: Created as a human gate at the user's explicit request. No
  workflow, application code, branch, or test configuration was changed.
