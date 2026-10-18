<#
.SYNOPSIS
  Creates a new game from the dg-template (npm run create), adds a desktop
  shortcut for it, and drops you into a Claude Code session in the new folder.

.DESCRIPTION
  With no parameters it asks for the name and the look (2D, 3D or no canvas).
  With -Name it asks nothing, so an agent can run it:

    tools\New-Game.ps1 -Name "Word Pop" -Renderer none -NoOnline -NoTurns -NoWorld -NoShortcut -NoLaunch

  The folder (the slug) is the name in lowercase with dashes: pick the final
  name first, it is also the repo and the URL. The copy is the template's last
  commit (HEAD); uncommitted changes in dg-template are not copied. It first pulls the latest
  dg-template (fast-forward only; offline or diverged just warns).
#>
param(
    [string]$Name,
    [ValidateSet('pixi', 'three', 'none')][string]$Renderer,
    [switch]$NoDaily,
    [switch]$NoRace,
    [switch]$NoOnline,
    [switch]$NoTurns,
    [switch]$NoWorld,
    [switch]$NoAvatar,
    [switch]$NoShortcut,
    [switch]$NoLaunch
)

$ErrorActionPreference = 'Stop'

$templateRoot = Split-Path -Parent $PSScriptRoot          # .../dg-template
$gitHubRoot   = Split-Path -Parent $templateRoot          # .../Documents/GitHub

# The slug: lowercase a-z, 0-9 and dashes (the folder, the repo, the URL).
function Get-Slug([string]$display) {
    $slug = ($display.ToLower() -replace '[^a-z0-9]+', '-').Trim('-')
    return $slug
}

function Read-NewGameName {
    while ($true) {
        $name = (Read-Host "`nWhat's the name of your new game?").Trim()
        if ([string]::IsNullOrWhiteSpace($name)) {
            Write-Host "Please type a name." -ForegroundColor Yellow
            continue
        }
        $slug = Get-Slug $name
        if ([string]::IsNullOrWhiteSpace($slug)) {
            Write-Host "That name has no letters or digits to make a folder from - try something else." -ForegroundColor Yellow
            continue
        }
        if (Test-Path (Join-Path $gitHubRoot $slug)) {
            Write-Host "A folder called '$slug' already exists in Documents\GitHub. Pick another name." -ForegroundColor Yellow
            continue
        }
        return $name
    }
}

function Read-Renderer {
    Write-Host "`nHow does it look?"
    Write-Host "  1) 2D (PixiJS)  - most games"
    Write-Host "  2) 3D (three.js)"
    Write-Host "  3) No canvas    - cards, words, menus (plain HTML)"
    while ($true) {
        switch ((Read-Host "Pick 1, 2 or 3 [1]").Trim()) {
            ''  { return 'pixi' }
            '1' { return 'pixi' }
            '2' { return 'three' }
            '3' { return 'none' }
            default { Write-Host "Please type 1, 2 or 3." -ForegroundColor Yellow }
        }
    }
}

if (-not $Name) {
    Write-Host "=== New diffenderfer.games project ===" -ForegroundColor Cyan
    $Name = Read-NewGameName
    if (-not $Renderer) { $Renderer = Read-Renderer }
}
if (-not $Renderer) { $Renderer = 'pixi' }
$slug = Get-Slug $Name
if ([string]::IsNullOrWhiteSpace($slug)) { throw "'$Name' has no letters or digits to make a folder from" }
$path = Join-Path $gitHubRoot $slug

$createArgs = @($slug, '--title', $Name, '--renderer', $Renderer)
if ($NoDaily)  { $createArgs += '--no-daily' }
if ($NoRace)   { $createArgs += '--no-race' }
if ($NoOnline) { $createArgs += '--no-online' }
if ($NoTurns)  { $createArgs += '--no-turns' }
if ($NoWorld)  { $createArgs += '--no-world' }
if ($NoAvatar) { $createArgs += '--no-avatar' }

Push-Location $templateRoot
try {
    npm run create -- @createArgs
    if ($LASTEXITCODE -ne 0) { throw "npm run create failed" }
} finally {
    Pop-Location
}

if (-not $NoShortcut) {
    & (Join-Path $PSScriptRoot 'New-ClaudeShortcut.ps1') -Path $path -Name $Name
    Write-Host "A desktop shortcut was created so you can jump back in any time." -ForegroundColor Green
}

Write-Host "`n'$Name' is ready at $path" -ForegroundColor Green
Write-Host "First deploy (the private repo, its secrets, the first push): npm run first-deploy" -ForegroundColor Green

if (-not $NoLaunch) {
    Write-Host "`nStarting Claude..." -ForegroundColor Cyan
    Set-Location $path
    claude
}
