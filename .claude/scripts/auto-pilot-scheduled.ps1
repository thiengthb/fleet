#requires -Version 5.1
<#
  auto-pilot SCHEDULED wrapper (Windows). The "session brain" launched by Task Scheduler so the agent self-runs while
  the user is logged on - NO need for the user to sit at the keyboard. It:
    1. Opens a dated Start-Transcript log (the readable "minutes" / bien-ban the supervisor reads later) - NOT `2>&1`
       on the native claude exe (ledger #60: that turns a benign warning into a terminating error, silent worker death).
    2. Discovers opted-in active plans (frontmatter `status: active` AND `auto_pilot: true`) and advances each one
       orchestrator run via the UNCHANGED, 24/24-verified auto-pilot-run.ps1.
    3. C3 self-sourcing: when NO actionable safe-zone plan work remains, fires ONE bounded /idea gap-analysis batch
       (propose-only, <=2 externally-grounded inbox ideas, never builds), throttled to once per calendar day.
    4. Closes the transcript.

  Why a wrapper (not an edit to auto-pilot-run.ps1): keeps the verified orchestrator + autonomy-gate byte-identical
  (zero risk to a critical, hook-bearing file); plan-discovery, scheduling, logging and the GLOBAL gap-analysis pass are
  session-brain concerns, not per-plan ones. Contract: nuc-platform/09-autonomy-contract.md.
  Design: nuc-platform/plans/2026-06-16-self-running-agent.md.

  MUST be registered as a Task Scheduler task with "Run only when user is logged on" - Session 0 cannot decrypt the
  DPAPI-protected ~/.claude auth + gh/git credentials, so claude would fail silently (researched 2026-06-16). ASCII-only.

  Usage (manual test before scheduling): ./auto-pilot-scheduled.ps1 -DryRun
                                         ./auto-pilot-scheduled.ps1 [-MaxBatches 6] [-Model sonnet] [-NoPropose]
#>
param(
  [int] $MaxBatches = 6,
  [string] $Model = 'sonnet',
  [switch] $NoPropose,
  [switch] $DryRun
)

$ErrorActionPreference = 'Stop'

# Repo root = two levels above .claude/scripts/. Resolve from THIS script's own location so the task can set any CWD.
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location -LiteralPath $RepoRoot

$LogDir = if ($env:AUTOPILOT_LOG_DIR) { $env:AUTOPILOT_LOG_DIR } else { Join-Path $HOME '.claude/auto-pilot-logs' }
if (-not (Test-Path -LiteralPath $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

# Single-flight lock: do NOT start a new cycle if the previous one is still running (prevents pile-up under the 4h Task
# Scheduler repeat when a cycle runs long; together with -MaxBatches it bounds per-window cost). A stale lock whose PID
# is gone is reclaimed. ASCII-only.
$LockFile = Join-Path $LogDir 'auto-pilot.lock'
if (Test-Path -LiteralPath $LockFile) {
  $lockPid = (Get-Content -LiteralPath $LockFile -Raw -ErrorAction SilentlyContinue).Trim()
  $alive = $false
  if ($lockPid -match '^\d+$') { $alive = $null -ne (Get-Process -Id ([int]$lockPid) -ErrorAction SilentlyContinue) }
  if ($alive) { Write-Host "[scheduled] previous cycle still running (PID $lockPid) - exiting to avoid overlap."; return }
  Write-Host "[scheduled] stale lock (PID $lockPid gone) - reclaiming."
}
Set-Content -LiteralPath $LockFile -Value "$PID" -Encoding ascii

$stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$transcript = Join-Path $LogDir "auto-pilot-$stamp.log"
Start-Transcript -LiteralPath $transcript -Append | Out-Null
try {
  Write-Host "[scheduled] start $(Get-Date -Format o)  repo=$RepoRoot  model=$Model  maxBatches=$MaxBatches  noPropose=$NoPropose  dryRun=$DryRun"

  $orchestrator = Join-Path $PSScriptRoot 'auto-pilot-run.ps1'
  if (-not (Test-Path -LiteralPath $orchestrator)) { Write-Error "orchestrator not found: $orchestrator"; return }

  # Resolve the REAL claude binary behind the claude.ps1 npm shim (we launch the .exe directly - see Invoke-ConsoleChild).
  $claudeCmd = (Get-Command claude -ErrorAction SilentlyContinue).Source
  $claudeExe = if ($claudeCmd) { Join-Path (Split-Path $claudeCmd -Parent) 'node_modules/@anthropic-ai/claude-code/bin/claude.exe' } else { 'claude' }

  # Launch a console child (claude.exe / the orchestrator powershell) in its OWN hidden console, decoupled from the
  # Task Scheduler launch context. ROOT CAUSE (verified 2026-06-17): under Task Scheduler "run only when user is logged
  # on", a console child inherits the task's console group and dies the instant claude.exe starts with
  # STATUS_CONTROL_C_EXIT (0xC000013A) - zero output. Start-Process WITHOUT -NoNewWindow gives the child a fresh
  # (hidden) conhost so it survives. DO NOT add -RedirectStandardOutput/-NoNewWindow: those force UseShellExecute=false,
  # which removes the fresh console and reintroduces the bug. Trade-off: the child's stdout is not folded into this
  # transcript (it owns its console); we log the exit code and rely on git / the idea-queue as the readable artifact.
  function Invoke-ConsoleChild {
    param([Parameter(Mandatory)][string] $FilePath, [string[]] $ArgumentList, [string] $OutLog)
    if ($OutLog) {
      # Capture child stdout/stderr to FILES (not a PS pipeline -> safe from the ledger #60 native-stderr trap). This
      # is also how we learn whether claude actually did the work vs silently no-op'd under the scheduler.
      $p = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -WorkingDirectory $RepoRoot `
             -Wait -PassThru -RedirectStandardOutput $OutLog -RedirectStandardError "$OutLog.err"
    } else {
      $p = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -WorkingDirectory $RepoRoot `
             -WindowStyle Hidden -Wait -PassThru
    }
    return $p.ExitCode
  }

  function Get-UncheckedCount([string] $path) {
    $lines = Get-Content -LiteralPath $path
    @($lines | Where-Object { $_ -match '^\s*-\s*\[ \]' -and $_ -notmatch '\(GATE\)' }).Count
  }
  # A plan is opted-in iff its frontmatter has BOTH `status: active` and `auto_pilot: true` (explicit supervisor consent
  # per-plan: only plans the human blessed for unattended advancement are picked up).
  function Get-OptedInPlans {
    $found = @()
    $dir = Join-Path $RepoRoot 'nuc-platform/plans'
    Get-ChildItem -LiteralPath $dir -Filter '*.md' -File -ErrorAction SilentlyContinue | ForEach-Object {
      $head = Get-Content -LiteralPath $_.FullName -TotalCount 15
      $isActive = @($head | Where-Object { $_ -match '^\s*status:\s*active\b' }).Count -gt 0
      $isAuto = @($head | Where-Object { $_ -match '^\s*auto_pilot:\s*true\b' }).Count -gt 0
      if ($isActive -and $isAuto) { $found += $_.FullName }
    }
    return $found
  }

  # C3 throttle: gap-analysis at most once per calendar day across ALL scheduled runs (avoids queue churn).
  $ProposeMarker = Join-Path $LogDir 'last-propose.txt'
  function Test-ProposedToday {
    if (-not (Test-Path -LiteralPath $ProposeMarker)) { return $false }
    try { return (Get-Content -LiteralPath $ProposeMarker -Raw).Trim() -eq (Get-Date -Format 'yyyy-MM-dd') } catch { return $false }
  }

  # --- 1) advance each opted-in active plan (UNCHANGED orchestrator, gate is sole arbiter) ---
  $plans = @(Get-OptedInPlans)
  Write-Host "[scheduled] opted-in active plans: $($plans.Count)"
  foreach ($p in $plans) {
    $rel = (Resolve-Path -LiteralPath $p -Relative)
    Write-Host "[scheduled] --- advancing plan: $rel"
    $psArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $orchestrator, '-Plan', $rel, '-MaxBatches', "$MaxBatches", '-Model', $Model)
    if ($DryRun) { $psArgs += '-DryRun' }
    # Child powershell (own hidden console - Invoke-ConsoleChild) so (a) the orchestrator's claude survives the Task
    # Scheduler context and (b) its $ErrorActionPreference='Stop' / any throw cannot abort this wrapper.
    $rc = Invoke-ConsoleChild -FilePath 'powershell.exe' -ArgumentList $psArgs
    Write-Host "[scheduled] plan run exit: $rc"
  }

  # --- 2) C3 self-sourcing proposer: ONLY when no actionable plan work remains, once/day, propose-only ---
  $remaining = 0
  foreach ($p in $plans) { $remaining += (Get-UncheckedCount $p) }
  Write-Host "[scheduled] actionable safe-zone steps remaining across opted-in plans: $remaining"
  if ($NoPropose) {
    Write-Host '[scheduled] C3 disabled (-NoPropose).'
  }
  elseif ($remaining -gt 0) {
    Write-Host '[scheduled] C3 skipped - approved-plan work still remains (balanced objective: plan progress first).'
  }
  elseif (Test-ProposedToday) {
    Write-Host '[scheduled] C3 skipped - gap-analysis already ran today (once/day throttle).'
  }
  else {
    $proposePrompt = "No approved-plan work remains. Run the /idea sort gap-analysis pass (autonomy Layer C3): propose AT MOST 1-2 NEW inbox ideas, each grounded in an EXTERNAL signal (INVENTORY drift, missing test coverage, a documented gap, or prior-art) - NOT opinion. Respect the WIP cap (active <= 5). Surface them in your digest for the supervisor. Do NOT promote past inbox, do NOT accept/plan/build anything, do NOT push or open a PR. If nothing is genuinely worth proposing, say so and STOP - that 'nothing worth proposing' return is the correct, expected outcome."
    if ($DryRun) {
      Write-Host "[scheduled][dry-run] C3 would run: CLAUDE_AUTONOMOUS=1 claude -p <prompt> --model $Model --permission-mode acceptEdits --disallowedTools Bash(git merge:*) Bash(docker:*) Bash(ssh:*) Bash(rm:*)"
    }
    else {
      Write-Host '[scheduled] C3: no approved-plan work left - running one bounded gap-analysis batch (propose-only).'
      # Pass the prompt + disallow rules to claude via a generated RUNNER script + PowerShell SPLATTING (correct
      # quoting). Start-Process -ArgumentList mangles space-bearing args (verified 2026-06-17: `Bash(git merge:*)` was
      # split at the space + the prompt was garbled -> claude no-op'd with a generic reply). The runner reads the
      # prompt from a file and splats; Start-Process only ever sees `powershell -File <runner>` (no args to mangle).
      # CLAUDE_AUTONOMOUS is set INSIDE the runner so the gated child has it (the parent wrapper never touches its env).
      $promptFile = Join-Path $LogDir "c3-prompt-$stamp.txt"
      $runner     = Join-Path $LogDir "c3-runner-$stamp.ps1"
      $c3out      = Join-Path $LogDir "c3-$stamp.out.log"
      Set-Content -LiteralPath $promptFile -Value $proposePrompt -Encoding ascii
      $runnerBody = @"
`$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath '$RepoRoot'
`$env:CLAUDE_AUTONOMOUS = '1'
`$prompt = Get-Content -LiteralPath '$promptFile' -Raw
`$disallow = @('Bash(git merge:*)','Bash(docker:*)','Bash(ssh:*)','Bash(rm:*)')
& claude -p `$prompt --model '$Model' --permission-mode acceptEdits --disallowedTools `$disallow
exit `$LASTEXITCODE
"@
      Set-Content -LiteralPath $runner -Value $runnerBody -Encoding ascii
      try {
        $rc = Invoke-ConsoleChild -FilePath 'powershell.exe' `
                -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $runner) -OutLog $c3out
        Write-Host "[scheduled] C3 claude exit: $rc  (output captured: $c3out)"
        # Only burn the once/day throttle on a clean run; a nonzero exit retries next scheduled fire.
        if ($rc -eq 0) { Set-Content -LiteralPath $ProposeMarker -Value (Get-Date -Format 'yyyy-MM-dd') -Encoding ascii }
        else { Write-Host '[scheduled] C3 claude nonzero exit - NOT marking throttle (retry next run).' }
      }
      catch { Write-Host "[scheduled] C3 gap-analysis error: $_" }
    }
  }

  Write-Host "[scheduled] done $(Get-Date -Format o)  transcript=$transcript"
}
finally {
  Remove-Item -LiteralPath $LockFile -Force -ErrorAction SilentlyContinue
  Stop-Transcript | Out-Null
}
