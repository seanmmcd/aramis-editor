function Get-CommitsSinceLastTag {
    param([string]$Root)
    Push-Location $Root
    try {
        $lastTag = git describe --tags --abbrev=0 --match "v*" 2>$null
        if ($LASTEXITCODE -eq 0 -and $lastTag) {
            return git log "$lastTag..HEAD" --pretty=format:"- %s (%h)"
        }
        return git log --pretty=format:"- %s (%h)"
    }
    finally {
        Pop-Location
    }
}

function New-ReleasePatchnotes {
    param(
        [string]$Root,
        [string]$Version
    )
    $commits = @(Get-CommitsSinceLastTag -Root $Root)
    if ($commits.Count -eq 0) {
        $commits = @("- Maintenance release")
    }

    $date = Get-Date -Format "yyyy-MM-dd"
    $tag = "v$Version"
    $lines = @(
        "# Aramis Editor $tag",
        "",
        "Released: $date",
        "",
        "## Changes",
        "",
        $commits,
        ""
    )
    $body = $lines -join "`r`n"

    $releasesDir = Join-Path $Root "releases"
    if (-not (Test-Path $releasesDir)) {
        New-Item -ItemType Directory -Path $releasesDir | Out-Null
    }
    $notesFile = Join-Path $releasesDir "$tag.md"
    Set-Content -Path $notesFile -Value $body

    $changelog = Join-Path $Root "CHANGELOG.md"
    $entry = @(
        "## $tag ($date)",
        "",
        $commits,
        ""
    ) -join "`r`n"

    if (Test-Path $changelog) {
        $existing = Get-Content $changelog -Raw
        if ($existing -match '(?m)^# Changelog') {
            $updated = $existing -replace '(?m)^# Changelog\r?\n\r?\n', "# Changelog`r`n`r`n$entry"
            Set-Content $changelog $updated -NoNewline
        }
        else {
            Set-Content $changelog ("# Changelog`r`n`r`n$entry$existing") -NoNewline
        }
    }
    else {
        Set-Content $changelog ("# Changelog`r`n`r`n$entry") -NoNewline
    }

    return $notesFile
}
