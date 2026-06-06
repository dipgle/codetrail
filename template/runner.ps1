# runner.ps1 — file-based command runner for Claude (allowlist-gated).
#
# Windows PowerShell port of runner.sh. Same semantics, same on-disk
# contract (.cmd-queue/ → .cmd-results/), same audit log. Pick whichever
# matches your platform; do NOT run both at once against the same project
# (they'd race for queue files).
#
# WHY THIS EXISTS
#   Claude Code's sandbox (or a CI/remote agent runtime) may not let the
#   assistant execute shell commands directly. This script offers a host-side
#   escape hatch: Claude drops a `.cmd` file into .cmd-queue\, this daemon
#   picks it up, validates against an allowlist, executes, and writes the
#   captured stdout/stderr to .cmd-results\<id>.log for Claude to read back.
#
# USAGE
#   pwsh -File runner.ps1                  # foreground watch (Ctrl+C to stop)
#   pwsh -File runner.ps1 start            # spawn daemon in background (idempotent)
#   pwsh -File runner.ps1 stop             # kill the daemon if running
#   pwsh -File runner.ps1 status           # report running/stopped + PID
#   pwsh -File runner.ps1 exec "<cmd>"     # ensure-running, enqueue, wait, print
#
#   `exec` is the one-shot Claude-friendly form: auto-starts the daemon if
#   needed, drops the command, polls for the result file (default 30s timeout
#   via $env:RUNNER_EXEC_TIMEOUT), prints it, and returns the exit code.
#
# SECURITY
#   - Only commands matching $ALLOWLIST_EXACT (whole-line equality) or
#     $ALLOWLIST_PREFIX (prefix match) run. Anything else logs REJECTED.
#   - Edit the arrays below to add commands. Each addition widens the trust
#     boundary — review what the command could do with the daemon's privileges.
#   - The daemon runs in this script's directory.
#   - Audit trail: every receipt/exec/reject appended to .cmd-results\audit.log.
#
# REQUIREMENTS
#   PowerShell 5.1 (ships with Windows 10/11) or PowerShell 7+ (`pwsh`).

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('start', 'stop', 'status', 'exec', '')]
    [string]$Subcommand = '',

    [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
    [string[]]$ExecArgs
)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

# Commands allowed by whole-line exact match. Add yours below.
$ALLOWLIST_EXACT = @(
    # === Example entries (uncomment / replace with your project's commands) ===
    # 'npm test'
    # 'npm run build'
    # 'npx tsc --noEmit'
    # 'cargo build'
    # 'cargo test'
    # 'pytest -q'
)

# Commands allowed by prefix match. Useful for read-only utilities + tools
# whose argument list is variable.
$ALLOWLIST_PREFIX = @(
    # === Example entries ===
    # 'tail '
    # 'Get-Content '
    # 'Select-String '
    # 'Get-ChildItem '
    # 'curl -sS http://localhost:'
)

$QUEUE_DIR   = '.cmd-queue'
$RESULT_DIR  = '.cmd-results'
$PID_FILE    = Join-Path $RESULT_DIR 'runner.pid'
$DAEMON_LOG  = Join-Path $RESULT_DIR 'daemon.log'
$AUDIT       = Join-Path $RESULT_DIR 'audit.log'

if (-not (Test-Path $QUEUE_DIR))  { New-Item -ItemType Directory -Path $QUEUE_DIR  | Out-Null }
if (-not (Test-Path $RESULT_DIR)) { New-Item -ItemType Directory -Path $RESULT_DIR | Out-Null }

function Test-Allowed {
    param([string]$Cmd)
    foreach ($a in $ALLOWLIST_EXACT) {
        if ($Cmd -eq $a) { return $true }
    }
    foreach ($p in $ALLOWLIST_PREFIX) {
        if ($Cmd.StartsWith($p)) { return $true }
    }
    return $false
}

