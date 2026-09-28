---
id: QUAL-003
title: Make browser tests fail on unexpected external traffic
status: DONE
priority: P1
type: quality
depends_on: [DEV-001]
human_gate: false
created: 2026-09-28
updated: 2026-09-28
---
# Make browser tests fail on unexpected external traffic

## Objective and main skill

Remove the browser suite's CSS/font network dependency and establish an explicit egress guard before structural frontend work.
Use `tcc-test`.

## Evidence and scope

Confirmed entry points: `frontend-tests/index2.spec.mjs; frontend-tests/cdn-stubs.mjs; frontend-tests/server.mjs; sparql/index2.html`.

Provide local fixtures or explicit deterministic responses for required CSS/fonts. Reject and report every unexpected non-loopback request, including worker traffic if applicable. Preserve existing layout-dependent interactions; do not merely abort styles and loosen assertions. Test configuration only; production asset vendoring is separate.

See [[../../04 - Frontend/Frontend Evolution Audit]] for reasoning and
[[../../09 - Decisions/Current Contracts]] for preserved behavior.

## Acceptance criteria

- [x] All existing browser tests pass with external requests explicitly blocked and unexpected requests treated as failures.
- [x] A deliberately unhandled external URL fails the guard; expected local and explicit fixture requests succeed.
- [x] FE-003/FE-004 offline-review evidence is updated without changing their product assertions.

## Validation

```sh
npm run test:browser
```

Apply the final area gate from [[../../06 - Development/Operational Map]].
A new pure-test command is proposed only in FE-011; confirm it exists before
reporting it as run.

## Dependencies and documentation

Depends on DEV-001. Update this card, TASKS.md and the affected audit,
quality or frontend note only. No automatic implementation of later cards.

## Risks

Avoid masking layout regressions with empty styles. Local fixtures must preserve the interactions under test.

## Execution log

- 2026-09-28: Created by DEV-001 frontend audit; not started.
- 2026-09-28: Added a deny-by-default page request route and explicit external
  JavaScript/CSS/logo/icon fixtures. Materialize 1.0.0 CSS comes from a pinned
  dev dependency; Intro.js test styling is local because its JS stub renders
  no tooltip. Service workers are blocked in
  Playwright. A deliberate unhandled external fetch is rejected by the guard.
  Initial empty CSS fixtures exposed menu layout failures and were replaced
  with the real local styles. Stabilized node pointer tests by checking real
  Cytoscape tap targets without weakening product assertions. Full browser
  gate passed: 23/23. Changed `frontend-tests/index2.spec.mjs`,
  `playwright.config.mjs`, `package.json`, `package-lock.json`, this card,
  FE-003/FE-004 notes and the task index.
