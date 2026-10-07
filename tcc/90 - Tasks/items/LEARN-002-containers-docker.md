---
id: LEARN-002
title: Learn containers by running and inspecting the app image
status: READY
priority: P1
type: learning
depends_on: [LEARN-001]
human_gate: true
created: 2026-10-07
updated: 2026-10-07
---
# Learn containers by running and inspecting the app image

Part of the [[../../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap|Deployment Roadmap]];
progress goes in the [[../../07 - Operations/Deployment Learning Path/Deployment Learning Tracker|Deployment Learning Tracker]].
Prepares: OPS-003, OPS-005.

## Why this matters for the deployment

The server will run the app (and later Caddy) as containers, and CI will build the image. Knowing what is inside the image, how ports/users/env/health work and how to read container logs is what lets you debug a deploy.

## How this task is executed

1. **Claude writes the lesson** `tcc/07 - Operations/Deployment Learning Path/L02 - Containers with Docker.md`:
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

- Explain image vs container vs registry, layers and tags vs digests.
- Build the existing multi-stage `Dockerfile` and explain each instruction.
- Run, stop, inspect, log, exec into and resource-limit a container.
- Run the app, PostgreSQL and a reverse proxy together locally with Docker Compose.

## Concepts to study

- Multi-stage builds (build JDK stage → small JRE runtime stage) and why the C# tree, tests and vault are excluded by `.dockerignore`.
- Non-root user `10001`, `EXPOSE`, `HEALTHCHECK`, `ENTRYPOINT`.
- Port publishing (`-p host:container`), bridge networks and container DNS names.
- Environment variables, `--env-file`, why secrets in images are a leak.
- Volumes vs bind mounts; why this app keeps no durable data in the container.
- Restart policies, memory limits and the JVM (`JAVA_OPTS=-Xmx...`).
- CPU architectures (amd64 vs arm64) — matters if you pick a Graviton (`t4g`) instance.
- Mutable base tags vs pinned digests; image scanning.

## Hands-on lab

1. `docker build -t sparql-query-easy:local .` and time it; rebuild after changing only a frontend file and explain which layers were reused.
2. Run it detached on 127.0.0.1:8080, watch the health status go from `starting` to `healthy`.
3. Exec into the container, confirm the user and the files under `/opt/sparql-query-easy`.
4. Run with `--memory 256m` and a too-large `-Xmx`; observe what happens and fix it.
5. Write a local `compose.yaml` (lab only, in your scratch folder) with `app`, `postgres` and `caddy` services on one network; only Caddy publishes ports.

## Check it yourself (CLI)

Replace `<…>` placeholders with your values.

```sh
docker image ls sparql-query-easy
```
Look for: tag, image ID and size

```sh
docker image history sparql-query-easy:local
```
Look for: one line per layer and its size — find the biggest layer

```sh
docker image inspect sparql-query-easy:local --format '{{.Config.User}} {{json .Config.ExposedPorts}} {{.Architecture}}'
```
Look for: `10001:10001 {"8080/tcp":{}} amd64` (or arm64)

```sh
docker run -d --name app -p 127.0.0.1:8080:8080 --restart unless-stopped sparql-query-easy:local
```
Look for: a container ID

```sh
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```
Look for: `Up … (healthy)` and `127.0.0.1:8080->8080/tcp`

```sh
docker inspect app --format '{{.State.Health.Status}} {{.RestartCount}}'
```
Look for: health and restarts

```sh
docker logs --since 5m -f app
```
Look for: Ktor startup lines (`Responding at http://0.0.0.0:8080`)

```sh
docker exec -it app id ; docker exec -it app ls /opt/sparql-query-easy/lib | head
```
Look for: uid 10001 and the bundled JARs

```sh
docker stats --no-stream app
```
Look for: CPU and memory use of the JVM

```sh
docker system df
```
Look for: how much disk images/containers/build cache use — servers fill up with old images

## Exercises — break it, then fix it

- Publish with `-p 8080:8080` instead of `127.0.0.1:8080:8080` and explain who can reach it now (and why on a server you will not publish the app port at all).
- Break the health check (e.g. run with a wrong entrypoint) and read the reason in `docker inspect`.
- Find the image digest (`docker image ls --digests` after a push in LEARN-006) and explain why deploying by digest is safer than by tag.

## Done when

- You can build, run, inspect and debug the app container without notes.
- Your local Compose lab starts app + PostgreSQL + Caddy and `curl` reaches the app through Caddy.
- You can explain why secrets never go into the image.

## Reading list

- Docker docs — Get started, Dockerfile reference, Docker Compose: https://docs.docker.com/
- Docker docs — Multi-stage builds and Build cache
- Eclipse Temurin images on Docker Hub (tags, architectures)
- [[../../07 - Operations/Local JVM and Container Runtime]] (this project)

## Execution log

- 2026-10-07: Created from the user's request for a hands-on deployment learning
  path (DOC-003).
