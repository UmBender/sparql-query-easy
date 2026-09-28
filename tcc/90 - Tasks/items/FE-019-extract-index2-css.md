---
id: FE-019
title: Move index2 inline CSS to its own stylesheet
status: DONE
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

- [x] `index2.html` has no inline `<style>` block.
- [x] Browser suite passes unchanged; Ktor serves `/index2.css` as `text/css`.

## Execution log

- 2026-09-28: Moved the 486-line style block verbatim (dedented) to
  `sparql/index2.css`, linked after `introjs.css` where the block was.
  Packaged it in `build.gradle.kts`; `StaticFrontendRoutesTest` asserts the
  link, `text/css` and a menu rule. `index2.html`: 3,001 → 2,514 lines.
  Validation: `npm run test:browser` 53/53 twice (after QUAL-004);
  `./gradlew ktlintCheck detekt test installDist` passed; built distribution
  served `/index2.css` as `text/css; charset=UTF-8` and the page links it.
