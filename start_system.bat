@echo off
REM ====================================================
REM JRR Transport — 1-Click Server & Remote Access Launcher
REM ====================================================

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start_tunnel.ps1"
if errorlevel 1 (
    pause
)
