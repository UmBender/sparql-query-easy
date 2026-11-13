#!/usr/bin/env bash
# Unattended task batches: one non-interactive Claude Code session per task, one at a time.
# Usage: scripts/batch/batch.sh check | run | status | report | reset <ID> | unblock <ID>
# Plan first (interactive): skill batch-tasks, see .agents/skills/batch-tasks/SKILL.md.
set -uo pipefail

ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel) || exit 2
cd "$ROOT" || exit 2
B="$ROOT/.batch"
ITEMS="$ROOT/tcc/90 - Tasks/items"
MODEL=${BATCH_MODEL:-sonnet}
EFFORT=${BATCH_EFFORT:-medium}
ATTEMPT_TIMEOUT=${BATCH_TIMEOUT:-4h}
CLAUDE=${BATCH_CLAUDE:-claude}
PROBE_SECONDS=${BATCH_PROBE_SECONDS:-900}
NET_URL=${BATCH_NET_URL:-https://api.anthropic.com}
MIN_FREE_GB=${BATCH_MIN_FREE_GB:-5}
export GRADLE_USER_HOME=${GRADLE_USER_HOME:-/tmp/sparql-query-easy-gradle}

log() { printf '%s %s\n' "$(date '+%F %T')" "$*" | tee -a "$B/runner.log" >&2; }
state_get() { cat "$B/state/$1" 2>/dev/null || echo pending; }
state_set() { mkdir -p "$B/state"; printf '%s\n' "$2" >"$B/state/.$1.tmp" && mv "$B/state/.$1.tmp" "$B/state/$1"; }
queue_lines() { grep -v -E '^\s*(#|$)' "$B/queue"; }
card_of() { ls "$ITEMS/$1"-*.md "$ITEMS/$1.md" 2>/dev/null | head -1; }
net_ok() { curl -sS -m 10 -o /dev/null "$NET_URL" 2>/dev/null; }
free_gb() { df --output=avail -BG "$ROOT" | tail -1 | tr -dc '0-9'; }
fail_status() { mkdir -p "$B/out"; printf 'blocked\n%s\n' "$2" >"$B/out/$1.status"; }

gate_cmds() { # gate names joined by +: kotlin frontend stack docs none
  local g
  for g in ${1//+/ }; do
    case $g in
      kotlin) echo "./gradlew ktlintCheck detekt test --no-daemon --console=plain" ;;
      frontend) echo "npm --prefix frontend run check"; echo "npm --prefix frontend run lint"; echo "npm --prefix frontend test" ;;
      fullstack) gate_cmds kotlin+frontend ;;
      stack) echo "npm --prefix frontend run test:stack" ;;
      docs) echo "git diff --check $2..HEAD" ;;
      none) ;;
      *) echo "UNKNOWN-GATE-$g" ;;
    esac
  done
}

run_gate() { # id gate base; reruns the closing gate on the task branch (never trust the session's claim)
  local cmd out="$B/logs/$1.gate.log"
  mkdir -p "$B/logs"; : >"$out"
  while IFS= read -r cmd; do
    [ -z "$cmd" ] && continue
    echo "\$ $cmd" >>"$out"
    case $cmd in UNKNOWN-GATE-*) echo "unknown gate" >>"$out"; return 1 ;; esac
    bash -c "$cmd" >>"$out" 2>&1 || { echo "FAILED: $cmd" >>"$out"; return 1; }
  done < <(gate_cmds "$2" "$3")
  return 0
}

