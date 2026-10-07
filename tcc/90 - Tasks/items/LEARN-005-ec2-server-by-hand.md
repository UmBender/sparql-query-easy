---
id: LEARN-005
title: Learn to run the app on an EC2 server by hand
status: READY
priority: P1
type: learning
depends_on: [LEARN-002, LEARN-004]
human_gate: true
created: 2026-10-07
updated: 2026-10-07
---
# Learn to run the app on an EC2 server by hand

Part of the [[../../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap|Deployment Roadmap]];
progress goes in the [[../../07 - Operations/Deployment Learning Path/Deployment Learning Tracker|Deployment Learning Tracker]].
Prepares: OPS-003.

## Why this matters for the deployment

This is the first time the app runs on the internet. Doing it by hand (instead of a managed service) teaches what every managed service hides: the OS, Docker, the instance role, logs and restarts.

## How this task is executed

1. **Claude writes the lesson** `tcc/07 - Operations/Deployment Learning Path/L05 - EC2 Server by Hand.md`:
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

- Choose an instance type and AMI and explain the cost and CPU-architecture trade-off (t3 x86 vs t4g Graviton).
- Launch with an IAM instance profile (SSM + ECR read + CloudWatch Logs) and IMDSv2 required.
- Connect with Session Manager (no SSH port open), install Docker and run the app container.
- Make it survive reboots and know where every log is.

## Concepts to study

- AMIs (Amazon Linux 2023), instance types, EBS volumes, stop vs terminate.
- Instance profiles/roles and the instance metadata service (IMDSv2, hop limit).
- User data / cloud-init for first-boot setup.
- Systems Manager Session Manager and Run Command (used again by CI in LEARN-012).
- JVM sizing on a small instance (`JAVA_OPTS`), swap, disk space for images.
- Elastic IP so DNS (LEARN-010) can point to a stable address.

## Hands-on lab

1. Create role `easyquery-ec2` with `AmazonSSMManagedInstanceCore`, ECR read-only and CloudWatch Logs write.
2. Launch a small instance in a public subnet with `easyquery-web` SG, the role, IMDSv2 required, and user data that installs and enables Docker.
3. Connect with `aws ssm start-session`; run the image (from ECR after LEARN-006, or a locally built tag for the first try) with `--restart unless-stopped`, publishing 8080 only on 127.0.0.1 for now.
4. Allocate and associate an Elastic IP; reboot and confirm the app comes back.

## Check it yourself (CLI)

Replace `<…>` placeholders with your values.

```sh
aws ec2 describe-instances --filters Name=tag:Project,Values=easyquery --query "Reservations[].Instances[].{id:InstanceId,state:State.Name,type:InstanceType,ip:PublicIpAddress,arch:Architecture,imds:MetadataOptions.HttpTokens}" --output table
```
Look for: `running`, your type, the Elastic IP and `imds: required`

```sh
aws ssm describe-instance-information --query "InstanceInformationList[].{id:InstanceId,ping:PingStatus,os:PlatformName}"
```
Look for: `Online` — otherwise the role or outbound internet is wrong

```sh
aws ssm start-session --target <instance-id>
```
Look for: a shell on the server (needs the Session Manager plugin locally)

```sh
cloud-init status --long ; sudo tail -n 50 /var/log/cloud-init-output.log
```
Look for: whether your user data ran and its output (on the server)

```sh
systemctl is-enabled docker ; systemctl status docker --no-pager
```
Look for: `enabled`, `active (running)`

```sh
docker ps ; curl -fsS http://127.0.0.1:8080/health
```
Look for: the container healthy and `{"status":"ok"}`

```sh
TOKEN=$(curl -sX PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60'); curl -sH "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/iam/security-credentials/
```
Look for: the role name — this is how the instance gets AWS credentials without keys

```sh
sudo reboot   # then reconnect and run docker ps
```
Look for: the app back up without you starting it

```sh
df -h / ; free -h
```
Look for: room for images and the JVM

## Exercises — break it, then fix it

- Run the app container and try the IMDS command from inside it; with hop limit 1 it should fail — explain why that protects you (this matters for SEC-001, because the app fetches user-supplied SPARQL endpoint URLs).
- Stop (not terminate) the instance and check what still costs money (EBS, Elastic IP).
- Break the user data on purpose and find the error in cloud-init logs.

## Done when

- The app runs on EC2, restarts on reboot, and you never opened port 22.
- You can explain every permission in the instance role.

## Reading list

- Amazon EC2 User Guide — Instance types, Amazon Linux 2023, IMDSv2: https://docs.aws.amazon.com/ec2/
- AWS Systems Manager User Guide — Session Manager, Run Command
- Amazon Linux 2023 User Guide — Installing Docker

## Execution log

- 2026-10-07: Created from the user's request for a hands-on deployment learning
  path (DOC-003).