function Invoke-One {
    param([string]$CmdFile)
    $id          = [System.IO.Path]::GetFileNameWithoutExtension($CmdFile)
    $cmd         = (Get-Content -Path $CmdFile -TotalCount 1 -Encoding UTF8)
    $result_file = Join-Path $RESULT_DIR "$id.log"
    $stamp       = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

    $line = "[$stamp] received: $cmd (id=$id)"
    Write-Host $line
    Add-Content -Path $AUDIT -Value $line -Encoding UTF8

    if (-not (Test-Allowed $cmd)) {
        @(
            "=== id=$id @ $stamp ==="
            "`$ $cmd"
            'REJECTED: command not in allowlist'
            'exit: 126'
        ) | Set-Content -Path $result_file -Encoding UTF8
        $rline = "[$stamp] REJECTED: $cmd"
        Write-Host $rline
        Add-Content -Path $AUDIT -Value $rline -Encoding UTF8
        Remove-Item -Path $CmdFile
        return
    }

    @(
        "=== id=$id @ $stamp ==="
        "`$ $cmd"
        '---'
    ) | Set-Content -Path $result_file -Encoding UTF8

    # Execute via shell so the user's command string parses with full shell
    # semantics (pipes, redirects, quoting) just like the bash runner does.
    # On Windows use cmd.exe /c; elsewhere /bin/sh -c. The shell redirect
    # `>> file 2>&1` appends both streams to the result file directly, so
    # no temp files needed.
    if ($IsWindows -or ($PSVersionTable.PSEdition -eq 'Desktop')) {
        & cmd.exe /c "$cmd >> `"$result_file`" 2>&1"
    } else {
        & /bin/sh -c "$cmd >> `"$result_file`" 2>&1"
    }
    $rc = $LASTEXITCODE

    @('---', "exit: $rc") | Add-Content -Path $result_file -Encoding UTF8

    $dline = "[$stamp] done id=$id exit=$rc"
    Write-Host $dline
    Add-Content -Path $AUDIT -Value $dline -Encoding UTF8
    Remove-Item -Path $CmdFile
}

function Start-WatchLoop {
    Write-Host "runner.ps1 watching $QUEUE_DIR\  (PID $PID)"
    Write-Host "    EXACT allowlist:  $($ALLOWLIST_EXACT.Count) commands"
    Write-Host "    PREFIX allowlist: $($ALLOWLIST_PREFIX.Count) patterns"
    Write-Host "    Audit log:        $AUDIT"

    while ($true) {
        Get-ChildItem -Path $QUEUE_DIR -Filter '*.cmd' -ErrorAction SilentlyContinue |
            ForEach-Object { Invoke-One -CmdFile $_.FullName }
        Start-Sleep -Seconds 1
    }
}

# Return $true if daemon alive (PID file exists + process running). Cleans
# stale PID file as a side effect.
function Test-Running {
    if (-not (Test-Path $PID_FILE)) { return $false }
    $rawPid = (Get-Content -Path $PID_FILE -ErrorAction SilentlyContinue | Select-Object -First 1)
    if (-not $rawPid) { Remove-Item -Path $PID_FILE -ErrorAction SilentlyContinue; return $false }
    $proc = Get-Process -Id $rawPid -ErrorAction SilentlyContinue
    if (-not $proc) { Remove-Item -Path $PID_FILE -ErrorAction SilentlyContinue; return $false }
    return $true
}

function Invoke-Start {
    if (Test-Running) {
        Write-Host "runner: already running (PID $(Get-Content $PID_FILE))"
        return
    }
    # Find the PowerShell that's running us (pwsh on PS7+, powershell.exe on PS5.1).
    $psExe = (Get-Process -Id $PID).Path
    if (-not $psExe) { $psExe = 'pwsh' }

    # Start-Process flags vary by edition:
    #   - Windows (PS Desktop 5.1 + PS Core 7 on Windows): supports -WindowStyle
    #     Hidden so the daemon doesn't flash a console window.
    #   - macOS / Linux PS Core: does NOT support -WindowStyle (errors loudly).
    # Splat platform-appropriate flags so the same script smokes on both.
    $spawn = @{
        FilePath               = $psExe
        ArgumentList           = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath)
        RedirectStandardOutput = $DAEMON_LOG
        RedirectStandardError  = "$DAEMON_LOG.err"
        PassThru               = $true
    }
    $onWindows = ($PSVersionTable.PSEdition -eq 'Desktop') -or
                 ((Get-Variable -Name 'IsWindows' -ErrorAction SilentlyContinue) -and $IsWindows)
    if ($onWindows) {
        $spawn.WindowStyle = 'Hidden'
    }

    $proc = Start-Process @spawn
    Set-Content -Path $PID_FILE -Value $proc.Id -Encoding UTF8
    Start-Sleep -Milliseconds 400
    if (Get-Process -Id $proc.Id -ErrorAction SilentlyContinue) {
        Write-Host "runner: started (PID $($proc.Id), log $DAEMON_LOG)"
    } else {
        Remove-Item -Path $PID_FILE -ErrorAction SilentlyContinue
        Write-Host "runner: failed to start — check $DAEMON_LOG"
        exit 1
    }
}

