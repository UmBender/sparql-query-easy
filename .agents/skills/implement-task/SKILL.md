---
name: implement-task
description: Implement one task card of SPARQL EasyQuery from start to local commit, in the fixed order used by unattended batches (also valid interactively).
---
# implement-task

Applies repository AGENTS.md and `tcc/90 - Tasks/WORKER_PROMPT.md`; this skill
only fixes the order and the batch deltas. In a batch session the rules in
`scripts/batch/unattended.md` and the task's section of `.batch/plan.md` come
first.

1. **Inspect.** `git branch --show-current`, `git status`, `git log --oneline -5`.
   On a continuation, the last commit and the working tree are the state.
2. **Read** the task card once (`tcc/90 - Tasks/items/<ID>-*.md`): objective,
   scope and exclusions, dependencies, acceptance criteria, validation. Read
   its `depends_on` cards only for the facts you need. Read one primary skill
   from `.agents/skills/` for the area (`tcc-backend`, `tcc-frontend`,
   `tcc-fullstack`, `tcc-test`, `tcc-style` for UI) and the contract rows the
   card links.
3. **Mark** the card `IN_PROGRESS` (the plan authorizes this card; do not
   promote any other).
4. **Test first** when behavior changes: add the failing focused test named in
   the card, run it, see it fail for the right reason.
5. **Implement** the smallest slice that meets the acceptance criteria. Keep
   Jena types in RDF infrastructure; no live Wikidata in ordinary tests; never
   change goldens just to pass.
6. **Validate.** Smallest focused check while editing, then the closing gate
   for the changed area from `tcc/06 - Development/Operational Map.md`.
7. **Document.** Update the card's conclusion (commands run, results,
   limitations), the affected canonical note, and the `TASKS.md` line.
   `DONE` needs verified acceptance; use `REVIEW` when the card has a human
   gate or a check only a person can do.
8. **Commit** once, selectively (`git add <paths>`, never `git add .`), message
   `<ID> <imperative summary>`. No push, merge, tag or amend.
9. **Report** result, validation, commit hash and real remaining limits. In a
   batch, the report is the `.batch/out/<ID>.status` file.
