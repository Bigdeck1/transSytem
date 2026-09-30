@echo off
REM ====================================================
REM JRR Transport — Quick Remote Testing Tunnel
REM Exposes your local server to the public internet
REM ====================================================

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_tunnel.ps1"
if errorlevel 1 (
    pause
)
