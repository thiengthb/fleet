<#
  finish-fleet-rename-windows.ps1 -- step E8 of platform/plans/2026-07-28-fleet-rename-and-restructure.md

  WHAT IT DOES, in ONE run:
    1. renames  C:\project\miniserver-platform  ->  C:\project\fleet
    2. rewrites every absolute path inside the RENAMED copy's gitignored .claude\settings.local.json
       (autoMemoryDirectory + the git/PowerShell permission entries)
    3. re-runs memory-audit so the result is verified, not assumed

  WHY THE TWO STEPS ARE WELDED TOGETHER. On 2026-07-29 the Linux box did step 1 and not step 2. The failure
  was not a loud error: Claude Code CREATED an empty directory at the dangling autoMemoryDirectory path and
  wired memory to it, so the tier pointed at a hollow folder next to the real one. Nothing was lost only
  because no memory happened to be written that day. Do not split these.

  RUN IT FROM A SESSION BOUNDARY, NOT INSIDE A CLAUDE CODE SESSION -- a live session holds this directory as
  its working dir and CLAUDE_PROJECT_DIR; renaming it mid-flight breaks every hook path.

    powershell -ExecutionPolicy Bypass -File C:\project\miniserver-platform\platform\proposals\finish-fleet-rename-windows.ps1

  Re-runnable: if the rename already happened it skips step 1 and still repairs the paths.
  It is a PROPOSAL living under platform/proposals/ because it edits governance wiring -- the agent wrote it,
  a human runs it.
#>

[CmdletBinding()]
param(
  [string]$Parent  = 'C:\project',
  [string]$OldName = 'miniserver-platform',
  [string]$NewName = 'fleet'
)

$ErrorActionPreference = 'Stop'
$old = Join-Path $Parent $OldName
$new = Join-Path $Parent $NewName

Write-Host "== step 1/3: rename the working directory ==" -ForegroundColor Cyan
if (Test-Path $new) {
  if (Test-Path $old) { throw "BOTH '$old' and '$new' exist. Refusing to guess which is live -- merge or remove one by hand first." }
  Write-Host "   already renamed: $new"
} elseif (-not (Test-Path $old)) {
  throw "Neither '$old' nor '$new' exists. Check `$Parent (currently '$Parent')."
} else {
  # A file handle inside the tree makes Move-Item fail cleanly rather than half-move; surface it plainly.
  try { Move-Item -LiteralPath $old -Destination $new }
  catch { throw "Rename failed -- something is holding a file open in '$old' (a running dev server, an editor, a Claude Code session?). Close it and re-run. Original error: $($_.Exception.Message)" }
  Write-Host "   $old  ->  $new"
}

Write-Host "== step 2/3: repair the absolute paths inside .claude\settings.local.json ==" -ForegroundColor Cyan
$settings = Join-Path $new '.claude\settings.local.json'
if (-not (Test-Path $settings)) {
  Write-Warning "   no settings.local.json at $settings -- it is gitignored, so a fresh clone has none. Create it with:"
  Write-Warning "     { `"autoMemoryDirectory`": `"$new\.claude\memory`" }"
} else {
  $raw = Get-Content -LiteralPath $settings -Raw
  # Validate BEFORE and AFTER: this file gates every permission prompt, and a corrupt one fails at startup.
  try { $null = $raw | ConvertFrom-Json } catch { throw "settings.local.json is already invalid JSON -- fix it before running this: $($_.Exception.Message)" }

  Copy-Item -LiteralPath $settings -Destination "$settings.bak" -Force
  $before = ([regex]::Matches($raw, [regex]::Escape($OldName))).Count

  # Rewrite every path that names the WORKING DIRECTORY -- both shapes are in this file: JSON-escaped
  # Windows (`C:\\project\\...`, and `C:\\\\project\\\\...` inside the PowerShell entries) and Git-Bash
  # (`/c/project/...`). One occurrence is deliberately EXEMPT: `C--project-miniserver-platform` is the name
  # of the Claude Code transcript store that already exists on disk and holds this machine's session
  # history. It is not derived from the folder name going forward and renaming it here would point at
  # nothing. (usage-census.mjs still finds that store after the rename -- it matches `-miniserver-platform`
  # as a historical suffix as well as the current one.)
  $raw = $raw -replace "(?<!C--project-)$([regex]::Escape($OldName))", $NewName

  try { $null = $raw | ConvertFrom-Json } catch { throw "the rewrite produced invalid JSON -- restored copy is at $settings.bak. Error: $($_.Exception.Message)" }
  # NOT Set-Content -Encoding utf8: on PowerShell 5.1 that writes a BOM, and every tool in this platform
  # parses this file with Node, whose JSON.parse rejects a leading BOM outright. Rehearsing this script on a
  # copy produced exactly that -- the repair step silently made settings.local.json unreadable, which is the
  # same failure it exists to prevent. Write UTF-8 with NO BOM, byte-for-byte.
  [System.IO.File]::WriteAllText($settings, $raw, (New-Object System.Text.UTF8Encoding($false)))
  $now = Get-Content -LiteralPath $settings -Raw
  $after  = ([regex]::Matches($now, [regex]::Escape($OldName))).Count
  $exempt = ([regex]::Matches($now, "C--project-$([regex]::Escape($OldName))")).Count
  Write-Host "   rewrote $($before - $after) of $before occurrence(s); $after left, of which $exempt are the exempt transcript-store path. Backup: $settings.bak"
  if ($after -ne $exempt) { Write-Warning "   $($after - $exempt) unexpected occurrence(s) survived -- inspect them by hand." }

  # ConvertFrom-Json above is not enough: it tolerates a BOM that Node does not, and Node is what actually
  # reads this file. Assert with the parser that matters.
  $probe = node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).autoMemoryDirectory && console.log('node-readable')" $settings 2>&1
  if ($probe -notmatch 'node-readable') {
    Copy-Item -LiteralPath "$settings.bak" -Destination $settings -Force
    throw "Node cannot read the rewritten settings.local.json (output: $probe). RESTORED from the .bak -- nothing was left broken."
  }
  Write-Host "   node can read it back: $probe"
}

Write-Host "== step 3/3: verify, do not assume ==" -ForegroundColor Cyan
Push-Location $new
try {
  Write-Host "   git remote:"; git remote -v
  Write-Host "   memory wiring:"
  node .claude\scripts\memory-audit.mjs | Select-String -Pattern 'autoMemoryDirectory|UNSET|memories,' | ForEach-Object { "     $_" }
} finally { Pop-Location }

Write-Host ""
Write-Host "ALREADY DONE, so do not redo it (verified 2026-07-30):" -ForegroundColor Yellow
Write-Host "  The GitHub repo was renamed to 'thiengthb/fleet' on 2026-07-29 and this clone's origin already"
Write-Host "  points at it. The old URL only redirects, which is why a stale clone keeps working and nobody"
Write-Host "  notices. If a clone on another machine still shows the old URL:"
Write-Host "    git remote set-url origin https://github.com/thiengthb/fleet.git"
Write-Host "  Check, do not assume:  gh repo view thiengthb/miniserver-platform --json name   # -> fleet"
Write-Host ""
Write-Host "The memory tier reads settings at STARTUP, so start a new session for it to take effect." -ForegroundColor Yellow
