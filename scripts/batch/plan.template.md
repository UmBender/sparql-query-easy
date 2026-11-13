# Batch plan — <date>

## Policies (owner, answered in the plan phase)
- Base branch: main. Each task runs on `batch/<ID>`; tasks that depend on an earlier batch task start from `after:<ID>`.
- Merge: no. Push: no. The owner integrates in the morning (`git merge --no-ff batch/<ID>` in queue order).
- Open choices: `decide-and-record` | `block`.
- Stop at: <HH:MM or none> (`BATCH_STOP_AT`).
- Model/effort: sonnet / medium unless a task says otherwise.

## Owner prerequisites (before `batch.sh run`)
- [ ] Working tree clean (commit or stash; the Obsidian workspace files count).
- [ ] Docker running (Testcontainers and the stack/screens gates need it).
- [ ] <install commands for tools missing from `command -v`, one per line>

## Order
| # | Task | Base | Gate | Why this position |
|---|---|---|---|---|
| 1 | <ID> | main | kotlin | independent first |

## <ID>: <title>
- **Authorization:** the owner authorizes this card (BACKLOG → IN_PROGRESS by the session).
- **Decisions already made:** <answers to every question the spec would ask>
- **Recommended defaults for open choices:** <option, reason>
- **Extra commands needed beyond the base allowlist:** <command> (checked with `command -v`)
- **Files in scope:** <paths from the card's Scope>
- **Block if:** <likely blockers: visual check, real server, missing token, big decision>
- **Manual checks for the owner:** <what only a human can verify>