cmd_check() {
  local fails=0 warns=0
  ok() { echo "ok    $*"; }
  bad() { echo "FAIL  $*"; fails=$((fails + 1)); }
  warn() { echo "warn  $*"; warns=$((warns + 1)); }
  for c in git flock jq timeout curl; do command -v $c >/dev/null && ok "tool $c" || bad "missing tool $c"; done
  command -v "$CLAUDE" >/dev/null && ok "tool $CLAUDE" || bad "missing $CLAUDE"
  command -v systemd-inhibit >/dev/null && ok "systemd-inhibit" || warn "no systemd-inhibit: the machine may sleep"
  git check-ignore -q .batch/ && ok ".batch/ is git-ignored" || bad ".batch/ is not in .gitignore"
  for f in plan.md queue settings.json; do [ -f "$B/$f" ] && ok ".batch/$f" || bad ".batch/$f missing (run the plan phase)"; done
  [ -f "$B/settings.json" ] && { jq -e '.permissions.allow and .permissions.deny' "$B/settings.json" >/dev/null && ok "settings.json valid" || bad "settings.json invalid or without allow/deny"; }
  if [ -n "$(git status --porcelain)" ]; then bad "working tree not clean ($(git status --porcelain | wc -l) paths); commit or stash first"; else ok "working tree clean"; fi
  local free; free=$(free_gb); [ "${free:-0}" -ge "$MIN_FREE_GB" ] && ok "disk ${free} GB free" || bad "disk ${free:-?} GB free (< $MIN_FREE_GB)"
  net_ok && ok "network ($NET_URL)" || bad "cannot reach $NET_URL"
  if [ -f "$B/queue" ]; then
    local seen=" " id base gate
    while read -r id base gate _; do
      [ -z "$id" ] && continue
      [ -n "$(card_of "$id")" ] && ok "card $id" || bad "no card for $id"
      [ -n "${base:-}" ] && [ -n "${gate:-}" ] || { bad "queue line for $id needs: ID BASE GATE"; continue; }
      case $base in
        main) ;;
        after:*) case $seen in *" ${base#after:} "*) ;; *) bad "$id: base $base is not earlier in the queue" ;; esac ;;
        *) bad "$id: base must be main or after:<ID>" ;;
      esac
      [ -n "$(gate_cmds "$gate" main | grep UNKNOWN)" ] && bad "$id: unknown gate $gate"
      seen="$seen$id "
    done < <(queue_lines)
  fi
  [ -f "$B/requires" ] && while read -r t; do [ -z "$t" ] && continue; command -v "$t" >/dev/null && ok "requires $t" || bad "requires $t (not installed)"; done <"$B/requires"
  echo "$fails failure(s), $warns warning(s)"
  [ "$fails" -eq 0 ]
}

wait_net() { until net_ok; do log "network down; retry in 60 s"; sleep 60; done; }

limit_hit() { # log file -> 0 when the session ended on a usage limit
  grep -q -i -E 'usage limit|rate limit|limit reached|resets? (at|in)' "$1" 2>/dev/null &&
    jq -r 'select(.type=="result") | .is_error' "$1" 2>/dev/null | grep -q true
}

wait_limit() { # sleep to the reset time when the message carries one, otherwise probe every 15 min
  local f=$1 when secs
  when=$(grep -o -i -E 'resets? (at )?[0-9]{1,2}(:[0-9]{2})? ?(am|pm)?' "$f" | tail -1 | sed -E 's/^resets? (at )?//I')
  if [ -n "$when" ] && secs=$(( $(date -d "$when" +%s 2>/dev/null || echo 0) - $(date +%s) )) && [ "$secs" -gt 0 ] && [ "$secs" -lt 86400 ]; then
    log "usage limit; sleeping until $when (${secs}s)"; sleep $((secs + 60)); return
  fi
  while :; do
    log "usage limit; probing in $((PROBE_SECONDS / 60)) min"; sleep "$PROBE_SECONDS"
    net_ok || continue
    if out=$(timeout 300 "$CLAUDE" -p "answer only: ok" --model haiku --max-turns 1 2>&1) && ! grep -q -i -E 'usage limit|rate limit|limit reached' <<<"$out"; then return; fi
  done
}

