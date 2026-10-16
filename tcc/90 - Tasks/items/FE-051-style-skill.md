---
id: FE-051
title: Add a style skill that makes every UI change follow the tokens and the styleguide
status: BACKLOG
priority: P1
type: documentation
depends_on: [FE-050]
human_gate: false
created: 2026-10-16
updated: 2026-10-16
---
# Add a style skill that makes every UI change follow the tokens and the styleguide

## Objective

T3 part 3. Agents changing UI or CSS in `frontend/` load one skill that sends
them to the tokens and the styleguide instead of inventing values.
Main skill for writing it: `tcc-plan-task` conventions; documentation gate.

## Scope

- `.agents/skills/tcc-style/SKILL.md` plus the `.claude/skills/tcc-style`
  symlink (D-T3a) covering: when to use it (any UI or
  CSS change in `frontend/`), token rules, which component for which job,
  spacing and layout rules, accessibility rules (AA contrast, focus rings,
  labels), and a pre-merge checklist.
- It points to `frontend/src/lib/design/tokens.ts` and the `/styleguide`
  route and copies no token values.
- An entry in the `AGENTS.md` repository skills list (the repo has no
  `CLAUDE.md`, so the brief's pointer has nowhere else to go).
- Add `style` to the names in `scripts/check-skill-discovery.mjs` (seven
  Codex skills today, eight after).

Excluded: changing tokens or components; the legacy `sparql/` styles.

## Decision D-T3a: skill location and name (CONTRADICTS, resolved)

FE-041 originally said `.agents/skills/tcc-style/SKILL.md`; the T3 brief said
`.claude/skills/easyquery-style/SKILL.md` and "loads in Claude Code".
`.agents/skills/` is discovered by Codex (`check-skill-discovery.mjs` runs
`codex app-server`); Claude Code loads project skills from `.claude/skills/`.
Options were A (`.agents` only), B (`.claude` only) and C (both via symlink).

User decision (2026-10-16): **C, name `tcc-style`.** The canonical file is
`.agents/skills/tcc-style/SKILL.md`; `.claude/skills/tcc-style` is a symlink
to that directory. The Codex discovery check grows from seven to eight
names. Windows checkouts need Git symlinks enabled.

## Acceptance criteria

- [ ] `tcc-style` appears in Claude Code's skill list from the repo root
      and in Codex discovery.
- [ ] Every checklist item names a token group, component or rule that is
      visible on `/styleguide`; no hex value or numeric token is copied.
- [ ] `node scripts/check-project-docs.mjs` passes; `node scripts/check-skill-discovery.mjs`
      reports all eight skills.

## Validation

Documentation gate only: `node scripts/check-project-docs.mjs`,
`node scripts/check-skill-discovery.mjs`,
`git diff --check`.

## Execution log

- 2026-10-16: User answered D-T3a with option C and the name `tcc-style`;
  human gate cleared.
