# Creates a Start Menu shortcut for Aramis Editor.
$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Launcher = Join-Path $PSScriptRoot "launch-aramis-editor.bat"
$Icon = Join-Path $Root "src-tauri\icons\icon.ico"
$ShortcutName = "Aramis Editor.lnk"
$Programs = [Environment]::GetFolderPath("Programs")
$ShortcutPath = Join-Path $Programs $ShortcutName

if (-not (Test-Path $Launcher)) {
    Write-Error "Launcher not found: $Launcher"
}

$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $Launcher
$Shortcut.WorkingDirectory = $Root
$Shortcut.Description = "Aramis Editor desktop photo editor"
if (Test-Path $Icon) {
    $Shortcut.IconLocation = "$Icon,0"
}
$Shortcut.Save()

Write-Host "Created Start Menu shortcut:"
Write-Host "  $ShortcutPath"
Write-Host "Target: $Launcher"
