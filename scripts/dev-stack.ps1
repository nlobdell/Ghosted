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
$SceneRealtimeScript = Join-Path $RepoRoot "scripts\scene-realtime.ts"
$EnvFileNames = @(".env", ".env.development", ".env.local", ".env.development.local")
$Services = @(
    @{
        Name = "web"
        Label = "Next.js"
        Command = "node"
        Arguments = @($NextScript, "dev")
        Url = "http://localhost:3000"
        RequiredPath = $NextScript
    },
    @{
        Name = "scene-realtime"
        Label = "Scene Realtime"
        Command = "node"
        Arguments = @("--conditions=react-server", "--import", "tsx", $SceneRealtimeScript)
        Url = "ws://localhost:3001/ws/scene/presence"
        RequiredPath = $SceneRealtimeScript
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

function Normalize-EnvValue {
    param([string]$Value)

    $trimmed = $Value.Trim()
    if ($trimmed.Length -ge 2) {
        $first = $trimmed[0]
        $last = $trimmed[$trimmed.Length - 1]
        if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
            return $trimmed.Substring(1, $trimmed.Length - 2)
        }
    }

    $commentIndex = $trimmed.IndexOf(" #")
    if ($commentIndex -ge 0) {
        return $trimmed.Substring(0, $commentIndex).TrimEnd()
    }

    return $trimmed
}

function Import-LocalEnv {
    $loadedFiles = New-Object System.Collections.Generic.List[string]
    $parsed = @{}

    foreach ($fileName in $EnvFileNames) {
        $filePath = Join-Path $RepoRoot $fileName
        if (-not (Test-Path -LiteralPath $filePath)) {
            continue
        }

        $loadedFiles.Add($filePath)
        foreach ($line in Get-Content -LiteralPath $filePath) {
            if (-not $line) {
                continue
            }

            $match = [regex]::Match($line, '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$')
            if (-not $match.Success) {
                continue
            }

            $key = $match.Groups[1].Value
            $rawValue = $match.Groups[2].Value
            $parsed[$key] = Normalize-EnvValue $rawValue
        }
    }

    foreach ($entry in $parsed.GetEnumerator()) {
        $existing = [Environment]::GetEnvironmentVariable($entry.Key, "Process")
        if ([string]::IsNullOrWhiteSpace($existing)) {
            [Environment]::SetEnvironmentVariable($entry.Key, [string]$entry.Value, "Process")
        }
    }

    return [PSCustomObject]@{
        LoadedFiles = @($loadedFiles)
        Values = $parsed
    }
}

function Get-EnvValue {
    param(
        [PSCustomObject]$EnvState,
        [string]$Key
    )

    $processValue = [Environment]::GetEnvironmentVariable($Key, "Process")
    if (-not [string]::IsNullOrWhiteSpace($processValue)) {
        return $processValue.Trim()
    }

    if ($EnvState -and $EnvState.Values.ContainsKey($Key)) {
        $value = [string]$EnvState.Values[$Key]
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            return $value.Trim()
        }
    }

    return $null
}

function Get-EnvFlag {
    param(
        [PSCustomObject]$EnvState,
        [string]$Key
    )

    $value = Get-EnvValue $EnvState $Key
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $false
    }

    return @("1", "true", "yes", "on") -contains $value.ToLowerInvariant()
}

