@echo off
setlocal
set "ROOT=%~dp0.."
cd /d "%ROOT%"

set "RELEASE=%ROOT%\src-tauri\target\release\aramis-editor.exe"

where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js/npm not found. Install from https://nodejs.org
  exit /b 1
)

where cargo >nul 2>&1
if errorlevel 1 (
  echo Rust/cargo not found. Install from https://rustup.rs
  exit /b 1
)

if not exist "%ROOT%\node_modules\" (
  echo Installing npm dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    exit /b 1
  )
)

echo Building Aramis Editor (release, no installer)...
call npm run build:app
if errorlevel 1 (
  echo Build failed.
  exit /b 1
)

if exist "%RELEASE%" (
  echo.
  echo Build succeeded:
  echo   %RELEASE%
  exit /b 0
)

echo Build finished but release executable was not found.
exit /b 1