function Invoke-Stop {
    if (-not (Test-Running)) {
        Write-Host 'runner: not running'
        return
    }
    $rawPid = (Get-Content -Path $PID_FILE | Select-Object -First 1)
    try { Stop-Process -Id $rawPid -ErrorAction SilentlyContinue } catch {}
    $waited = 0
    while ((Get-Process -Id $rawPid -ErrorAction SilentlyContinue) -and $waited -lt 20) {
        Start-Sleep -Milliseconds 100
        $waited++
    }
    if (Get-Process -Id $rawPid -ErrorAction SilentlyContinue) {
        Stop-Process -Id $rawPid -Force -ErrorAction SilentlyContinue
    }
    Remove-Item -Path $PID_FILE -ErrorAction SilentlyContinue
    Write-Host "runner: stopped (was PID $rawPid)"
}

function Invoke-Status {
    if (Test-Running) {
        Write-Host "runner: RUNNING (PID $(Get-Content $PID_FILE))"
        Write-Host "    queue:  $QUEUE_DIR\"
        Write-Host "    audit:  $AUDIT"
        exit 0
    }
    Write-Host 'runner: stopped'
    exit 1
}

function Invoke-Exec {
    param([string]$Cmd)
    if (-not $Cmd) {
        Write-Error 'usage: runner.ps1 exec "<command>"'
        exit 2
    }
    if (-not (Test-Running)) { Invoke-Start | Out-Null }
    if (-not (Test-Running)) {
        Write-Error 'runner: cannot start daemon'
        exit 1
    }

    $id          = "exec-$([DateTimeOffset]::Now.ToUnixTimeSeconds())-$PID"
    $result_file = Join-Path $RESULT_DIR "$id.log"
    $queue_file  = Join-Path $QUEUE_DIR "$id.cmd"
    Set-Content -Path $queue_file -Value $Cmd -Encoding UTF8

    # Poll for the trailer line `exit: <N>` rather than mere file existence —
    # the daemon writes header, then shell output, then trailer in 3 steps,
    # so file-existence is true long before the result is complete.
    $timeoutSec = if ($env:RUNNER_EXEC_TIMEOUT) { [int]$env:RUNNER_EXEC_TIMEOUT } else { 30 }
    $waited     = 0
    $complete   = $false
    while ($waited -lt ($timeoutSec * 10)) {
        if (Test-Path $result_file) {
            $tail = Get-Content -Path $result_file -Tail 1 -ErrorAction SilentlyContinue
            if ($tail -match '^exit: (-?\d+)') { $complete = $true; break }
        }
        Start-Sleep -Milliseconds 100
        $waited++
    }

    if (-not $complete) {
        Write-Error "runner: timeout after ${timeoutSec}s waiting for $id"
        exit 124
    }

    $content = Get-Content -Path $result_file
    $content | ForEach-Object { Write-Host $_ }

    $last = $content | Select-Object -Last 1
    if ($last -match '^exit: (-?\d+)') {
        exit [int]$Matches[1]
    }
    exit 0
}

switch ($Subcommand) {
    'start'  { Invoke-Start }
    'stop'   { Invoke-Stop }
    'status' { Invoke-Status }
    'exec'   { Invoke-Exec -Cmd ($ExecArgs -join ' ') }
    default  { Start-WatchLoop }
}
