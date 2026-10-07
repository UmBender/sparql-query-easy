---
id: LEARN-004
title: Learn AWS networking: VPC, subnets, routes and security groups
status: READY
priority: P1
type: learning
depends_on: [LEARN-003]
human_gate: true
created: 2026-10-07
updated: 2026-10-07
---
# Learn AWS networking: VPC, subnets, routes and security groups

Part of the [[../../07 - Operations/Deployment Learning Path/00 - Deployment Roadmap|Deployment Roadmap]];
progress goes in the [[../../07 - Operations/Deployment Learning Path/Deployment Learning Tracker|Deployment Learning Tracker]].
Prepares: OPS-002, OPS-003.

## Why this matters for the deployment

Your server needs to be reachable on 80/443, your database must not be reachable from the internet, and you must understand why a connection times out. All of that is VPC routing and security groups.

## How this task is executed

1. **Claude writes the lesson** `tcc/07 - Operations/Deployment Learning Path/L04 - AWS Networking (VPC and Security Groups).md`:
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

- Draw the VPC: CIDR, public/private subnets in two AZs, route tables, internet gateway.
- Explain why the database goes in private subnets and the app in a public subnet for this first version (and what a NAT gateway is and why we avoid its cost here).
- Write security group rules that reference other security groups (app SG → DB SG on 5432).
- Debug reachability with `nc`, `curl` and the VPC Reachability Analyzer.

## Concepts to study

- CIDR blocks and subnet sizing (`10.0.0.0/16`, `/24` subnets).
- Internet gateway, route tables, public vs private subnet (a route to the IGW is what makes it public).
- Security groups (stateful, allow-only) vs network ACLs (stateless).
- Public IPv4 addresses and Elastic IPs (paid per hour), IPv6 as an option.
- NAT gateway (paid per hour + data) vs VPC endpoints vs public subnet with tight security groups.
- DB subnet groups for RDS (needs subnets in 2 AZs).

## Hands-on lab

1. Inspect the default VPC first; then create a dedicated VPC for the project with 2 public and 2 private subnets (VPC wizard "VPC and more", no NAT gateway).
2. Create three security groups: `easyquery-web` (80/443 from anywhere), `easyquery-app` (no inbound from internet), `easyquery-db` (5432 only from `easyquery-web` SG).
3. Tag everything with `Project=easyquery`.

## Check it yourself (CLI)

Replace `<…>` placeholders with your values.

```sh
aws ec2 describe-vpcs --query "Vpcs[].{id:VpcId,cidr:CidrBlock,default:IsDefault,name:Tags[?Key=='Name']|[0].Value}" --output table
```
Look for: your VPCs and CIDRs

```sh
aws ec2 describe-subnets --filters Name=vpc-id,Values=<vpc-id> --query "Subnets[].{id:SubnetId,az:AvailabilityZone,cidr:CidrBlock,publicIp:MapPublicIpOnLaunch}" --output table
```
Look for: two subnets per AZ, public ones auto-assign IPs

```sh
aws ec2 describe-route-tables --filters Name=vpc-id,Values=<vpc-id> --query "RouteTables[].{id:RouteTableId,routes:Routes[].[DestinationCidrBlock,GatewayId]}"
```
Look for: only the public route table has `0.0.0.0/0 → igw-…`

```sh
aws ec2 describe-security-groups --filters Name=tag:Project,Values=easyquery --query "SecurityGroups[].{name:GroupName,in:IpPermissions[].{port:FromPort,cidr:IpRanges[].CidrIp,sg:UserIdGroupPairs[].GroupId}}"
```
Look for: the rules you intended — and nothing open to `0.0.0.0/0` except 80/443

```sh
nc -vz <public-ip> 443 ; nc -vz -w 5 <public-ip> 5432
```
Look for: 443 succeeds (later), 5432 times out from your laptop

```sh
ipcalc 10.0.1.0/24
```
Look for: network, broadcast and number of hosts (AWS reserves 5 per subnet)

## Exercises — break it, then fix it

- Remove the 443 rule and observe a timeout (not "refused"); explain why.
- Explain what would change if the app needed to call Wikidata from a private subnet (NAT gateway or proxy).
- Use VPC Reachability Analyzer between the EC2 instance and the RDS instance once both exist.

## Done when

- You can draw the network from memory and explain each route and rule.
- No security group allows SSH (22) or PostgreSQL (5432) from the internet.

## Reading list

- Amazon VPC User Guide — How Amazon VPC works, Subnets, Route tables, Security groups: https://docs.aws.amazon.com/vpc/latest/userguide/
- Amazon EC2 — Public IPv4 address pricing note on the VPC pricing page
- Amazon RDS — Working with a DB instance in a VPC

## Execution log

- 2026-10-07: Created from the user's request for a hands-on deployment learning
  path (DOC-003).
