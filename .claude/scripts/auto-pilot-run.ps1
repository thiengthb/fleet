#requires -Version 5.1
<#
  auto-pilot orchestrator (Windows / PowerShell). A DUMB loop - NOT a Claude session, so it costs 0 agent tokens.
  It relaunches a FRESH `claude -p` worker per batch (never --continue/--resume, so context never grows/compacts)
  until: the plan has no unchecked safe-zone steps left, a batch made no progress (parked/stalled), or the batch
  cap is hit. Each worker runs with CLAUDE_AUTONOMOUS=1 so autonomy-gate.mjs is the hard gate (the SOLE gate for an
  unattended run). Contract: nuc-platform/09-autonomy-contract.md.

  B4 two-way control plane: this loop also syncs the private "gates" repo clone (GATE_REPO_DIR) - pull approvals the
  Discord bot wrote BEFORE each batch, push the worker's park-requests AFTER. Auto-detected; a no-op if the clone is
  absent. On a park the loop stops; the human approves in Discord, then re-runs this script and the next batch crosses
  exactly that one gate.

  NOTE: keep this file ASCII-only (Windows PowerShell 5.1 mis-decodes UTF-8-without-BOM non-ASCII chars).
  Flags validated against the installed CLI. Worker must NOT use --bare (that skips hooks -> disables the gate).

  B4b.3 FIX (2026-06-15): Get-UncheckedCount EXCLUDES (GATE) lines, so when the ONLY remaining work is an approved
  gate (e.g. "open a PR" is the last step), before==0 -> the loop said "done" and NEVER spawned the batch that would
  cross it. Fix: also spawn a batch when a gate is already approved (Test-GateApproved), and count "the approved gate
  got crossed/consumed" as progress. See nuc-platform/plans/2026-06-14-autonomous-agent.md B4b.3 finding #2.

  Usage: ./auto-pilot-run.ps1 -Plan nuc-platform/plans/2026-06-14-foo.md [-MaxBatches 8] [-Model sonnet] [-DryRun]
#>
param(
  [Parameter(Mandatory = $true)] [string] $Plan,
  [int] $MaxBatches = 8,
  [string] $Model = 'sonnet',
  [switch] $DryRun
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Plan)) { Write-Error "Plan not found: $Plan"; exit 1 }

# Gate-approval state channel (B4): a local clone of the private gates repo. No-op if it isn't a git repo.
$GateRepoDir = if ($env:GATE_REPO_DIR) { $env:GATE_REPO_DIR } else { Join-Path $HOME '.claude/agent-gates' }
function Test-GateRepo { Test-Path -LiteralPath (Join-Path $GateRepoDir '.git') }
function Invoke-GatePull {
  if (Test-GateRepo) { try { git -C $GateRepoDir pull --quiet --ff-only | Out-Null } catch {} }
}
function Invoke-GatePush {
  if (-not (Test-GateRepo)) { return }
  try {
    $dirty = git -C $GateRepoDir status --porcelain
    if ($dirty) {
      git -C $GateRepoDir add -A | Out-Null
      git -C $GateRepoDir commit -q -m 'gate: agent park-request(s)' | Out-Null
      git -C $GateRepoDir push -q | Out-Null
    }
  } catch {}
}
# True iff a fresh, valid APPROVE token authorizes the currently-parked gate (worker's Step 1.5 will cross it).
# Feature-off / no gate-cli / no pending gate -> false (loop behaves exactly as before).
function Test-GateApproved {
  if (-not (Test-Path -LiteralPath '.claude/scripts/gate-cli.mjs')) { return $false }
  try { return ((& node .claude/scripts/gate-cli.mjs check) -join '').Trim() -eq 'approve' } catch { return $false }
}

# Unchecked checklist items, EXCLUDING (GATE)-marked ones (those await a human, must not drive the loop).
function Get-UncheckedCount([string] $path) {
  $lines = Get-Content -LiteralPath $path
  @($lines | Where-Object { $_ -match '^\s*-\s*\[ \]' -and $_ -notmatch '\(GATE\)' }).Count
}

$prompt = "Run ONE /auto-pilot batch for the approved plan at '$Plan'. Advance the next 1-3 safe-zone steps on the auto/ branch, commit locally, then PARK at the first gate and emit a digest. If a parked PR gate is approved (gate-cli check == approve), cross exactly that one gate, then consume. Never push main, deploy, or cross any other gate."
# Defense-in-depth at the CLI layer. NOTE: 'git push' is deliberately NOT denied here - the autonomy-gate hook is the
# sole arbiter of pushes (allows ONLY a token-approved 'git push <remote> auto/<branch>', blocks the rest, verified
# 24/24); a blanket CLI push-deny would also block the approved push and break B4b. merge/docker/ssh/rm stay denied.
$disallow = @('Bash(git merge:*)', 'Bash(docker:*)', 'Bash(ssh:*)', 'Bash(rm:*)')

$gateState = if (Test-GateRepo) { '(synced)' } else { '(absent)' }
Write-Host "[auto-pilot] plan=$Plan model=$Model maxBatches=$MaxBatches dryRun=$DryRun gateRepo=$GateRepoDir $gateState"
for ($i = 1; $i -le $MaxBatches; $i++) {
  Invoke-GatePull  # fetch approvals the bot wrote since the last batch
  $before = Get-UncheckedCount $Plan
  $approvedBefore = Test-GateApproved
  # Spawn a batch if there is safe-zone work OR an approved gate waiting to be crossed.
  if ($before -eq 0 -and -not $approvedBefore) { Write-Host '[auto-pilot] no unchecked steps left - done.'; break }
  if ($approvedBefore) {
    Write-Host "[auto-pilot] batch $i/$MaxBatches - approved gate pending + $before safe-zone step(s)"
  }
  else {
    Write-Host "[auto-pilot] batch $i/$MaxBatches - $before unchecked step(s) remain"
  }

  $claudeArgs = @('-p', $prompt, '--model', $Model, '--permission-mode', 'acceptEdits', '--disallowedTools') + $disallow
  if ($DryRun) {
    Write-Host "[auto-pilot][dry-run] would run: CLAUDE_AUTONOMOUS=1 claude $($claudeArgs -join ' ')"
    break
  }

  $env:CLAUDE_AUTONOMOUS = '1'
  try {
    & claude @claudeArgs
  } catch {
    Write-Host "[auto-pilot] worker error: $_"
  } finally {
    Remove-Item Env:\CLAUDE_AUTONOMOUS -ErrorAction SilentlyContinue
  }

  Invoke-GatePush  # publish any park-request the worker wrote this batch
  $after = Get-UncheckedCount $Plan
  $approvedAfter = Test-GateApproved
  # Progress = a safe-zone step got checked OFF, OR an approved gate got crossed (approve -> consumed/none).
  $crossedGate = ($approvedBefore -and -not $approvedAfter)
  if ($after -ge $before -and -not $crossedGate) {
    Write-Host '[auto-pilot] no progress (parked or stalled) - stopping for human review.'
    break
  }
}
Write-Host '[auto-pilot] loop ended. Review the auto/ branch and the plan digest.'
