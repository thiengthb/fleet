#requires -Version 5.1
<#
  auto-pilot orchestrator (Windows / PowerShell). A DUMB loop - NOT a Claude session, so it costs 0 agent tokens.
  It relaunches a FRESH `claude -p` worker per batch (never --continue/--resume, so context never grows/compacts)
  until: the plan has no unchecked safe-zone steps left, a batch made no progress (parked/stalled), or the batch
  cap is hit. Each worker runs with CLAUDE_AUTONOMOUS=1 so autonomy-gate.mjs is the hard gate (the SOLE gate for an
  unattended run). Contract: nuc-platform/09-autonomy-contract.md.

  NOTE: keep this file ASCII-only (Windows PowerShell 5.1 mis-decodes UTF-8-without-BOM non-ASCII chars).
  Flags validated against the installed CLI. Worker must NOT use --bare (that skips hooks -> disables the gate).
  Defense-in-depth: --disallowedTools denies the worst classes even before the hook.

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

# Unchecked checklist items, EXCLUDING (GATE)-marked ones (those await a human, must not drive the loop).
function Get-UncheckedCount([string] $path) {
  $lines = Get-Content -LiteralPath $path
  @($lines | Where-Object { $_ -match '^\s*-\s*\[ \]' -and $_ -notmatch '\(GATE\)' }).Count
}

$prompt = "Run ONE /auto-pilot batch for the approved plan at '$Plan'. Advance the next 1-3 safe-zone steps on the auto/ branch, commit locally, then PARK at the first gate and emit a digest. Never push, deploy, or cross any gate."
# Defense-in-depth: deny the worst command classes at the CLI layer too (the hook is still the primary gate).
$disallow = @('Bash(git push:*)', 'Bash(git merge:*)', 'Bash(docker:*)', 'Bash(ssh:*)', 'Bash(rm:*)')

Write-Host "[auto-pilot] plan=$Plan model=$Model maxBatches=$MaxBatches dryRun=$DryRun"
for ($i = 1; $i -le $MaxBatches; $i++) {
  $before = Get-UncheckedCount $Plan
  if ($before -eq 0) { Write-Host '[auto-pilot] no unchecked steps left - done.'; break }
  Write-Host "[auto-pilot] batch $i/$MaxBatches - $before unchecked step(s) remain"

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

  $after = Get-UncheckedCount $Plan
  if ($after -ge $before) {
    Write-Host '[auto-pilot] no progress (parked or stalled) - stopping for human review.'
    break
  }
}
Write-Host '[auto-pilot] loop ended. Review the auto/ branch and the plan digest.'
