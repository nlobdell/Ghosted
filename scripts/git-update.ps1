[CmdletBinding()]
param(
    [string]$Remote = "origin",
    [string]$MainBranch = "main",
    [switch]$Autostash,
    [switch]$Push
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Ensure-Elevated {
    if (Test-IsAdministrator) {
        return
    }

    Write-Host ""
    Write-Host "Requesting Administrator permissions for git update..." -ForegroundColor Yellow

    $argumentList = @(
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        $PSCommandPath,
        "-Remote",
        $Remote,
        "-MainBranch",
        $MainBranch
    )

    if ($Autostash) {
        $argumentList += "-Autostash"
    }

    if ($Push) {
        $argumentList += "-Push"
    }

    $process = Start-Process -FilePath "powershell.exe" -Verb RunAs -ArgumentList $argumentList -Wait -PassThru
    exit $process.ExitCode
}

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    Write-Host ""
    Write-Host ("> git " + ($Arguments -join " ")) -ForegroundColor Cyan
    & git @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
    }
}

function Get-GitOutput {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $output = & git @Arguments 2>&1

    if ($LASTEXITCODE -ne 0) {
        throw (($output | Out-String).Trim())
    }

    return @($output)
}

function Test-DirtyWorktree {
    $status = Get-GitOutput -Arguments @("status", "--porcelain")
    return $status.Count -gt 0
}

Ensure-Elevated

Invoke-Git -Arguments @("rev-parse", "--is-inside-work-tree")

$currentBranch = ((Get-GitOutput -Arguments @("branch", "--show-current")) | Select-Object -First 1).Trim()

if (-not $currentBranch) {
    throw "Detached HEAD is not supported by this script. Switch to a branch and try again."
}

$isDirty = Test-DirtyWorktree
$createdStash = $false
$stashName = "git-update " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
$completed = $false

if ($isDirty -and -not $Autostash) {
    throw "Uncommitted changes detected on '$currentBranch'. Commit or stash them first, or rerun with -Autostash."
}

try {
    if ($isDirty -and $Autostash) {
        Write-Host ""
        Write-Host "Stashing local changes before updating..." -ForegroundColor Yellow

        $stashCountBefore = (Get-GitOutput -Arguments @("stash", "list")).Count
        Invoke-Git -Arguments @("stash", "push", "--include-untracked", "-m", $stashName)
        $stashCountAfter = (Get-GitOutput -Arguments @("stash", "list")).Count
        $createdStash = $stashCountAfter -gt $stashCountBefore
    }

    Write-Host ""
    Write-Host "Fetching $Remote/$MainBranch..." -ForegroundColor Green
    Invoke-Git -Arguments @("fetch", $Remote, $MainBranch)

    if ($currentBranch -eq $MainBranch) {
        Write-Host ""
        Write-Host "Updating $MainBranch with a fast-forward pull..." -ForegroundColor Green
        Invoke-Git -Arguments @("pull", "--ff-only", $Remote, $MainBranch)
    }
    else {
        Write-Host ""
        Write-Host "Rebasing $currentBranch onto $Remote/$MainBranch..." -ForegroundColor Green
        Invoke-Git -Arguments @("rebase", "$Remote/$MainBranch")

        if ($Push) {
            Write-Host ""
            Write-Host "Pushing rebased branch with --force-with-lease..." -ForegroundColor Green
            Invoke-Git -Arguments @("push", "--force-with-lease", $Remote, $currentBranch)
        }
    }

    $completed = $true
}
finally {
    if ($createdStash -and $completed) {
        Write-Host ""
        Write-Host "Restoring stashed changes..." -ForegroundColor Yellow
        Invoke-Git -Arguments @("stash", "pop")
    }
    elseif ($createdStash) {
        Write-Warning "Your changes are still stashed because the update did not finish cleanly. Use 'git stash list' and 'git stash pop' after resolving the issue."
    }
}

Write-Host ""
Write-Host "Git update complete on '$currentBranch'." -ForegroundColor Green
