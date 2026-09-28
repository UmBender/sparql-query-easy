# SPARQL EasyQuery development

## Scope and entry
- Extend the Kotlin/JVM + Ktor application and its authoritative frontend.
- Start with applicable AGENTS.md, the selected task, and one primary skill.
- Use [Operational Map](<tcc/06 - Development/Operational Map.md>) for paths and gates.
- Use [Current Contracts](<tcc/09 - Decisions/Current Contracts.md>) when changing behavior.
- MIGRATION.md and MIGRATION_REPORT.md are historical evidence: read relevant
  sections only. Ordinary features do not require appending migration history.

## Execution
- Work on one task or coherent slice at a time, with one agent by default.
- Do not spawn agents without an explicit request. Batch independent reads;
  sequence edits, gates and commits by their dependencies.
- An authorized task includes implementation, appropriate validation,
  affected documentation and a local commit. Continue without repeated consent.
- Resolve reversible local details by judgment. Ask only for missing decisions
  that change expected behavior or authorized scope.
- Use rg and targeted source reads. Expand investigation when evidence requires it.
- Avoid unrelated refactoring. Documentation/planning does not authorize
  production behavior changes.
- Use existing task cards/statuses under tcc/90 - Tasks; do not create a second backlog.
- Explicitly requested tasks may be selected directly; otherwise follow WORKER_PROMPT.
- Mark a selected card IN_PROGRESS; keep product decision gates intact.

## Contracts and evidence
- Preserve observable behavior unless a task or current decision authorizes change.
  Record and test the approved change in its canonical contract.
- Keep Jena types in RDF infrastructure and application-owned types at boundaries.
  Preserve request-local endpoint context and shared-client lifecycle ownership.
- Do not use default Jena rendering as the public RDF node format.
- Preserve capture corpora, provenance, RDF terms, binding presence and duplicates.
- Never change goldens just to silence failures; investigate implementation and oracle.
- Compare unordered result rows as multisets where applicable; preserve order only
  where the contract specifies it, such as ORDER BY.
- Ordinary tests must not call live Wikidata or other external services.
  Live integration tests are separate, opt-in and excluded from normal gates.
- Consult current contracts for routes, JSON, errors, SPARQL and graph interactions.
  Do not reopen approved decisions without evidence of a conflict.

## Validation
- During editing, run the smallest meaningful regression or focused check.
- Before completion, run the mandatory area/risk gate in the operational map.
- Reuse valid checks for unchanged code. Repeat when relevant changes or failures
  justify it; do not use clean or duplicate final gates routinely.
- Relevant failures block DONE. Distinguish new, pre-existing and environment failures.
- Add tests with changed behavior. Documentation/skills changes require documentation
  checks, not the product test suite.

## Git and completion
- Inspect initial branch, status and diff. Preserve unrelated work, including
  local IDE files and Obsidian workspace state.
- By default keep the current branch for a sequential task; do not create a branch
  per edit. If isolation is needed, use one task-named branch/worktree from the
  verified intended base. Never silently switch/reset unrelated work.
- After acceptance and gates, review the diff, stage explicit task paths/hunks,
  and create one focused local commit prefixed with the task ID.
- A dirty worktree alone is not a reason to skip a commit: exclude unrelated files.
  Mixed overlapping edits require preserving them and reporting the concrete issue.
- Do not use indiscriminate git add ., amend, destructive reset, force-push,
  hook bypass or global Git configuration changes.
- Local commit authorization does not imply push, merge or deploy; honor explicit
  session authorization for those actions.
- Report test/hook/identity failures honestly; do not fabricate a completed commit.
- Update the task and affected canonical note; refresh TASKS.md for lifecycle changes.
  Use BLOCKERS.md only for active blockers. Do not copy every completion into RUN_LOG.
- DONE requires verified acceptance and a local commit; REVIEW is for human validation.
- Report result, validation, commit hash and actual remaining limitations.

## Repository skills
Skills live in .agents/skills/<name>/SKILL.md. Read only the selected procedure:
- Specification/backlog: tcc-plan-task.
- Kotlin/API/RDF implementation: tcc-backend.
- Browser/graph interaction: tcc-frontend.
- One feature crossing API and browser: tcc-fullstack.
- Preparatory behavior-preserving extraction: tcc-refactor.
- Failing tests, regression design or gate selection: tcc-test.
- Frontend architecture/tooling decisions: tcc-frontend-audit.
