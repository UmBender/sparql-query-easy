---
id: FE-049
title: Make the SvelteKit app the authoritative frontend and retire index2.html
status: BACKLOG
priority: P1
type: frontend
depends_on: [FE-044, FE-045, FE-046, FE-047, FE-048, AUTH-003, QUAL-006, QUAL-007, OPS-006]
human_gate: true
created: 2026-10-16
updated: 2026-10-16
---
# Make the SvelteKit app the authoritative frontend and retire index2.html

## Objective

T12. Human-gated: the user approves the parity evidence before removal.
Precedent: MIG-002 (C# retirement). Skill: `tcc-fullstack`.

## Scope

- Evidence: every QUAL-006 row passes on the new app.
- Then: `GET /` and static serving point to the new app (or only `web`
  serves it); remove `sparql/` page/scripts, `login.html`, legacy browser
  suite, `processResources` includes and `StaticFrontendRoutesTest` cases.
- Update `AGENTS.md`, Operational Map, Current Contracts, Frontend
  Architecture; mark open legacy-only cards superseded.

## Acceptance criteria

- [ ] User approves the parity report.
- [ ] All remaining gates pass; no reference to `index2.html` remains outside history.
