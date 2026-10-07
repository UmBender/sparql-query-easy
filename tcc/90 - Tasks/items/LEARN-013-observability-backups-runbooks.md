---
id: LEARN-013
title: Learn monitoring, logs, backups and incident runbooks for the running app
status: READY
priority: P1
type: learning
depends_on: [LEARN-007, LEARN-012]
human_gate: true
created: 2026-10-07
updated: 2026-10-07
---
# Learn monitoring, logs, backups and incident runbooks for the running app

Part of the [[../../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap|Deployment Roadmap]];
progress goes in the [[../../07 - Operations/Deployment Learning Path/Deployment Learning Tracker|Deployment Learning Tracker]].
Prepares: OPS-004.

## Why this matters for the deployment

During user testing you need to know the app is down before testers tell you, find the error in the logs quickly, and be sure you can restore the login database.

## How this task is executed

1. **Claude writes the lesson** `tcc/07 - Operations/Deployment Learning Path/L13 - Observability, Backups and Runbooks.md`:
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

- Ship container logs to CloudWatch Logs with a retention period and search them.
- Create alarms (public health check, instance status, disk/memory, monthly cost) that email you.
- Define RPO/RTO for the database and prove them with a restore drill.
- Write short runbooks for the most likely incidents.

## Concepts to study

- Logs vs metrics vs traces; structured logs.
- Docker `awslogs` log driver; log groups/streams; retention; Logs Insights queries.
- CloudWatch alarms and SNS email notifications; Route 53 health checks; EC2 status checks and auto-recovery.
- CloudWatch agent for memory and disk (not collected by default).
- RDS automated backups, manual snapshots, point-in-time restore; optional logical dumps.
- Incident basics: detect, mitigate (rollback), communicate, write down what happened.

## Hands-on lab

1. Run the app container with `--log-driver awslogs` to log group `/easyquery/app` (14-day retention).
2. Create an SNS topic with your email; a Route 53 health check on `https://app.<domain>/health` with an alarm; an EC2 status-check alarm; a disk-usage alarm via the CloudWatch agent.
3. Do a full restore drill of RDS into a temporary instance, connect, count users, delete it; write the time it took.
4. Write runbooks: "site down", "deploy broke", "database unreachable", "disk full", "certificate problem".

## Check it yourself (CLI)

Replace `<…>` placeholders with your values.

```sh
aws logs tail /easyquery/app --follow --since 10m
```
Look for: live application logs from your laptop

```sh
aws logs filter-log-events --log-group-name /easyquery/app --filter-pattern "?ERROR ?Exception" --max-items 20
```
Look for: recent errors

```sh
aws logs describe-log-groups --log-group-name-prefix /easyquery --query "logGroups[].{name:logGroupName,days:retentionInDays,bytes:storedBytes}"
```
Look for: retention set, size

```sh
aws cloudwatch describe-alarms --query "MetricAlarms[].{name:AlarmName,state:StateValue}" --output table
```
Look for: all alarms `OK`

```sh
aws cloudwatch set-alarm-state --alarm-name <name> --state-value ALARM --state-reason "drill"
```
Look for: a test email arrives — your alerting works

```sh
aws sns list-subscriptions --query "Subscriptions[].{topic:TopicArn,endpoint:Endpoint,arn:SubscriptionArn}"
```
Look for: your confirmed email subscription (not `PendingConfirmation`)

```sh
aws rds restore-db-instance-to-point-in-time --source-db-instance-identifier <id> --target-db-instance-identifier easyquery-restore-drill --use-latest-restorable-time
```
Look for: a new instance being created — measure until `available`

## Exercises — break it, then fix it

- Stop the app container on purpose and measure how long until you get the email.
- Fill the disk with old images in a test and practise the "disk full" runbook (`docker image prune`).
- Write one short post-incident note for a drill.

## Done when

- You get an email within minutes when the site is down, and you know your measured RTO for the database.
- Runbooks exist and you have practised at least two.

## Reading list

- Amazon CloudWatch Logs User Guide — Log groups, Logs Insights: https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/
- Docker docs — Amazon CloudWatch Logs logging driver
- Amazon Route 53 — Health checks; Amazon CloudWatch — Using alarms
- Amazon RDS — Restoring a DB instance to a specified time
- Google SRE Book (free online) — chapters on monitoring and postmortems: https://sre.google/books/

## Execution log

- 2026-10-07: Created from the user's request for a hands-on deployment learning
  path (DOC-003).
