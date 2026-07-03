@echo off
rem Release Aramis Editor: bump version, build installer, publish to GitHub.
rem
rem Usage:
rem   scripts\release.bat              Bump patch (0.1.0 -> 0.1.1) and publish
rem   scripts\release.bat minor          Bump minor version
rem   scripts\release.bat major          Bump major version
rem   scripts\release.bat 1.2.0          Set explicit version
rem   scripts\release.bat patch -NoPush  Build locally, do not push to GitHub
rem
rem Requires: git, npm, cargo, GitHub CLI (gh auth login)
rem Version source of truth: VERSION (synced to package.json, tauri.conf.json, Cargo.toml)

setlocal
set "ROOT=%~dp0.."
cd /d "%ROOT%"

echo.
echo Aramis Editor - Release
echo.

where powershell >nul 2>&1
if errorlevel 1 (
  echo PowerShell is required but was not found.
  exit /b 1
)

set "ARGS="
:parse
if "%~1"=="" goto run
set "ARGS=%ARGS% %1"
shift
goto parse

:run
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0release.ps1"%ARGS%
set "EXITCODE=%ERRORLEVEL%"
exit /b %EXITCODE%
