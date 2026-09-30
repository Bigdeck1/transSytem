# ====================================================
# JRR Transport — Public Tunnel Launcher
# Uses Cloudflare Tunnel (fast, secure, stable)
# ====================================================

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  JRR Transport System - Public Remote Tunnel" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check if server is running on port 3000
$serverRunning = $false
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -TimeoutSec 2 -ErrorAction Stop
    if ($health.status -eq "online") {
        $serverRunning = $true
        Write-Host "[OK] Local server is online on port 3000." -ForegroundColor Green
    }
} catch {
    $serverRunning = $false
}

if (-not $serverRunning) {
    Write-Host "[!] Local server is NOT running on port 3000." -ForegroundColor Yellow
    Write-Host "[..] Starting local web server in a new window..." -ForegroundColor Cyan
    
    $serverDir = "C:\transSytem\transport-app"
    Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd /d `"$serverDir`" && npm run dev:web" -WindowStyle Normal
    
    Write-Host "[..] Waiting for server to initialize..." -ForegroundColor Yellow
    $retries = 0
    while (-not $serverRunning -and $retries -lt 25) {
        Start-Sleep -Seconds 1
        $retries++
        try {
            $health = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -TimeoutSec 2 -ErrorAction Stop
            if ($health.status -eq "online") {
                $serverRunning = $true
                Write-Host "[OK] Local server is ready!" -ForegroundColor Green
                break
            }
        } catch {}
    }
    
    if (-not $serverRunning) {
        Write-Host "[ERROR] Could not connect to http://localhost:3000/api/health." -ForegroundColor Red
        Write-Host "Please check the web server terminal for any errors." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# 2. Kill any stale cloudflared instances to prevent 502 / collisions
Get-Process -Name cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# 3. Locate cloudflared.exe
$cfPath = "C:\transSytem\cloudflared.exe"
if (-not (Test-Path $cfPath)) {
    $cfPath = "C:\transSytem\transport-app\cloudflared.exe"
}

if (Test-Path $cfPath) {
    Write-Host ""
    Write-Host "[..] Launching Cloudflare Tunnel (https://*.trycloudflare.com)..." -ForegroundColor Cyan
    Write-Host "    Keep this window open while accessing the system remotely!" -ForegroundColor Yellow
    Write-Host "    Press Ctrl+C to close the tunnel." -ForegroundColor DarkGray
    Write-Host ""
    & $cfPath tunnel --url http://localhost:3000
} else {
    Write-Host "[!] cloudflared.exe not found. Falling back to localtunnel..." -ForegroundColor Yellow
    npx -y localtunnel --port 3000 --subdomain jrr-transport
}
