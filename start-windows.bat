@echo off
setlocal
cd /d "%~dp0"
title FiledMaker - Local Web Server
echo Starting FiledMaker on http://127.0.0.1:5174 ...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve-windows.ps1"
if errorlevel 1 (
  echo.
  echo The local server could not start. Copy the error above for troubleshooting.
  pause
)
endlocal
