#requires -Version 5.1
<#
  Registers the MiniServer auto-pilot self-run as a per-user, logged-on-only scheduled task.
  Runs under the CURRENT user with -RunLevel Limited => NO admin/elevation needed (the earlier
  0x80070005 was an escaping bug in a nested command, not a real elevation wall). Idempotent:
  unregisters any prior task of the same name first. Reversible: Unregister-ScheduledTask.
  Config: at-logon + repeat every 4h while logged on; "run only when user is logged on" so the
  task inherits the DPAPI-protected ~/.claude auth (Session 0 would fail silently).
#>
param(
  [string] $TaskName = 'MiniServer-AutoPilot',
  [int]    $RepeatHours = 4,
  # The user the task RUNS AS (the logged-on user whose DPAPI creds the worker needs). Pinned to the real
  # logged-on user, NOT GetCurrent(): under UAC the elevating shell may carry a different admin identity.
  [string] $RunAsUser = 'TNT-LAPTOP\trann'
)
$ErrorActionPreference = 'Stop'

$repo   = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
$script = Join-Path $repo '.claude\scripts\auto-pilot-scheduled.ps1'
if (-not (Test-Path -LiteralPath $script)) { throw "wrapper not installed: $script" }

$me = $RunAsUser

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
            -Argument ("-NoProfile -ExecutionPolicy Bypass -File `"{0}`"" -f $script) -WorkingDirectory $repo

$trigger = New-ScheduledTaskTrigger -AtLogOn
$rep     = New-ScheduledTaskTrigger -Once -At (Get-Date) `
             -RepetitionInterval (New-TimeSpan -Hours $RepeatHours) -RepetitionDuration (New-TimeSpan -Days 3650)
$trigger.Repetition = $rep.Repetition

$principal = New-ScheduledTaskPrincipal -UserId $me -LogonType Interactive -RunLevel Limited
$settings  = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew `
             -ExecutionTimeLimit (New-TimeSpan -Hours 2) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
  -Principal $principal -Settings $settings `
  -Description ("MiniServer auto-pilot self-run (logged-on only); advances opted-in plans + once/day propose. user={0}" -f $me) | Out-Null

Write-Output ("REGISTERED: {0} (user={1}, repeat={2}h, at-logon)" -f $TaskName, $me, $RepeatHours)
