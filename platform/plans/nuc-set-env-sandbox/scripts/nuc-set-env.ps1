#requires -Version 5.1
<#
  nuc-set-env.ps1 - push a LOCAL key mirror file into a NUC app's .env over SSH, securely.
  Secrets travel keyboard -> local file -> ssh STDIN -> NUC; never on a command line, never through the agent chat.
  Idempotent upsert (existing key replaced, new key appended, others untouched) + auto force-recreate. Skill: /nuc-set-env.

  Usage:   ./nuc-set-env.ps1 <app> [-NoRestart] [-NucHost thien25@thienminiserver] [-EnvDir <dir>]
  Mirror:  <EnvDir>/<app>.env   (default ~/.nuc-env/<app>.env) - you maintain it; it stays on THIS machine, uncommitted.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)] [string] $App,
  [switch] $NoRestart,
  [string] $NucHost = 'thien25@thienminiserver',
  [string] $EnvDir = (Join-Path $HOME '.nuc-env')
)
$ErrorActionPreference = 'Stop'

if ($App -notmatch '^[a-z0-9][a-z0-9-]*$') { Write-Error "Invalid app name: '$App'"; exit 1 }

$local = Join-Path $EnvDir "$App.env"
if (-not (Test-Path -LiteralPath $local)) {
  Write-Host "No mirror file: $local" -ForegroundColor Yellow
  Write-Host "Create it (KEY=VALUE lines, one per line) then re-run, e.g.:" -ForegroundColor Yellow
  Write-Host "  New-Item -ItemType Directory -Force '$EnvDir' | Out-Null; notepad '$local'"
  exit 1
}

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$remoteScript = Join-Path $here 'nuc-set-env-remote.sh'
if (-not (Test-Path -LiteralPath $remoteScript)) { Write-Error "Missing $remoteScript (install it next to this script)"; exit 1 }

# Local sanity - read key NAMES only, never echo values.
$kv = Get-Content -LiteralPath $local | Where-Object { $_ -match '^\s*[A-Za-z_][A-Za-z0-9_]*\s*=' }
if (@($kv).Count -eq 0) { Write-Error "No KEY=VALUE lines in $local"; exit 1 }
$names = $kv | ForEach-Object { (($_ -split '=', 2)[0]).Trim() }
Write-Host "[nuc-set-env] $(@($names).Count) key(s) -> ${NucHost}:/opt/apps/$App/.env" -ForegroundColor Cyan
Write-Host ("[nuc-set-env] keys: " + ($names -join ', '))

# base64 the remote script (non-secret) so its quoting survives ssh; FORCE LF so bash on the NUC doesn't see CR.
$scriptText = (Get-Content -Raw -LiteralPath $remoteScript) -replace "`r`n", "`n" -replace "`r", "`n"
$scriptB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($scriptText))
$restart = if ($NoRestart) { 'NUC_RESTART=0' } else { 'NUC_RESTART=1' }
# Remote one-liner: materialize the script to a temp file, run it with the app arg; the SNIPPET is ssh STDIN.
$sshCmd = "f=`$(mktemp) && echo $scriptB64 | base64 -d > `$f && $restart bash `$f $App; rc=`$?; rm -f `$f; exit `$rc"

# Pipe the mirror file as STDIN in UTF-8 without BOM (a BOM would corrupt the first key for awk on the NUC).
$prevOut = [Console]::OutputEncoding
try {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [Console]::OutputEncoding = $utf8NoBom
  $OutputEncoding = $utf8NoBom
  Get-Content -Raw -LiteralPath $local | & ssh $NucHost $sshCmd
} finally {
  [Console]::OutputEncoding = $prevOut
}
if ($LASTEXITCODE -ne 0) { Write-Error "[nuc-set-env] remote merge failed (exit $LASTEXITCODE)"; exit $LASTEXITCODE }
Write-Host "[nuc-set-env] done - env applied$(if (-not $NoRestart) { ' + container recreated' })." -ForegroundColor Green
