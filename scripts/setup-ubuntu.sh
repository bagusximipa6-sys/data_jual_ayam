#!/usr/bin/env bash
# Project Setup - Ubuntu / Debian
#
# Idempotent — safe to run multiple times.

set -e

echo ""
echo "  ╔══════════════════════════════════╗"
echo "  ║          Project Setup           ║"
echo "  ╚══════════════════════════════════╝"
echo ""

# --- 1. Core dependencies (curl, git, build-essential) ---
echo "→ Checking system packages..."
PACKAGES_NEEDED=""
command -v curl &>/dev/null || PACKAGES_NEEDED="$PACKAGES_NEEDED curl"
command -v git  &>/dev/null || PACKAGES_NEEDED="$PACKAGES_NEEDED git"

if [[ -n "$PACKAGES_NEEDED" ]]; then
  echo "→ Installing system packages:$PACKAGES_NEEDED"
  sudo apt-get update -y
  sudo apt-get install -y $PACKAGES_NEEDED
else
  echo "✓ curl and git already installed"
fi

# --- 2. Node.js 20+ via NodeSource ---
install_node() {
  echo "→ Installing Node.js 20 via NodeSource..."
  sudo apt-get install -y ca-certificates gnupg
  sudo mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list > /dev/null
  sudo apt-get update -y
  sudo apt-get install -y nodejs
}

if ! command -v node &>/dev/null; then
  install_node
else
  NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
  if [[ "$NODE_MAJOR" -lt 20 ]]; then
    echo "→ Node.js is too old ($(node -v)), upgrading..."
    install_node
  else
    echo "✓ Node.js $(node -v) already installed"
  fi
fi

# --- 3. Install dependencies ---
echo "→ Installing dependencies..."
npm install

# --- 4. Start dev server in background ---
echo "→ Starting dev server..."

# Kill any existing process on port 3000
fuser -k 3000/tcp 2>/dev/null || true

npm run dev > /dev/null &
DEV_PID=$!
trap 'echo ""; echo "  Stopping dev server..."; kill $DEV_PID 2>/dev/null || true; fuser -k 3000/tcp 2>/dev/null || true' EXIT

# --- 5. Wait for server to be ready ---
echo "→ Waiting for your app to start..."
TRIES=0
MAX_TRIES=30
while ! curl -s -o /dev/null http://localhost:3000 2>/dev/null; do
  sleep 1
  TRIES=$((TRIES + 1))
  if [[ $TRIES -ge $MAX_TRIES ]]; then
    echo "⚠ Dev server took too long to start. Try running 'npm run dev' manually."
    break
  fi
done

# --- 6. Open browser ---
echo "→ Opening browser..."
if command -v xdg-open &>/dev/null; then
  xdg-open http://localhost:3000
elif command -v sensible-browser &>/dev/null; then
  sensible-browser http://localhost:3000
elif command -v gnome-open &>/dev/null; then
  gnome-open http://localhost:3000
fi

echo ""
echo "  ✓ Setup complete!"
echo ""
