---
id: LEARN-012
title: Learn CI/CD with GitHub Actions deploying to AWS without stored keys
status: READY
priority: P1
type: learning
depends_on: [LEARN-006, LEARN-009, LEARN-011]
human_gate: true
created: 2026-10-07
updated: 2026-10-07
---
# Learn CI/CD with GitHub Actions deploying to AWS without stored keys

Part of the [[../../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap|Deployment Roadmap]];
progress goes in the [[../../07 - Operations/Deployment Learning Path/Deployment Learning Tracker|Deployment Learning Tracker]].
Prepares: OPS-005.

## Why this matters for the deployment

Continuous deployment means every merged change is tested, packaged and released the same way, and a bad release is easy to roll back. Doing it with OIDC avoids the biggest risk: long-lived AWS keys stored in GitHub.

## How this task is executed

1. **Claude writes the lesson** `tcc/07 - Operations/Deployment Learning Path/L12 - CI/CD with GitHub Actions and AWS OIDC.md`:
   a blog-post-style module that explains every concept below from first
   principles with diagrams, walks through the lab step by step with the
   expected output of each command, lists common errors and how to read
   them, and ends with a short quiz. It cites official documentation, and
   for commands it cannot run in the repository it marks the output as
   expected rather than observed.
2. **You do the lab by hand** in your own terminal/AWS account, run every
   self-check, and record results and questions in the tracker.
3. **Review together:** open questions go back into the lesson. The task
   is DONE when you tick every "Done when" item in the tracker (human gate).

No AWS resource is created, and nothing is pushed or deployed, by Claude
without your explicit request in the session.

## Learning objectives — after this you can

- Read and write workflow YAML: triggers, jobs, steps, `needs`, `permissions`, caches, artifacts.
- Run the existing quality gates in CI (Kotlin and browser suites).
- Configure GitHub OIDC → an IAM role whose trust policy only accepts this repository and branch/environment.
- Build, tag by commit SHA and push to ECR; deploy to EC2 with SSM Run Command; smoke-test; roll back.
- Protect production with a GitHub Environment and required reviewer, and protect `main` with required checks.

## Concepts to study

- Workflow anatomy; GitHub-hosted runners; marketplace actions and pinning them to a commit SHA.
- OIDC: identity provider `token.actions.githubusercontent.com`, audience `sts.amazonaws.com`, the `sub` claim and trust-policy conditions.
- `permissions: id-token: write, contents: read` and why least privilege matters for workflows.
- Build caching for Gradle and Docker layers.
- Deployment strategies for a single server: pull new image → stop old → start new → health check → keep previous tag for rollback.
- GitHub Environments, protection rules, environment secrets/variables; branch protection.
- Observability of pipelines: logs, re-runs, `gh` CLI.

## Hands-on lab

1. Workflow 1 `ci.yml` on pull requests: Java 21 setup, `./gradlew ktlintCheck detekt test`, Node + Playwright browser suite.
2. In AWS: add the GitHub OIDC identity provider; create role `easyquery-github-deploy` trusted only for `repo:<owner>/sparql-query-easy:environment:production`, allowed to push to the ECR repo and send SSM commands to instances tagged `Project=easyquery`.
3. Workflow 2 `deploy.yml` on push to `main` (environment `production`): assume the role, build and push `:<sha>`, `aws ssm send-command` a script that pulls, restarts and checks `/health`, then `curl` the public URL.
4. Add a `workflow_dispatch` input to redeploy a previous SHA (rollback) and practise it.
5. Require the CI check before merging to `main`.

## Check it yourself (CLI)

Replace `<…>` placeholders with your values.

```sh
gh workflow list ; gh run list --limit 5
```
Look for: your workflows and their latest runs

```sh
gh run watch
```
Look for: follow the current run live

```sh
gh run view <run-id> --log-failed
```
Look for: only the failing step's log

```sh
gh api repos/<owner>/sparql-query-easy/environments --jq ".environments[].name"
```
Look for: `production`

```sh
aws iam get-role --role-name easyquery-github-deploy --query "Role.AssumeRolePolicyDocument"
```
Look for: the trust policy with your exact `sub` condition

```sh
aws iam list-open-id-connect-providers
```
Look for: the `token.actions.githubusercontent.com` provider

```sh
aws cloudtrail lookup-events --lookup-attributes AttributeKey=EventName,AttributeValue=AssumeRoleWithWebIdentity --max-results 3
```
Look for: GitHub assuming your role at deploy time

```sh
aws ssm list-command-invocations --details --max-results 3 --query "CommandInvocations[].{id:CommandId,status:Status,instance:InstanceId}"
```
Look for: deploy commands and their status

```sh
curl -fsS https://app.<domain>/health && docker inspect app --format '{{.Config.Image}}'
```
Look for: health OK and the running image tag equals the deployed SHA (second command on the server)

## Exercises — break it, then fix it

- Change the trust policy `sub` to another branch and watch the deploy fail with `Not authorized to perform sts:AssumeRoleWithWebIdentity`; restore it.
- Merge a commit that breaks `/health` in a test branch deployment and practise the rollback.
- Explain what an attacker could do with a workflow that has `permissions: write-all` and runs on pull requests from forks.

## Done when

- Every merge to `main` deploys automatically after approval, with no AWS keys stored in GitHub.
- You have rolled back at least once and know how long it takes.

## Reading list

- GitHub Docs — GitHub Actions: Understanding GitHub Actions, Workflow syntax, Using environments for deployment, Security hardening (OpenID Connect, Configuring OpenID Connect in Amazon Web Services): https://docs.github.com/en/actions
- aws-actions/configure-aws-credentials and aws-actions/amazon-ecr-login README files
- AWS Systems Manager — Run Command
- [[../../07 - Operations/Archived .NET Deployment Workflow]] (what not to copy)

## Execution log

- 2026-10-07: Created from the user's request for a hands-on deployment learning
  path (DOC-003).
