#!/usr/bin/env bash
# auto-pilot orchestrator (POSIX / Git Bash). A DUMB loop — NOT a Claude session, so it costs 0 agent tokens.
# It relaunches a FRESH `claude -p` worker per batch (never --continue/--resume, so context never grows/compacts)
# until: the plan has no unchecked safe-zone steps left, a batch made no progress (parked/stalled), or the batch
# cap is hit. Each worker runs with CLAUDE_AUTONOMOUS=1 so autonomy-gate.mjs is the hard gate (the SOLE gate for an
# unattended run). Contract: nuc-platform/09-autonomy-contract.md.
#
# B4 two-way control plane: this loop also syncs the private "gates" repo clone (GATE_REPO_DIR) — pull approvals the
# Discord bot wrote BEFORE each batch, push the worker's park-requests AFTER. Auto-detected; a no-op if the clone is
# absent (feature simply off). On a park the loop stops (no progress) — the human approves in Discord, then re-runs
# this script; the next batch's worker sees `gate-cli check == approve` and crosses exactly that one gate.
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

# Gate-approval state channel (B4): a local clone of the private gates repo. No-op if it isn't a git repo.
GATE_REPO_DIR="${GATE_REPO_DIR:-$HOME/.claude/agent-gates}"
gate_is_repo() { [ -d "$GATE_REPO_DIR/.git" ]; }
gate_pull() { gate_is_repo && git -C "$GATE_REPO_DIR" pull --quiet --ff-only 2>/dev/null || true; }
gate_push() {
  gate_is_repo || return 0
  [ -n "$(git -C "$GATE_REPO_DIR" status --porcelain 2>/dev/null)" ] || return 0
  git -C "$GATE_REPO_DIR" add -A 2>/dev/null \
    && git -C "$GATE_REPO_DIR" commit -q -m "gate: agent park-request(s)" 2>/dev/null \
    && git -C "$GATE_REPO_DIR" push -q 2>/dev/null || true
}

# Unchecked checklist items, EXCLUDING (GATE)-marked ones (those await a human, must not drive the loop).
count_unchecked() { awk '/^[[:space:]]*-[[:space:]]*\[ \]/ && !/\(GATE\)/ {n++} END{print n+0}' "$1"; }

PROMPT="Run ONE /auto-pilot batch for the approved plan at '$PLAN'. Advance the next 1-3 safe-zone steps on the auto/ branch, commit locally, then PARK at the first gate and emit a digest. If a parked PR gate is approved (gate-cli check == approve), cross exactly that one gate, then consume. Never push main, deploy, or cross any other gate."

# Defense-in-depth: deny the worst command classes at the CLI layer too. The autonomy-gate hook is the AUTHORITATIVE
# gate. NOTE: `git push` is deliberately NOT in this list — the hook is the sole arbiter of pushes (it allows ONLY a
# token-approved `git push <remote> auto/<branch>` and blocks everything else, verified 24/24); a blanket CLI push-deny
# here would also block that approved push and break B4b. merge/docker/ssh/rm stay denied (never token-unlockable).
DISALLOW=('Bash(git merge:*)' 'Bash(docker:*)' 'Bash(ssh:*)' 'Bash(rm:*)')

echo "[auto-pilot] plan=$PLAN model=$MODEL maxBatches=$MAX_BATCHES dryRun=$DRY_RUN gateRepo=$GATE_REPO_DIR$(gate_is_repo && echo ' (synced)' || echo ' (absent)')"
for i in $(seq 1 "$MAX_BATCHES"); do
  gate_pull # fetch approvals the bot wrote since the last batch
  before="$(count_unchecked "$PLAN")"
  if [ "$before" -eq 0 ]; then echo "[auto-pilot] no unchecked steps left — done."; break; fi
  echo "[auto-pilot] batch $i/$MAX_BATCHES — $before unchecked step(s) remain"
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "[auto-pilot][dry-run] would run: CLAUDE_AUTONOMOUS=1 claude -p \"<prompt>\" --model $MODEL --permission-mode acceptEdits --disallowedTools ${DISALLOW[*]}"
    break
  fi
  CLAUDE_AUTONOMOUS=1 claude -p "$PROMPT" --model "$MODEL" --permission-mode acceptEdits --disallowedTools "${DISALLOW[@]}" || true
  gate_push # publish any park-request the worker wrote this batch
  after="$(count_unchecked "$PLAN")"
  if [ "$after" -ge "$before" ]; then
    echo "[auto-pilot] no progress (parked or stalled) — stopping for human review."
    break
  fi
done
echo "[auto-pilot] loop ended. Review the auto/ branch + the plan's digest."
