function Get-CommitsSinceLastTag {
    param([string]$Root)
    Push-Location $Root
    try {
        $lastTag = git tag -l "v*" --sort=-v:refname 2>$null | Select-Object -First 1
        if ($lastTag) {
            return @(git log "$lastTag..HEAD" --pretty=format:"- %s (%h)")
        }
        return @(git log --pretty=format:"- %s (%h)")
    }
    finally {
        Pop-Location
    }
}

function Format-CommitLines {
    param([string[]]$Commits)
    $lines = @($Commits | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($lines.Count -eq 0) {
        return @("- Maintenance release")
    }
    return $lines
}

function New-ReleasePatchnotes {
    param(
        [string]$Root,
        [string]$Version,
        [string[]]$Commits
    )
    $commitLines = Format-CommitLines -Commits $Commits

    $date = Get-Date -Format "yyyy-MM-dd"
    $tag = "v$Version"
    $body = (@(
        "# Aramis Editor $tag",
        "",
        "Released: $date",
        "",
        "## Changes",
        ""
    ) + $commitLines + @("")) -join "`r`n"

    $releasesDir = Join-Path $Root "releases"
    if (-not (Test-Path $releasesDir)) {
        New-Item -ItemType Directory -Path $releasesDir | Out-Null
    }
    $notesFile = Join-Path $releasesDir "$tag.md"
    Set-Content -Path $notesFile -Value $body

    $changelog = Join-Path $Root "CHANGELOG.md"
    $entry = (@(
        "## $tag ($date)",
        ""
    ) + $commitLines + @("")) -join "`r`n"

    if (Test-Path $changelog) {
        $existing = Get-Content $changelog -Raw
        if ($existing -match "(?m)^## $([regex]::Escape($tag)) \(") {
            $existing = $existing -replace "(?ms)^## $([regex]::Escape($tag)) \(.*?\r?\n\r?\n.*?\r?\n\r?\n", ""
        }
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
