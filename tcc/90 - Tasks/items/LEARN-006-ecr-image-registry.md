---
id: LEARN-006
title: Learn to publish and pull the app image with Amazon ECR
status: READY
priority: P1
type: learning
depends_on: [LEARN-002, LEARN-003]
human_gate: true
created: 2026-10-07
updated: 2026-10-07
---
# Learn to publish and pull the app image with Amazon ECR

Part of the [[../../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap|Deployment Roadmap]];
progress goes in the [[../../07 - Operations/Deployment Learning Path/Deployment Learning Tracker|Deployment Learning Tracker]].
Prepares: OPS-005.

## Why this matters for the deployment

CI will push an image for every commit and the server will pull it. Understanding tags, digests, authentication and cleanup avoids "it deployed the wrong version" and a registry full of old images.

## How this task is executed

1. **Claude writes the lesson** `tcc/07 - Operations/Deployment Learning Path/L06 - Image Registry with ECR.md`:
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

- Create a private ECR repository with immutable tags and scan on push.
- Authenticate Docker to ECR, push from your machine and pull on EC2 using the instance role.
- Tag images by commit SHA and deploy by digest when it matters.
- Keep the registry small with a lifecycle policy.

## Concepts to study

- Registry, repository, tag, digest, manifest; multi-arch images.
- ECR authentication tokens (12 h) and why the instance role is enough on EC2.
- Immutable tags; `latest` as an anti-pattern for deploys.
- Basic image scanning and what a CVE finding means for a JRE base image.
- Lifecycle policies.

## Hands-on lab

1. Create repository `sparql-query-easy` (immutable tags, scan on push).
2. Tag the local image as `<account>.dkr.ecr.<region>.amazonaws.com/sparql-query-easy:<git-short-sha>` and push it.
3. On EC2, log in with the instance role, pull by tag and by digest, and run it.
4. Add a lifecycle policy that keeps the last 10 images.

## Check it yourself (CLI)

Replace `<…>` placeholders with your values.

```sh
aws ecr create-repository --repository-name sparql-query-easy --image-tag-mutability IMMUTABLE --image-scanning-configuration scanOnPush=true
```
Look for: the repository URI

```sh
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
```
Look for: `Login Succeeded`

```sh
git rev-parse --short HEAD
```
Look for: the tag to use

```sh
aws ecr describe-images --repository-name sparql-query-easy --query "sort_by(imageDetails,&imagePushedAt)[].{tags:imageTags,digest:imageDigest,pushed:imagePushedAt,mb:imageSizeInBytes}" --output table
```
Look for: every pushed image, newest last

```sh
aws ecr describe-image-scan-findings --repository-name sparql-query-easy --image-id imageTag=<tag> --query "imageScanFindings.findingSeverityCounts"
```
Look for: counts by severity

```sh
docker pull <repo-uri>@sha256:<digest>
```
Look for: pull by digest works

```sh
aws ecr get-lifecycle-policy --repository-name sparql-query-easy
```
Look for: your policy

## Exercises — break it, then fix it

- Push the same tag twice and read the immutability error.
- Pick one HIGH finding and find out whether it affects the JRE image and whether a newer base tag fixes it.
- Compare image sizes of the JDK build stage and the final JRE stage.

## Done when

- You can push and pull images, and you deploy a specific commit by tag or digest.
- A lifecycle policy keeps the repository small.

## Reading list

- Amazon ECR User Guide — Private registry authentication, Pushing an image, Lifecycle policies, Image scanning: https://docs.aws.amazon.com/AmazonECR/latest/userguide/
- OCI image spec — what a manifest and digest are (overview level)

## Execution log

- 2026-10-07: Created from the user's request for a hands-on deployment learning
  path (DOC-003).