function Show-SetupNotes {
    param([PSCustomObject]$EnvState)

    if ($EnvState.LoadedFiles.Count -gt 0) {
        $relativeFiles = $EnvState.LoadedFiles | ForEach-Object {
            Resolve-Path -LiteralPath $_ -Relative
        }
        Write-Host ("Loaded env files: " + ($relativeFiles -join ", ")) -ForegroundColor Cyan
    }
    else {
        Write-Host "No .env*, .env.local, or .env.development* file found. Using current shell environment only." -ForegroundColor DarkYellow
    }

    $devAuthEnabled = Get-EnvFlag $EnvState "ENABLE_DEV_AUTH"
    $discordClientId = Get-EnvValue $EnvState "DISCORD_CLIENT_ID"
    $discordClientSecret = Get-EnvValue $EnvState "DISCORD_CLIENT_SECRET"
    $discordOauthReady = -not [string]::IsNullOrWhiteSpace($discordClientId) -and -not [string]::IsNullOrWhiteSpace($discordClientSecret)
    $discordGuildId = Get-EnvValue $EnvState "DISCORD_GUILD_ID"
    $discordBotToken = Get-EnvValue $EnvState "DISCORD_BOT_TOKEN"
    $guildSyncReady = -not [string]::IsNullOrWhiteSpace($discordGuildId) -and -not [string]::IsNullOrWhiteSpace($discordBotToken)
    $womGroupId = Get-EnvValue $EnvState "WOM_GROUP_ID"
    $databasePath = Get-EnvValue $EnvState "DATABASE_PATH"
    $companionAssetDir = Get-EnvValue $EnvState "COMPANION_ASSET_DIR"
    $authSecret = Get-EnvValue $EnvState "AUTH_SECRET"

    if (-not $devAuthEnabled -and -not $discordOauthReady) {
        Write-Host "Setup warning: no local sign-in path is configured. Set ENABLE_DEV_AUTH=true for dev login, or set both DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET for Discord OAuth." -ForegroundColor Yellow
    }
    elseif (-not $devAuthEnabled) {
        Write-Host "Setup note: development auth is disabled, so /auth/dev-login will return 404 until ENABLE_DEV_AUTH=true." -ForegroundColor DarkYellow
    }

    if ((-not [string]::IsNullOrWhiteSpace($discordClientId) -and [string]::IsNullOrWhiteSpace($discordClientSecret)) -or
        ([string]::IsNullOrWhiteSpace($discordClientId) -and -not [string]::IsNullOrWhiteSpace($discordClientSecret))) {
        Write-Host "Setup warning: Discord OAuth is partially configured. Set both DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET." -ForegroundColor Yellow
    }

    if ((-not [string]::IsNullOrWhiteSpace($discordGuildId) -and [string]::IsNullOrWhiteSpace($discordBotToken)) -or
        ([string]::IsNullOrWhiteSpace($discordGuildId) -and -not [string]::IsNullOrWhiteSpace($discordBotToken))) {
        Write-Host "Setup warning: Discord guild sync is partially configured. Set both DISCORD_GUILD_ID and DISCORD_BOT_TOKEN for live role lookups." -ForegroundColor Yellow
    }
    elseif (-not $guildSyncReady) {
        Write-Host "Setup note: Discord guild sync is disabled locally, so live role metadata will fall back to configured labels only." -ForegroundColor DarkYellow
    }

    if ([string]::IsNullOrWhiteSpace($womGroupId)) {
        Write-Host "Setup note: WOM clan features are disabled locally until WOM_GROUP_ID is set." -ForegroundColor DarkYellow
    }

    if ([string]::IsNullOrWhiteSpace($databasePath)) {
        Write-Host ("Setup note: DATABASE_PATH is unset, so SQLite will default to " + (Join-Path $RepoRoot "data\\ghosted.db")) -ForegroundColor DarkYellow
    }

    if ([string]::IsNullOrWhiteSpace($companionAssetDir)) {
        Write-Host "Setup note: COMPANION_ASSET_DIR is unset, so companion uploads will live beside the database path." -ForegroundColor DarkYellow
    }

    if ($discordOauthReady -and [string]::IsNullOrWhiteSpace($authSecret)) {
        Write-Host "Setup note: AUTH_SECRET is unset. Local development will use the built-in fallback secret; set AUTH_SECRET to mirror production session signing." -ForegroundColor DarkYellow
    }
}

function Test-CommandReady {
    param([hashtable]$Service)

    if (-not (Test-Path -LiteralPath $Service.RequiredPath)) {
        throw "$($Service.Label) runtime not found at '$($Service.RequiredPath)'. Run 'npm install' first."
    }

    $null = Get-Command $Service.Command -ErrorAction Stop
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
    param(
        [hashtable]$Service,
        [PSCustomObject]$EnvState
    )

    $existing = Get-RunningProcess $Service
    if ($existing) {
        Write-Host "$($Service.Label) already running (PID $($existing.Id)). Restart to pick up env changes." -ForegroundColor Yellow
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
        $files += (Get-OutLog $service)
        $files += (Get-ErrLog $service)
    }

    foreach ($file in $files) {
        if (-not (Test-Path -LiteralPath $file)) {
            New-Item -ItemType File -Path $file | Out-Null
        }
    }

    Write-Host "Streaming logs from $RuntimeDir" -ForegroundColor Cyan
    Get-Content -Path $files -Tail 40 -Wait
}

Ensure-RuntimeDir
$EnvState = Import-LocalEnv

switch ($Action) {
    "start" {
        Show-SetupNotes $EnvState
        foreach ($service in $Services) {
            Start-ServiceProcess $service $EnvState
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
        Show-SetupNotes $EnvState
        foreach ($service in $Services) {
            Start-ServiceProcess $service $EnvState
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
