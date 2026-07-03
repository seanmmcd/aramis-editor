@echo off
setlocal
set "ROOT=%~dp0.."
cd /d "%ROOT%"

set "RELEASE=%ROOT%\src-tauri\target\release\aramis-editor.exe"

if exist "%RELEASE%" (
  start "" "%RELEASE%"
  exit /b 0
)

where npm >nul 2>&1
if errorlevel 1 (
  echo Aramis Editor needs a release build.
  echo Install Node.js from https://nodejs.org then run:
  echo   cd "%ROOT%"
  echo   npm install
  echo   npm run tauri build
  pause
  exit /b 1
)

echo Building Aramis Editor (release, no installer)...
call npm run build:app
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)

if exist "%RELEASE%" (
  start "" "%RELEASE%"
  exit /b 0
)

echo Release executable not found after build.
pause
exit /b 1
