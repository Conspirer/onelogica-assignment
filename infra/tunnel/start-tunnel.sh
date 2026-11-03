#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Onelogica Backend Tunnel Launcher
# Exposes local Fastify backend (port 8080) for external testing or Netlify proxy.
# Supports both Cloudflare Tunnel (cloudflared) and Microsoft Dev Tunnels.
# ==============================================================================

PORT="${PORT:-8080}"

echo "========================================================"
echo " Starting Onelogica Backend Tunnel (Port: ${PORT})       "
echo "========================================================"

# 1. Try Cloudflare Tunnel if installed
if command -v cloudflared &> /dev/null; then
  echo "[Tunnel] Found cloudflared CLI. Starting Cloudflare Quick Tunnel..."
  echo "[Tunnel] Forwarding public HTTPS / WSS traffic to http://localhost:${PORT}"
  exec cloudflared tunnel --url "http://localhost:${PORT}"
fi

# 2. Try Microsoft Dev Tunnels if installed
if command -v devtunnel &> /dev/null; then
  echo "[Tunnel] Found devtunnel CLI. Starting Dev Tunnel..."
  exec devtunnel host -p "${PORT}" --allow-anonymous
fi

# 3. Fallback instructions
cat << 'EOF'
[Tunnel Error] Neither 'cloudflared' nor 'devtunnel' CLI was found on your system.

To install Cloudflare Tunnel:
  - macOS: brew install cloudflared
  - Linux: sudo apt-get install cloudflared (or download from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
  - Windows: winget install --id Cloudflare.cloudflared

Quick command once installed:
  cloudflared tunnel --url http://localhost:8080

To use Microsoft Dev Tunnels:
  npm install -g @microsoft/dev-tunnels
  devtunnel host -p 8080 --allow-anonymous
EOF

exit 1
