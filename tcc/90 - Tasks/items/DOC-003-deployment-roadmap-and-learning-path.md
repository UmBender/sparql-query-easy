---
id: DOC-003
title: Document every deployment step and a hands-on learning path to do it by hand
status: DONE
priority: P1
type: documentation
depends_on: [OPS-001]
human_gate: false
created: 2026-10-07
updated: 2026-10-07
---
# Document every deployment step and a hands-on learning path to do it by hand

## Objective

The user wants to deploy the app on AWS for user testing (continuous
deployment from GitHub, own domain/DNS, PostgreSQL for login passwords) and to
learn DevOps by doing most of it by hand. Deliverables, in the order asked:

1. a document with all deployment steps;
2. one detailed teaching task per part (`LEARN-001`–`LEARN-014`), each with
   objectives, concepts, a lab, CLI self-checks, break-and-fix exercises,
   "done when" criteria and a reading list;
3. a structured tracker for the user to mark learning and deployment progress.

## Scope

Documentation and task planning only. No AWS resource, domain, workflow,
database or authentication code is created; `OPS-002`–`OPS-005`, `AUTH-000`
and `SEC-001` keep their status and decisions.

## Acceptance criteria

- [x] [[../../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap]]
      lists every step from the current local app to real testers, the
      target architecture with trade-offs, costs to check, and the decisions
      that remain with the user and the card that records each.
- [x] One `LEARN-*` card per roadmap step, executed as "Claude writes the
      lesson, the user does the lab, human gate closes it".
- [x] [[../../07 - Operations/Deployment Learning Path/Deployment Learning Tracker]]
      with per-module checklists generated from the cards, deployment
      milestones, a decision log and a cost log.
- [x] Docs check passes.

## Execution log

- 2026-10-07: Created and completed from the user's request. Evidence used:
  `Dockerfile`, `application.conf`, [[../../07 - Operations/Local JVM and Container Runtime]],
  [[../../07 - Operations/Operations Inventory]], OPS/AUTH/SEC cards.
  Recommended first architecture: one EC2 instance with Docker (Caddy TLS
  proxy + app), RDS PostgreSQL in private subnets, ECR, Route 53, SSM
  Parameter Store, CloudWatch, GitHub Actions with OIDC and SSM Run Command.
  This is a recommendation for OPS-003, not an approval. Prices and free-tier
  terms are deliberately not quoted; each lesson must point to the current
  pricing pages. Validation: `node scripts/check-project-docs.mjs`,
  `git diff --check`. Completion commit for this task.
