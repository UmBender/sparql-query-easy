---
id: LEARN-009
title: Learn configuration and secret management for the app on AWS
status: READY
priority: P1
type: learning
depends_on: [LEARN-005, LEARN-007]
human_gate: true
created: 2026-10-07
updated: 2026-10-07
---
# Learn configuration and secret management for the app on AWS

Part of the [[../../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap|Deployment Roadmap]];
progress goes in the [[../../07 - Operations/Deployment Learning Path/Deployment Learning Tracker|Deployment Learning Tracker]].
Prepares: AUTH-001, OPS-005, SEC-001.

## Why this matters for the deployment

The database password and session signing key must reach the app without ever being in Git, in the image or in CI logs. This module is about where configuration lives and who can read it.

## How this task is executed

1. **Claude writes the lesson** `tcc/07 - Operations/Deployment Learning Path/L09 - Configuration and Secrets.md`:
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

- Separate code, non-secret configuration and secrets (twelve-factor config).
- Make Ktor read values from environment variables with defaults for local development.
- Store secrets in SSM Parameter Store as `SecureString` and give the EC2 role read access to only its own path.
- Inject them into the container at start without leaking them, and rotate one.

## Concepts to study

- HOCON substitution in `application.conf` (`${?ENV_VAR}` optional overrides).
- Parameter hierarchies (`/easyquery/prod/...`), `SecureString` and KMS, IAM resource ARNs for parameters.
- Env files with strict permissions vs Docker secrets; what `docker inspect` reveals.
- Secret scanning (e.g. gitleaks) and GitHub push protection.
- Rotation: change in RDS → update parameter → restart app.

## Hands-on lab

1. Add (in a lab branch) an optional env override for one setting and run the app with and without it.
2. Create `/easyquery/prod/db/url`, `/easyquery/prod/db/user` (String) and `/easyquery/prod/db/password`, `/easyquery/prod/session/key` (SecureString).
3. Attach a policy to the EC2 role allowing `ssm:GetParametersByPath` on `/easyquery/prod/*` only.
4. On EC2, write a small script that reads the parameters into a root-only env file (`chmod 600`) and starts the container with `--env-file`.
5. Rotate the DB password and restart; confirm the old one no longer works.

## Check it yourself (CLI)

Replace `<…>` placeholders with your values.

```sh
read -rs PW && aws ssm put-parameter --name /easyquery/prod/db/password --type SecureString --value "$PW" --overwrite
```
Look for: a new version number — and the password not in your shell history

```sh
aws ssm get-parameters-by-path --path /easyquery/prod --recursive --query "Parameters[].{name:Name,type:Type,version:Version}" --output table
```
Look for: names and types, no values

```sh
aws ssm get-parameter --name /easyquery/prod/db/password --with-decryption --query Parameter.Value --output text
```
Look for: the value (only for an identity that is allowed to decrypt)

```sh
aws iam simulate-principal-policy --policy-source-arn <ec2-role-arn> --action-names ssm:GetParameter --resource-arns arn:aws:ssm:<region>:<account>:parameter/other/secret
```
Look for: `implicitDeny` — the role cannot read other paths

```sh
stat -c "%a %U" /etc/easyquery/app.env
```
Look for: `600 root` on the server

```sh
gitleaks detect --source . --no-banner
```
Look for: no leaks found in the repository history

## Exercises — break it, then fix it

- Find out what `docker inspect <container>` shows about env vars and decide whether that is acceptable on a single-user server.
- Explain how GitHub Actions masks secrets and how a careless `echo` or `set -x` can still leak one.

## Done when

- No secret exists in Git, the image or CI logs; the app gets secrets at start time only.
- You can rotate a secret and prove the old one stopped working.

## Reading list

- The Twelve-Factor App — III. Config: https://12factor.net/config
- AWS Systems Manager User Guide — Parameter Store
- Ktor documentation — Configuration in a file (HOCON, environment variables)
- GitHub Docs — Using secrets in GitHub Actions; Secret scanning

## Execution log

- 2026-10-07: Created from the user's request for a hands-on deployment learning
  path (DOC-003).
