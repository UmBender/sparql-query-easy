---
id: FE-019
title: Move index2 inline CSS to its own stylesheet
status: BACKLOG
priority: P2
type: refactor
depends_on: [FE-018]
human_gate: false
created: 2026-09-28
updated: 2026-09-28
---
# Move index2 inline CSS to its own stylesheet

## Objective

Move the `<style>` block (`index2.html` lines 12–499) to `sparql/index2.css`,
loaded after `grafos.css`, so style work no longer needs the page. Skill:
`tcc-refactor`.

## Scope

Keep rule order and cascade position. Add the file to `processResources` in
`build.gradle.kts` and to `StaticFrontendRoutesTest`. No rule changes.

## Acceptance criteria

- [ ] `index2.html` has no inline `<style>` block.
- [ ] Browser suite passes unchanged; Ktor serves `/index2.css` as `text/css`.
