[CmdletBinding()]
param(
    [ValidateSet("start", "stop", "restart", "status", "logs")]
    [string]$Action = "start"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$RuntimeDir = Join-Path $RepoRoot "data\dev-runtime"
$NextScript = Join-Path $RepoRoot "node_modules\next\dist\bin\next"

$Services = @(
    @{
        Name = "api"
        Label = "Python API"
        Command = "python"
        Arguments = @("server.py")
        Url = "http://localhost:8000"
    },
    @{
        Name = "web"
        Label = "Next.js"
        Command = "node"
        Arguments = @($NextScript, "dev")
        Url = "http://localhost:3000"
    }
)

function Ensure-RuntimeDir {
    if (-not (Test-Path -LiteralPath $RuntimeDir)) {
        New-Item -ItemType Directory -Path $RuntimeDir | Out-Null
    }
}

function Get-PidFile {
    param([hashtable]$Service)

    return Join-Path $RuntimeDir "$($Service.Name).pid"
}

function Get-OutLog {
    param([hashtable]$Service)

    return Join-Path $RuntimeDir "$($Service.Name).out.log"
}

function Get-ErrLog {
    param([hashtable]$Service)

    return Join-Path $RuntimeDir "$($Service.Name).err.log"
}

function Test-CommandReady {
    param([hashtable]$Service)

    if ($Service.Name -eq "web") {
        if (-not (Test-Path -LiteralPath $NextScript)) {
            throw "Next.js script not found at '$NextScript'. Run 'npm install' first."
        }
        $null = Get-Command $Service.Command -ErrorAction Stop
    }

    if ($Service.Name -eq "api") {
        $null = Get-Command $Service.Command -ErrorAction Stop
    }
}

function Get-RunningProcess {
    param([hashtable]$Service)

    $pidFile = Get-PidFile $Service
    if (-not (Test-Path -LiteralPath $pidFile)) {
        return $null
    }

    $pidText = (Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    $pidValue = 0
    if (-not [int]::TryParse($pidText, [ref]$pidValue)) {
        Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
        return $null
    }

    $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
    if (-not $process) {
        Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
        return $null
    }

    return $process
}

function Start-ServiceProcess {
    param([hashtable]$Service)

    $existing = Get-RunningProcess $Service
    if ($existing) {
        Write-Host "$($Service.Label) already running (PID $($existing.Id))." -ForegroundColor Yellow
        return
    }

    Test-CommandReady $Service

    $outLog = Get-OutLog $Service
    $errLog = Get-ErrLog $Service
    $pidFile = Get-PidFile $Service

    if (Test-Path -LiteralPath $outLog) {
        Remove-Item -LiteralPath $outLog -Force
    }

    if (Test-Path -LiteralPath $errLog) {
        Remove-Item -LiteralPath $errLog -Force
    }

    $process = Start-Process `
        -FilePath $Service.Command `
        -ArgumentList $Service.Arguments `
        -WorkingDirectory $RepoRoot `
        -RedirectStandardOutput $outLog `
        -RedirectStandardError $errLog `
        -WindowStyle Hidden `
        -PassThru

    Set-Content -LiteralPath $pidFile -Value $process.Id
    Write-Host "Started $($Service.Label) (PID $($process.Id)) -> $($Service.Url)" -ForegroundColor Green
}

function Stop-ServiceProcess {
    param([hashtable]$Service)

    $process = Get-RunningProcess $Service
    $pidFile = Get-PidFile $Service
    if (-not $process) {
        Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
        Write-Host "$($Service.Label) is not running." -ForegroundColor DarkYellow
        return
    }

    Stop-Process -Id $process.Id -Force
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    Write-Host "Stopped $($Service.Label) (PID $($process.Id))." -ForegroundColor Green
}

function Show-Status {
    foreach ($service in $Services) {
        $process = Get-RunningProcess $service
        if ($process) {
            Write-Host "$($service.Label): running (PID $($process.Id)) -> $($service.Url)" -ForegroundColor Green
        }
        else {
            Write-Host "$($service.Label): stopped" -ForegroundColor DarkYellow
        }
    }
}

function Show-Logs {
    $files = @()
    foreach ($service in $Services) {
        $outLog = Get-OutLog $service
        $errLog = Get-ErrLog $service

        if (-not (Test-Path -LiteralPath $outLog)) {
            New-Item -ItemType File -Path $outLog | Out-Null
        }

        if (-not (Test-Path -LiteralPath $errLog)) {
            New-Item -ItemType File -Path $errLog | Out-Null
        }

        $files += $outLog
        $files += $errLog
    }

    Write-Host "Streaming logs from $RuntimeDir" -ForegroundColor Cyan
    Get-Content -Path $files -Tail 40 -Wait
}

Ensure-RuntimeDir

switch ($Action) {
    "start" {
        foreach ($service in $Services) {
            Start-ServiceProcess $service
        }
        Show-Status
    }
    "stop" {
        foreach ($service in $Services) {
            Stop-ServiceProcess $service
        }
    }
    "restart" {
        foreach ($service in $Services) {
            Stop-ServiceProcess $service
        }
        foreach ($service in $Services) {
            Start-ServiceProcess $service
        }
        Show-Status
    }
    "status" {
        Show-Status
    }
    "logs" {
        Show-Logs
    }
}