prepare_branch() { # id base
  local br="batch/$1" base=$2
  [ "$base" = main ] || base="batch/${base#after:}"
  if git rev-parse --verify -q "$br" >/dev/null; then git switch -q "$br"; else git switch -q -c "$br" "$base"; fi
}

run_task() { # id base gate
  local id=$1 base=$2 gate=$3 sess_file="$B/sessions/$1" attempts=0 resume=0 sid prompt logf rc
  mkdir -p "$B/logs" "$B/out" "$B/sessions"
  state_set "$id" running
  prepare_branch "$id" "$base" || { fail_status "$id" "could not create or switch to batch/$id from $base"; state_set "$id" blocked; return; }
  [ -s "$sess_file" ] && resume=1
  [ -f "$B/out/$id.status" ] && [ "$resume" = 0 ] && rm -f "$B/out/$id.status"
  while :; do
    [ -f "$B/out/$id.status" ] && break
    wait_net
    if [ "$resume" = 1 ] && [ -s "$sess_file" ]; then
      sid=$(cat "$sess_file")
      prompt="Continue task $id from where you stopped. Follow the unattended rules. Read the git state and the task card first; do not start over. Finish by writing .batch/out/$id.status."
      sid_args=(--resume "$sid")
    else
      sid=$(cat /proc/sys/kernel/random/uuid); echo "$sid" >"$sess_file"
      prompt="Implement task $id on branch batch/$id (already checked out; base $base). Follow the skill implement-task and the section for $id in .batch/plan.md. Finish by writing .batch/out/$id.status."
      [ "$resume" = 1 ] && prompt="$prompt The branch may already hold earlier work: read git log and git status and continue from there."
      sid_args=(--session-id "$sid")
    fi
    logf="$B/logs/$id.$(date +%s).jsonl"
    log "$id: session $sid (attempt $((attempts + 1)), resume=$resume)"
    timeout "$ATTEMPT_TIMEOUT" "$CLAUDE" -p "$prompt" "${sid_args[@]}" \
      --permission-mode dontAsk --permission-prompts none --settings "$B/settings.json" \
      --model "$MODEL" --effort "$EFFORT" \
      --append-system-prompt "$(cat "$ROOT/scripts/batch/unattended.md")" \
      --output-format stream-json --verbose </dev/null >"$logf" 2>&1
    rc=$?
    [ -f "$B/out/$id.status" ] && break
    if limit_hit "$logf"; then wait_limit "$logf"; resume=1; continue; fi
    if ! net_ok; then log "$id: network lost; waiting"; resume=1; continue; fi
    if grep -q -i 'no conversation found' "$logf"; then : >"$sess_file"; resume=1; continue; fi
    attempts=$((attempts + 1)); resume=1
    log "$id: attempt ended rc=$rc without a status file ($attempts/2)"
    if [ "$attempts" -ge 2 ]; then state_set "$id" failed; fail_status "$id" "two attempts ended without a status file (last rc=$rc); see .batch/logs"; return; fi
  done
  local verdict; verdict=$(head -1 "$B/out/$id.status")
  if [ "$verdict" = review ]; then
    if [ -n "$(git status --porcelain)" ]; then verdict=blocked; fail_status "$id" "task ended with a dirty working tree"
    elif [ "$(git rev-list --count "$( [ "$base" = main ] && echo main || echo "batch/${base#after:}")..HEAD")" -eq 0 ]; then verdict=blocked; fail_status "$id" "task reported review but made no commit"
    elif ! run_gate "$id" "$gate" "$( [ "$base" = main ] && echo main || echo "batch/${base#after:}")"; then verdict=blocked; fail_status "$id" "the runner's own gate failed (gate $gate); see .batch/logs/$id.gate.log"
    fi
  fi
  [ "$verdict" = review ] && state_set "$id" review || state_set "$id" blocked
  log "$id: $(state_get "$id")"
  git switch -q "$START_BRANCH" 2>/dev/null || git switch -q main
}

cmd_run() {
  mkdir -p "$B/state" "$B/out" "$B/logs"
  if [ -z "${BATCH_INHIBITED:-}" ] && command -v systemd-inhibit >/dev/null; then
    BATCH_INHIBITED=1 exec systemd-inhibit --what=sleep:idle:handle-lid-switch --who=batch --why="unattended task batch" "$0" run
  fi
  exec 9>"$B/lock"; flock -n 9 || { echo "another runner holds .batch/lock"; exit 1; }
  cmd_check >"$B/check.log" 2>&1 || { cat "$B/check.log"; echo "check failed; nothing started"; exit 1; }
  START_BRANCH=$(git branch --show-current)
  case $START_BRANCH in batch/*) START_BRANCH=main ;; esac
  local id base gate dep
  while read -r id base gate _; do
    case $(state_get "$id") in review|blocked|failed|skipped) continue ;; esac
    if [ -n "${BATCH_STOP_AT:-}" ] && [ "$(date +%H%M)" \> "${BATCH_STOP_AT/:/}" ] && [ "$(date +%H%M)" \< "1200" ]; then log "stop time $BATCH_STOP_AT reached"; break; fi
    free=$(free_gb); [ "${free:-0}" -ge "$MIN_FREE_GB" ] || { log "disk below $MIN_FREE_GB GB; stopping"; break; }
    case $base in after:*) dep=${base#after:}
      case $(state_get "$dep") in review) ;; *) state_set "$id" skipped; fail_status "$id" "skipped: dependency $dep is $(state_get "$dep")"; log "$id: skipped"; continue ;; esac ;;
    esac
    cur=$(git branch --show-current)
    if [ -n "$(git status --porcelain)" ] && [ "$cur" != "batch/$id" ]; then log "dirty tree on $cur, not on batch/$id; stopping"; break; fi
    run_task "$id" "$base" "$gate"
  done < <(queue_lines)
  log "batch finished; see: scripts/batch/batch.sh status"
}

cmd_status() {
  local id base gate
  [ -f "$B/queue" ] || { echo "no queue"; return; }
  printf '%-12s %-9s %s\n' TASK STATE NOTE
  while read -r id base gate _; do
    printf '%-12s %-9s %s\n' "$id" "$(state_get "$id")" "$(sed -n 2p "$B/out/$id.status" 2>/dev/null | cut -c1-100)"
  done < <(queue_lines)
}

cmd_report() {
  local id base gate br ref; { echo "# Batch report ($(date '+%F %T'))"; echo
  while read -r id base gate _; do
    br="batch/$id"; ref=main; [ "$base" = main ] || ref="batch/${base#after:}"
    echo "## $id: $(state_get "$id") (base $ref, gate $gate)"
    [ -f "$B/out/$id.status" ] && sed 's/^/> /' "$B/out/$id.status"
    git rev-parse --verify -q "$br" >/dev/null && { echo; git log --oneline "$ref..$br"; echo; git diff "$ref..$br" | grep -E '^\+.*(UNATTENDED CHOICE|BLOCKED \(batch\))' | sed 's/^+//'; }
    echo
  done < <(queue_lines); } >"$B/report.md"
  cat "$B/report.md"
}

case ${1:-} in
  check) cmd_check ;;
  run) cmd_run ;;
  status) cmd_status ;;
  report) cmd_report ;;
  unblock) [ -n "${2:-}" ] || exit 2; rm -f "$B/out/$2.status"; state_set "$2" pending; echo "$2 will resume its session on the next run" ;;
  reset) [ -n "${2:-}" ] || exit 2; rm -f "$B/out/$2.status" "$B/sessions/$2"; state_set "$2" pending
         echo "$2 restarts with a new session on branch batch/$2 (the branch is kept; delete it yourself to restart from the base)" ;;
  *) sed -n '2,3p' "$0"; exit 2 ;;
esac
