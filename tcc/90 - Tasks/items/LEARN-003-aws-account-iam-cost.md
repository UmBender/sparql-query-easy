---
id: LEARN-003
title: Learn to set up an AWS account safely with IAM, MFA, CLI and cost alarms
status: READY
priority: P1
type: learning
depends_on: [LEARN-001]
human_gate: true
created: 2026-10-07
updated: 2026-10-07
---
# Learn to set up an AWS account safely with IAM, MFA, CLI and cost alarms

Part of the [[../../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap|Deployment Roadmap]];
progress goes in the [[../../07 - Operations/Deployment Learning Path/Deployment Learning Tracker|Deployment Learning Tracker]].
Prepares: OPS-003.

## Why this matters for the deployment

Most real AWS incidents for beginners are a leaked access key or a surprise bill. Doing the account setup carefully first makes every later step safer and cheaper.

## How this task is executed

1. **Claude writes the lesson** `tcc/07 - Operations/Deployment Learning Path/L03 - AWS Account, IAM and Cost Guardrails.md`:
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

- Secure the root user (MFA, no access keys) and stop using it.
- Create a day-to-day admin identity (IAM Identity Center user, or an IAM user) with MFA.
- Use the AWS CLI with named profiles and short-lived credentials.
- Read and write IAM policies (Effect, Action, Resource, Condition) and explain roles and trust policies.
- Set a monthly budget with email alerts and know how to see what is costing money.

## Concepts to study

- Root user vs IAM users vs IAM Identity Center users vs roles.
- Policies: identity-based vs resource-based, managed vs inline, least privilege, explicit deny.
- Roles and trust policies — the basis for the EC2 instance role (LEARN-005) and GitHub OIDC (LEARN-012).
- Regions and Availability Zones; choosing `sa-east-1` (São Paulo, lower latency for Brazilian users, higher prices) vs `us-east-1`.
- Free tier/credits vs paid services; Budgets, Cost Explorer, billing alerts; tags for cost allocation.
- CloudTrail: the audit log of every API call.

## Hands-on lab

1. Create the account; enable MFA on root; confirm there are no root access keys.
2. Enable IAM Identity Center, create your admin user and permission set, enable MFA; log in through the access portal.
3. Install AWS CLI v2 and configure an SSO profile (`aws configure sso`).
4. Create a monthly cost budget (e.g. a small USD amount) with alerts at 50%, 80% and 100% to your email.
5. Write (on paper first) a policy that only allows reading one S3 bucket, then test it with the IAM policy simulator.

## Check it yourself (CLI)

Replace `<…>` placeholders with your values.

```sh
aws --version
```
Look for: AWS CLI v2

```sh
aws sso login --profile easyquery-admin
```
Look for: browser login, then `Successfully logged into Start URL`

```sh
aws sts get-caller-identity --profile easyquery-admin
```
Look for: your account ID and an `assumed-role/AWSReservedSSO_…` ARN — never `:root`

```sh
aws iam get-account-summary --query "SummaryMap.{rootKeys:AccountAccessKeysPresent,rootMFA:AccountMFAEnabled}"
```
Look for: `rootKeys: 0`, `rootMFA: 1`

```sh
aws configure list --profile easyquery-admin
```
Look for: where each setting comes from

```sh
aws budgets describe-budgets --account-id "$(aws sts get-caller-identity --query Account --output text)"
```
Look for: your budget, limit and current spend

```sh
aws cloudtrail lookup-events --max-results 5 --query "Events[].{time:EventTime,name:EventName,user:Username}"
```
Look for: your own recent API calls

```sh
aws ec2 describe-regions --query "Regions[].RegionName" --output text
```
Look for: region names; pick one and set it in your profile

## Exercises — break it, then fix it

- Explain why an access key in a public GitHub repo is found by bots within minutes, and what you would do in the first 10 minutes if it happened (deactivate key, check CloudTrail, check billing).
- Read the trust policy of an AWS-managed role and explain who is allowed to assume it.
- Find yesterday's cost per service in the Billing console (Cost Explorer has a small per-request API cost; the console view is enough).

## Done when

- Root has MFA and no keys; daily work uses an MFA-protected non-root identity.
- The CLI works with a named profile and short-lived credentials.
- A budget alert exists before any paid resource is created.

## Reading list

- AWS IAM User Guide — Security best practices in IAM: https://docs.aws.amazon.com/IAM/latest/UserGuide/
- AWS IAM Identity Center User Guide
- AWS CLI v2 User Guide — Configuring IAM Identity Center authentication
- AWS Cost Management User Guide — Managing your costs with AWS Budgets
- AWS Free Tier and pricing pages (check current terms before creating resources)

## Execution log

- 2026-10-07: Created from the user's request for a hands-on deployment learning
  path (DOC-003).
