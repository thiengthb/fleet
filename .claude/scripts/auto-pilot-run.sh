#!/usr/bin/env bash
# auto-pilot orchestrator (POSIX / Git Bash). A DUMB loop — NOT a Claude session, so it costs 0 agent tokens.
# It relaunches a FRESH `claude -p` worker per batch (never --continue/--resume, so context never grows/compacts)
# until: the plan has no unchecked safe-zone steps left, a batch made no progress (parked/stalled), or the batch
# cap is hit. Each worker runs with CLAUDE_AUTONOMOUS=1 so autonomy-gate.mjs is the hard gate (the SOLE gate for an
# unattended run). Contract: nuc-platform/09-autonomy-contract.md.
#
# NOTE: the `claude -p` flags below were validated against the installed CLI. Worker must NOT use --bare (that skips
# hooks → would disable the gate). Defense-in-depth: --disallowedTools denies the worst classes even before the hook.
set -euo pipefail

PLAN=""; MAX_BATCHES=8; MODEL="sonnet"; DRY_RUN=0
while [ $# -gt 0 ]; do
  case "$1" in
    --plan) PLAN="${2:-}"; shift 2;;
    --max-batches) MAX_BATCHES="${2:-8}"; shift 2;;
    --model) MODEL="${2:-sonnet}"; shift 2;;
    --dry-run) DRY_RUN=1; shift;;
    *) echo "unknown arg: $1" >&2; exit 1;;
  esac
done
[ -n "$PLAN" ] || { echo "usage: auto-pilot-run.sh --plan <path> [--max-batches N] [--model m] [--dry-run]" >&2; exit 1; }
[ -f "$PLAN" ] || { echo "plan not found: $PLAN" >&2; exit 1; }

# Unchecked checklist items, EXCLUDING (GATE)-marked ones (those await a human, must not drive the loop).
count_unchecked() { awk '/^[[:space:]]*-[[:space:]]*\[ \]/ && !/\(GATE\)/ {n++} END{print n+0}' "$1"; }

PROMPT="Run ONE /auto-pilot batch for the approved plan at '$PLAN'. Advance the next 1-3 safe-zone steps on the auto/ branch, commit locally, then PARK at the first gate and emit a digest. Never push, deploy, or cross any gate."

# Defense-in-depth: deny the worst command classes at the CLI layer too (the hook is still the primary gate).
DISALLOW='Bash(git push:*) Bash(git merge:*) Bash(docker:*) Bash(ssh:*) Bash(rm:*)'

echo "[auto-pilot] plan=$PLAN model=$MODEL maxBatches=$MAX_BATCHES dryRun=$DRY_RUN"
for i in $(seq 1 "$MAX_BATCHES"); do
  before="$(count_unchecked "$PLAN")"
  if [ "$before" -eq 0 ]; then echo "[auto-pilot] no unchecked steps left — done."; break; fi
  echo "[auto-pilot] batch $i/$MAX_BATCHES — $before unchecked step(s) remain"
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "[auto-pilot][dry-run] would run: CLAUDE_AUTONOMOUS=1 claude -p \"<prompt>\" --model $MODEL --permission-mode acceptEdits --disallowedTools \"$DISALLOW\""
    break
  fi
  CLAUDE_AUTONOMOUS=1 claude -p "$PROMPT" --model "$MODEL" --permission-mode acceptEdits --disallowedTools $DISALLOW || true
  after="$(count_unchecked "$PLAN")"
  if [ "$after" -ge "$before" ]; then
    echo "[auto-pilot] no progress (parked or stalled) — stopping for human review."
    break
  fi
done
echo "[auto-pilot] loop ended. Review the auto/ branch + the plan's digest."
