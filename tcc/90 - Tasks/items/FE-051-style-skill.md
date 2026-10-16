---
id: FE-051
title: Add a style skill that makes every UI change follow the tokens and the styleguide
status: BACKLOG
priority: P1
type: documentation
depends_on: [FE-050]
human_gate: true
created: 2026-10-16
updated: 2026-10-16
---
# Add a style skill that makes every UI change follow the tokens and the styleguide

## Objective

T3 part 3. Agents changing UI or CSS in `frontend/` load one skill that sends
them to the tokens and the styleguide instead of inventing values.
Main skill for writing it: `tcc-plan-task` conventions; documentation gate.

## Scope

- One `SKILL.md` (location per D-T3a) covering: when to use it (any UI or
  CSS change in `frontend/`), token rules, which component for which job,
  spacing and layout rules, accessibility rules (AA contrast, focus rings,
  labels), and a pre-merge checklist.
- It points to `frontend/src/lib/design/tokens.ts` and the `/styleguide`
  route and copies no token values.
- An entry in the `AGENTS.md` repository skills list (the repo has no
  `CLAUDE.md`, so the brief's pointer has nowhere else to go).
- Discovery check update per D-T3a (`scripts/check-skill-discovery.mjs`
  lists the seven Codex skills today).

Excluded: changing tokens or components; the legacy `sparql/` styles.

## Decision needed: D-T3a skill location and name (CONTRADICTS)

FE-041 (approved backlog) says `.agents/skills/tcc-style/SKILL.md` plus an
`AGENTS.md` entry. The T3 brief says `.claude/skills/easyquery-style/SKILL.md`
and "loads in Claude Code". Repository skills under `.agents/skills/` are
discovered by Codex (`check-skill-discovery.mjs` runs `codex app-server`);
Claude Code loads project skills from `.claude/skills/`, which does not
exist here yet.

- A: `.agents/skills/tcc-style/` only. Matches the existing convention and
  Codex check; Claude Code does not auto-load it (only via AGENTS.md
  reading), so the brief's "loads in Claude Code" criterion fails.
- B: `.claude/skills/easyquery-style/` only. Loads in Claude Code; breaks the
  "skills live in .agents/skills" rule in AGENTS.md and is invisible to the
  Codex check; introduces a second skill folder and naming scheme.
- C: canonical file `.agents/skills/tcc-style/SKILL.md` plus
  `.claude/skills/tcc-style` as a symlink to it. One source, both tools load
  it, `tcc-` naming kept; the Codex check grows to eight names. Costs: a
  symlink in Git (works on Linux/macOS; Windows checkouts need symlinks
  enabled).

Recommendation: C. Name `tcc-style` (matches the other seven skills) unless
the user prefers `easyquery-style`.

## Acceptance criteria

- [ ] The skill appears in Claude Code's skill list from the repo root
      (and in Codex discovery if D-T3a is A or C).
- [ ] Every checklist item names a token group, component or rule that is
      visible on `/styleguide`; no hex value or numeric token is copied.
- [ ] `node scripts/check-project-docs.mjs` passes; the discovery check
      passes for the chosen location(s).

## Validation

Documentation gate only: `node scripts/check-project-docs.mjs`,
`node scripts/check-skill-discovery.mjs` (if Codex discovery applies),
`git diff --check`.
