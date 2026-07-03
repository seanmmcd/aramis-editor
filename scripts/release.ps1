param(
    [Parameter(Position = 0)]
    [string]$Bump = "patch",
    [switch]$NoPush,
    [switch]$DryRun,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")

. (Join-Path $PSScriptRoot "lib\version.ps1")
. (Join-Path $PSScriptRoot "lib\patchnotes.ps1")

function Require-Command {
    param([string]$Name, [string]$InstallHint)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name not found. $InstallHint"
    }
}

function Get-InstallerPath {
    param([string]$Root, [string]$Version)
    $bundleDir = Join-Path $Root "src-tauri\target\release\bundle\nsis"
    if (-not (Test-Path $bundleDir)) {
        return $null
    }
    $expected = Join-Path $bundleDir "Aramis Editor_${Version}_x64-setup.exe"
    if (Test-Path $expected) {
        return $expected
    }
    $found = Get-ChildItem -Path $bundleDir -Filter "*setup.exe" -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($found) {
        return $found.FullName
    }
    return $null
}

Write-Host ""
Write-Host "=== Aramis Editor Release ===" -ForegroundColor Cyan
Write-Host ""

Require-Command "git" "Install Git from https://git-scm.com"
Require-Command "npm" "Install Node.js from https://nodejs.org"
Require-Command "cargo" "Install Rust from https://rustup.rs"

if (-not $NoPush -and -not $DryRun) {
    Require-Command "gh" "Install GitHub CLI from https://cli.github.com then run: gh auth login"
}

Push-Location $Root
try {
    $status = git status --porcelain
    if ($status) {
        Write-Host "Uncommitted changes detected:" -ForegroundColor Yellow
        Write-Host $status
        if (-not $DryRun) {
            $answer = Read-Host "Continue anyway? [y/N]"
            if ($answer -notmatch '^[Yy]') {
                throw "Release cancelled."
            }
        }
    }

    $currentVersion = Get-ProjectVersion -Root $Root
    Write-Host "Current version: $currentVersion"

    if ($Bump -match '^\d+\.\d+\.\d+$') {
        $newVersion = $Bump
        if ($DryRun) {
            Write-Host "[dry-run] Would set version to $newVersion"
        }
        else {
            Set-ProjectVersion -Root $Root -Version $newVersion
        }
    }
    else {
        $part = $Bump.ToLower()
        if ($part -notin @("patch", "minor", "major")) {
            throw "Bump must be patch, minor, major, or an explicit version like 1.2.3"
        }
        if ($DryRun) {
            $parts = $currentVersion.Split(".") | ForEach-Object { [int]$_ }
            switch ($part) {
                "major" { $parts[0]++; $parts[1] = 0; $parts[2] = 0 }
                "minor" { $parts[1]++; $parts[2] = 0 }
                "patch" { $parts[2]++ }
            }
            $newVersion = "{0}.{1}.{2}" -f $parts[0], $parts[1], $parts[2]
            Write-Host "[dry-run] Would bump $part -> $newVersion"
        }
        else {
            $newVersion = Bump-ProjectVersion -Root $Root -Part $part
        }
    }

    $tag = "v$newVersion"
    Write-Host "Release version: $newVersion ($tag)"

    if ($DryRun) {
        Write-Host "[dry-run] Would generate patch notes from git history"
    }
    else {
        $notesFile = New-ReleasePatchnotes -Root $Root -Version $newVersion
        Write-Host "Patch notes written to: $notesFile"
    }

    if ($DryRun) {
        Write-Host "[dry-run] Would commit version bump and patch notes"
        Write-Host "[dry-run] Would build Windows NSIS installer"
        if (-not $NoPush) {
            Write-Host "[dry-run] Would tag $tag, push, and create GitHub release"
        }
        Write-Host ""
        Write-Host "Dry run complete." -ForegroundColor Green
        exit 0
    }

    git add VERSION package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml CHANGELOG.md releases/
    git commit -m "Release $tag"
    if ($LASTEXITCODE -ne 0) {
        throw "git commit failed"
    }

    git tag -a $tag -m "Release $tag"
    if ($LASTEXITCODE -ne 0) {
        throw "git tag failed"
    }

    if (-not $SkipBuild) {
        Write-Host ""
        Write-Host "Building installer (this may take several minutes)..." -ForegroundColor Cyan
        if (-not (Test-Path (Join-Path $Root "node_modules"))) {
            npm install
            if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
        }
        npm run build:installer
        if ($LASTEXITCODE -ne 0) { throw "Installer build failed" }
    }

    $installer = Get-InstallerPath -Root $Root -Version $newVersion
    if (-not $installer) {
        throw "Installer not found under src-tauri\target\release\bundle\nsis"
    }
    Write-Host "Installer: $installer" -ForegroundColor Green

    if ($NoPush) {
        Write-Host ""
        Write-Host "Release prepared locally (not pushed)." -ForegroundColor Green
        Write-Host "  Tag:    $tag"
        Write-Host "  Notes:  releases\$tag.md"
        Write-Host "  Setup:  $installer"
        exit 0
    }

    Write-Host ""
    Write-Host "Pushing commit and tag to GitHub..." -ForegroundColor Cyan
    git push origin HEAD
    if ($LASTEXITCODE -ne 0) { throw "git push failed" }
    git push origin $tag
    if ($LASTEXITCODE -ne 0) { throw "git push tag failed" }

    Write-Host "Creating GitHub release..." -ForegroundColor Cyan
    gh release create $tag $installer `
        --title "Aramis Editor $tag" `
        --notes-file (Join-Path $Root "releases\$tag.md")
    if ($LASTEXITCODE -ne 0) { throw "gh release create failed" }

    $releaseUrl = gh release view $tag --json url -q .url
    Write-Host ""
    Write-Host "Release published successfully." -ForegroundColor Green
    if ($releaseUrl) {
        Write-Host $releaseUrl
    }
}
finally {
    Pop-Location
}
