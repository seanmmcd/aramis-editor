function Get-ProjectVersion {
    param([string]$Root)
    $versionFile = Join-Path $Root "VERSION"
    if (-not (Test-Path $versionFile)) {
        throw "VERSION file not found at $versionFile"
    }
    $version = (Get-Content $versionFile -Raw).Trim()
    if ($version -notmatch '^\d+\.\d+\.\d+$') {
        throw "VERSION must be semver (major.minor.patch), got: $version"
    }
    return $version
}

function Set-ProjectVersion {
    param(
        [string]$Root,
        [string]$Version
    )
    if ($Version -notmatch '^\d+\.\d+\.\d+$') {
        throw "Version must be semver (major.minor.patch), got: $Version"
    }

    Set-Content -Path (Join-Path $Root "VERSION") -Value $Version -NoNewline

    $packageJson = Join-Path $Root "package.json"
    (Get-Content $packageJson -Raw) -replace '"version":\s*"\d+\.\d+\.\d+"', "`"version`": `"$Version`"" |
        Set-Content $packageJson -NoNewline

    $lockFile = Join-Path $Root "package-lock.json"
    if (Test-Path $lockFile) {
        $lock = Get-Content $lockFile -Raw
        $lock = $lock -replace '("name":\s*"aramis-editor",\s*\r?\n\s*"version":\s*")(\d+\.\d+\.\d+)(")', "`${1}$Version`${3}"
        $lock = $lock -replace '("":\s*\{\s*\r?\n\s*"name":\s*"aramis-editor",\s*\r?\n\s*"version":\s*")(\d+\.\d+\.\d+)(")', "`${1}$Version`${3}"
        Set-Content $lockFile $lock -NoNewline
    }

    $tauriConf = Join-Path $Root "src-tauri\tauri.conf.json"
    (Get-Content $tauriConf -Raw) -replace '"version":\s*"\d+\.\d+\.\d+"', "`"version`": `"$Version`"" |
        Set-Content $tauriConf -NoNewline

    $cargoToml = Join-Path $Root "src-tauri\Cargo.toml"
    (Get-Content $cargoToml -Raw) -replace '^version = "\d+\.\d+\.\d+"', "version = `"$Version`"" |
        Set-Content $cargoToml -NoNewline
}

function Bump-ProjectVersion {
    param(
        [string]$Root,
        [ValidateSet("patch", "minor", "major")]
        [string]$Part = "patch"
    )
    $current = Get-ProjectVersion -Root $Root
    $parts = $current.Split(".") | ForEach-Object { [int]$_ }
    switch ($Part) {
        "major" { $parts[0]++; $parts[1] = 0; $parts[2] = 0 }
        "minor" { $parts[1]++; $parts[2] = 0 }
        "patch" { $parts[2]++ }
    }
    $next = "{0}.{1}.{2}" -f $parts[0], $parts[1], $parts[2]
    Set-ProjectVersion -Root $Root -Version $next
    return $next
}
