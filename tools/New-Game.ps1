<#
.SYNOPSIS
  Asks for a new game's name and look (2D, 3D or no canvas), creates it from
  the dg-template (npm install + npm run new-game), adds a desktop shortcut
  for it, and drops you into a Claude Code session in the new folder.
#>

$ErrorActionPreference = 'Stop'

$templateRoot = Split-Path -Parent $PSScriptRoot          # .../dg-template
$gitHubRoot   = Split-Path -Parent $templateRoot          # .../Documents/GitHub

$reservedNames = @(
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
)

function Read-NewGameName {
    while ($true) {
        $name = Read-Host "`nWhat's the name of your new game?"
        $name = $name.Trim()
        if ([string]::IsNullOrWhiteSpace($name)) {
            Write-Host "Please type a name." -ForegroundColor Yellow
            continue
        }

        $folder = ($name -replace '[<>:"/\\|?*]', '') -replace '\s+', '-'
        $folder = $folder.Trim('.', ' ', '-')
        if ([string]::IsNullOrWhiteSpace($folder)) {
            Write-Host "That name doesn't leave any valid characters for a folder - try something else." -ForegroundColor Yellow
            continue
        }
        if ($reservedNames -contains $folder.ToUpper()) {
            Write-Host "'$folder' is a reserved Windows name - try something else." -ForegroundColor Yellow
            continue
        }

        $target = Join-Path $gitHubRoot $folder
        if (Test-Path $target) {
            Write-Host "A folder called '$folder' already exists in Documents\GitHub. Pick another name." -ForegroundColor Yellow
            continue
        }

        return [PSCustomObject]@{ Display = $name; Folder = $folder; Path = $target }
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

Write-Host "=== New diffenderfer.games project ===" -ForegroundColor Cyan
$game = Read-NewGameName
$renderer = Read-Renderer

Write-Host "`nCreating '$($game.Folder)' from the template..." -ForegroundColor Cyan
robocopy $templateRoot $game.Path /E /XD .git node_modules dist tools shots .tmp | Out-Null

Push-Location $game.Path
try {
    Write-Host "Installing packages (a minute or two)..." -ForegroundColor Cyan
    npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
    npm run new-game -- --renderer $renderer --title "$($game.Display)"
    if ($LASTEXITCODE -ne 0) { throw "npm run new-game failed" }
} catch {
    Write-Host "($($_.Exception.Message) - run 'npm install' and 'npm run new-game -- --renderer $renderer' by hand.)" -ForegroundColor DarkYellow
} finally {
    Pop-Location
}

Push-Location $game.Path
try {
    git init | Out-Null
    git add -A | Out-Null
    git commit -m "Start $($game.Display)" --quiet | Out-Null
} catch {
    Write-Host "(Skipped git init - you can run it by hand later.)" -ForegroundColor DarkYellow
} finally {
    Pop-Location
}

& (Join-Path $PSScriptRoot 'New-ClaudeShortcut.ps1') -Path $game.Path -Name $game.Display

Write-Host "`n'$($game.Display)' is ready at $($game.Path)" -ForegroundColor Green
Write-Host "A desktop shortcut was created so you can jump back in any time." -ForegroundColor Green
Write-Host "`nStarting Claude..." -ForegroundColor Cyan

Set-Location $game.Path
claude
