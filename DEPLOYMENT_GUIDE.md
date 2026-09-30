# JRR Transport System — Deployment Guide

Complete guide to deploy the JRR Transport System so it works across **any device** (Android phones, PCs, Macs) and **any network** (Cellular 4G/5G, different Wi-Fi networks, cloud).

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Quick Start: Test on Other Devices NOW](#quick-start-test-on-other-devices-now)
3. [Deploy to Cloud (Render — Free)](#deploy-to-cloud-render--free)
4. [Deploy with Docker (VPS / Self-Hosted)](#deploy-with-docker-vps--self-hosted)
5. [Build Android APK for Drivers](#build-android-apk-for-drivers)
6. [Environment Variables Reference](#environment-variables-reference)
7. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    SUPABASE CLOUD                        │
│          PostgreSQL + Auth + Realtime + Storage           │
│            (Already live — no deployment needed)          │
└──────────────┬──────────────────────────┬────────────────┘
               │                          │
               ▼                          ▼
┌──────────────────────────┐   ┌──────────────────────────────┐
│   Mobile Driver App      │   │   Web Hub & API Server       │
│   (Expo / React Native)  │   │   (Express + Static HTML)    │
│                          │   │                              │
│  • Installed on phones   │   │  • Admin Dashboard           │
│  • Works on 4G / Wi-Fi   │   │  • Fleet & Trip Management   │
│  • Direct Supabase conn  │   │  • Public Tracking /track/   │
│  • Offline queue support │   │  • REST API for all modules  │
└──────────────────────────┘   └──────────────────────────────┘
```

**Key point:** The mobile app connects directly to Supabase Cloud, so drivers can use it on any network immediately. The Web Hub needs to be hosted somewhere accessible (cloud, VPS, or tunnel).

---

## Quick Start: Test on Other Devices NOW

The fastest way to let other devices access your system **without deploying to cloud**:

### Same Wi-Fi Network (LAN)

```powershell
# 1. Start the web server
cd c:\transSytem\transport-app
npm run dev:web

# Output will show:
# Local URL:   http://localhost:3000
#  Network URL: http://192.168.1.XX:3000
```

Open `http://192.168.1.XX:3000` on any phone or computer **on the same Wi-Fi**.

### Different Network (4G / Other Wi-Fi)

Use the included tunnel scripts:

```powershell
# Option A: PowerShell
.\scripts\start_tunnel.ps1

# Option B: Double-click
scripts\start_tunnel.bat
```

This gives you a public URL like `https://jrr-transport.loca.lt` that works from **any network worldwide**.

> ⚠️ **Tunnels are for testing only.** For permanent deployment, use Render or Docker (see below).

---

## Deploy to Cloud (Render — Free)

[Render.com](https://render.com) provides free hosting for web services. Your JRR Transport Web Hub will get a permanent HTTPS URL.

### Step-by-Step

#### 1. Push to GitHub

```powershell
cd c:\transSytem\transport-app
git init
git add .
git commit -m "JRR Transport Hub v1.0"
git remote add origin https://github.com/YOUR_USERNAME/jrr-transport-hub.git
git push -u origin main
```

#### 2. Create Render Web Service

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **"New +" → "Web Service"**
3. Connect your GitHub repository
4. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `jrr-transport-hub` |
| **Region** | Singapore (closest to PH) |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build:server` |
| **Start Command** | `npm run start:prod` |
| **Instance Type** | Free |

#### 3. Add Environment Variables

In Render dashboard → **Environment**:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `SUPABASE_URL` | `https://your-project.supabase.co` |
| `SUPABASE_KEY` | `your_anon_key` |
| `SUPABASE_SERVICE_ROLE_KEY` | `your_service_role_key` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `your_email@gmail.com` |
| `SMTP_PASS` | `your_app_password` |

#### 4. Deploy

Click **"Create Web Service"**. Render will build and deploy automatically.

Your permanent URL: `https://jrr-transport-hub.onrender.com`

#### 5. Verify

```
https://jrr-transport-hub.onrender.com/api/health
```

Should return:
```json
{
  "status": "online",
  "version": "1.0.0",
  "environment": "production"
}
```

---

## Deploy with Docker (VPS / Self-Hosted)

For deploying on your own server (DigitalOcean, Linode, AWS EC2, or a local office server).

### Prerequisites
- Docker and Docker Compose installed on the server
- Your `.env` file configured

### Deploy

```bash
# 1. Copy project to server
scp -r ./transport-app user@your-server:/opt/jrr-transport/

# 2. SSH into server
ssh user@your-server

# 3. Navigate to project
cd /opt/jrr-transport

# 4. Create .env from template
cp .env.example .env
nano .env  # Fill in your Supabase credentials

# 5. Build and start
docker-compose up -d

# 6. Verify
curl http://localhost:3000/api/health
```

### Useful Commands

```bash
# View logs
docker-compose logs -f

# Restart
docker-compose restart

# Stop
docker-compose down

# Rebuild after code changes
docker-compose up -d --build
```

---

## Build Android APK for Drivers

Generate a standalone `.apk` file that drivers can install on their Android phones.

### Prerequisites
```powershell
# Install EAS CLI globally
npm install -g eas-cli

# Login to Expo (create free account at expo.dev)
eas login
```

### Build APK

```powershell
cd c:\transSytem\transport_mobile_app

# Build installable APK (preview profile)
eas build -p android --profile preview
```

The build runs on Expo's cloud servers (takes ~10-15 minutes). When done, you get:
- A **download link** for the `.apk` file
- A **QR code** drivers can scan to download directly

### Distribute to Drivers

| Method | How |
|--------|-----|
| **Direct download** | Share the EAS download link via Viber/Messenger |
| **QR Code** | Print or share the QR code — drivers scan to install |
| **File transfer** | Download `.apk` and send via Bluetooth, USB, or file sharing |
| **Google Play** | Build with `--profile production` for Play Store upload |

### Important: Enable "Install from Unknown Sources"

Drivers must enable this on their phones to install the `.apk`:
1. **Settings → Security → Install Unknown Apps**
2. Allow the browser or file manager to install apps

---

## Environment Variables Reference

### Web Hub (`transport-app/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_KEY` | ✅ | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (admin ops) |
| `PORT` | ❌ | Server port (default: 3000) |
| `NODE_ENV` | ❌ | `production` or `development` |
| `ALLOWED_ORIGINS` | ❌ | Comma-separated CORS origins |
| `SMTP_HOST` | ❌ | Email server hostname |
| `SMTP_PORT` | ❌ | Email server port |
| `SMTP_USER` | ❌ | Email username |
| `SMTP_PASS` | ❌ | Email password |

### Mobile App (`transport_mobile_app/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `EXPO_PUBLIC_API_URL` | ❌ | Deployed Web Hub URL |

---

## Troubleshooting

### "Can't connect from phone on same Wi-Fi"
- Make sure your PC's firewall allows port 3000
- Windows: `Control Panel → Firewall → Allow an app → Node.js`
- Verify the IP: `ipconfig` → look for your Wi-Fi adapter IPv4

### "Tunnel shows '502 Bad Gateway' or 'Host Error'"
- **Cause 1: Local server is not running.** Cloudflare / tunnel cannot reach `http://localhost:3000`.
  - Fix: Start the backend server first: `cd transport-app && npm run dev:web` (or double-click `start_system.bat`).
- **Cause 2: Stale tunnel processes.** Multiple old tunnels are competing in the background.
  - Fix: Open PowerShell and run: `Stop-Process -Name cloudflared -Force` then relaunch.
- **Cause 3: Expired tunnel URL.** Free Cloudflare Quick Tunnels generate a new URL every session. Make sure you are visiting the new URL printed in the terminal, not an old bookmarked one.

### "Tunnel URL shows 'Invalid Host Header'"
- Press the button on the localtunnel page to continue
- Or use Cloudflare Tunnel instead: `npx -y cloudflared tunnel --url http://localhost:3000`

### "APK build fails"
- Make sure you're logged in: `eas whoami`
- Check your `app.json` has a valid `package` name
- Try: `eas build -p android --profile preview --clear-cache`

### "Mobile app can't reach Supabase"
- Verify `.env` has correct `EXPO_PUBLIC_SUPABASE_URL`
- Make sure the Supabase project is not paused (free tier pauses after 1 week)

### "Docker build fails"
- Make sure `.dockerignore` excludes `node_modules`
- Try: `docker-compose build --no-cache`
