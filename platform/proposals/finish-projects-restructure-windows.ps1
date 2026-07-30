<#
  finish-projects-restructure-windows.ps1 -- step E9 of platform/plans/2026-07-28-fleet-rename-and-restructure.md

  WHAT IT DOES, in ONE run:
    1. moves the nine app repos from C:\project\fleet\<name>  ->  C:\project\fleet\projects\<name>
    2. renames the stale local folder  ui-kit  ->  commons  (it is already the thiengthb/commons repo; only the
       folder name predates the rename, which is why 16 catalog rows under commons/ could not resolve)
    3. re-runs link-check and prints the BROKEN count before and after, so the result is measured not assumed

  WHY A SCRIPT AND NOT THE AGENT. Measured on 2026-07-30: every directory containing a .git under this root
  refuses to be renamed or moved -- "Access is denied" -- while a non-repo directory beside it moves fine and a
  git repo created minutes earlier also moves fine. It is not permissions (the ACLs are identical) and no child
  file is locked: something discovers git repositories under this tree and holds a directory handle on each one,
  which is exactly what blocks a rename while leaving the contents free. The likeliest holder is the editor's
  git integration (20 Code.exe processes were running); the other candidate is the live agent session itself.
  Either way the move belongs at a session boundary, like the folder rename in E8 did.

  RUN IT WITH THE EDITOR CLOSED, FROM OUTSIDE A CLAUDE CODE SESSION:

    powershell -ExecutionPolicy Bypass -File C:\project\fleet\platform\proposals\finish-projects-restructure-windows.ps1

  If a move still fails it says which folder and stops touching that one -- it never continues past a failure
  silently, and it never deletes or copies anything. Re-runnable: anything already in place is skipped.

  WHAT IT DOES NOT FIX. `docgen` has no remote (verified absent on GitHub 2026-07-30) and exists on the Linux
  box only, so its INVENTORY Dev path cannot resolve here no matter what this script does. That is a backup
  problem, not a layout one.
#>

[CmdletBinding()]
param(
  [string]$Root = "C:\project\fleet",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$apps = @(
  "authentik", "jobhunter-bot", "journal", "n8n", "nuc-monitor",
  "nuc-ops-bot", "sakubun", "todo", "yakudoku"
)

function Get-BrokenCount {
  param([string]$Root)
  $out = & node (Join-Path $Root ".claude\scripts\link-check.mjs") 2>&1 | Out-String
  $m = [regex]::Match($out, "(\d+)\s+broken")
  if ($m.Success) { return [int]$m.Groups[1].Value }
  return -1
}

if (-not (Test-Path $Root)) { throw "root not found: $Root" }

Write-Output "finish-projects-restructure -- root: $Root$(if ($DryRun) { '  [DRY RUN]' })"
$before = Get-BrokenCount -Root $Root
Write-Output "link-check BROKEN before: $before"
Write-Output ""

$projects = Join-Path $Root "projects"
if (-not (Test-Path $projects)) {
  if (-not $DryRun) { New-Item -ItemType Directory $projects | Out-Null }
  Write-Output "created projects\"
}

$failed = @()
foreach ($a in $apps) {
  $src = Join-Path $Root $a
  $dst = Join-Path $projects $a
  if (Test-Path $dst) { Write-Output ("{0,-14} already in projects\ -- skipped" -f $a); continue }
  if (-not (Test-Path $src)) { Write-Output ("{0,-14} not on this box -- skipped" -f $a); continue }
  if ($DryRun) { Write-Output ("{0,-14} would move" -f $a); continue }
  try {
    Move-Item -Path $src -Destination $dst -ErrorAction Stop
    Write-Output ("{0,-14} moved" -f $a)
  } catch {
    $failed += $a
    Write-Output ("{0,-14} FAILED: {1}" -f $a, $_.Exception.Message)
  }
}

# ui-kit is the commons repo under its pre-rename folder name; confirm the remote before renaming anything.
$uiKit = Join-Path $Root "ui-kit"
$commons = Join-Path $Root "commons"
if (Test-Path $commons) {
  Write-Output "commons        already named commons -- skipped"
} elseif (Test-Path $uiKit) {
  $remote = (& git -C $uiKit remote get-url origin 2>$null)
  if ($remote -notlike "*thiengthb/commons*") {
    Write-Output "ui-kit         NOT the commons repo (origin: $remote) -- left alone on purpose"
  } elseif ($DryRun) {
    Write-Output "ui-kit         would rename to commons"
  } else {
    try {
      Rename-Item -Path $uiKit -NewName "commons" -ErrorAction Stop
      Write-Output "ui-kit         renamed to commons"
    } catch {
      $failed += "ui-kit"
      Write-Output ("ui-kit         FAILED: {0}" -f $_.Exception.Message)
    }
  }
}

Write-Output ""
if ($DryRun) { Write-Output "dry run -- nothing was moved."; exit 0 }

$after = Get-BrokenCount -Root $Root
Write-Output "link-check BROKEN after:  $after   (was $before)"

if ($failed.Count) {
  Write-Output ""
  Write-Output "STILL HELD: $($failed -join ', ')"
  Write-Output "Close the editor (and any terminal whose current directory is inside one of these), then re-run."
  Write-Output "Nothing was copied or deleted -- the folders that failed are exactly as they were."
  exit 1
}

Write-Output ""
Write-Output "Remaining BROKEN wires should now be docgen only (no remote, Linux box only)."
Write-Output "Then: tick E9 in platform/plans/2026-07-28-fleet-rename-and-restructure.md and re-run health-sweep."
exit 0
