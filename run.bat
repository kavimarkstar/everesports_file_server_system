@echo off
echo Starting Node server...
cd /d "%~dp0"
node server.js
if errorlevel 1 (
    echo Error: Failed to start server
    pause
    exit /b 1
)
pause
