---
id: FE-006
title: Explore the second variable under an assumed first binding
status: BACKLOG
priority: P1
type: frontend
depends_on: [DEC-008, FE-005]
human_gate: false
created: 2026-09-27
updated: 2026-09-27
---
# Explore the second variable under an assumed first binding

## Objective

Show bounded second-variable candidates and the approved result/query preview
after a user explicitly assumes the first binding.

## Acceptance criteria

- [ ] Binding display, substitution, preview, and request bounds follow `DEC-008`.
- [ ] Changing an assumption clears dependent state safely.
- [ ] Offline browser and Kotlin checks pass.

## Execution log

- 2026-09-27: Created; waits for `DEC-008` and `FE-005`.
