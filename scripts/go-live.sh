#!/usr/bin/env bash
# Promote https://mydspv1.dave-perry.workers.dev from any folder.
# Usage (Mini Terminal):
#   curl -fsSL https://raw.githubusercontent.com/perrda/MyDSP/main/scripts/go-live.sh | bash
# Or: bash ~/MyDSP/scripts/go-live.sh
set -euo pipefail
cd "$HOME"
if [ -d "$HOME/MyDSP/.git" ]; then
  cd "$HOME/MyDSP"
  git fetch origin main
  git checkout main
  git pull origin main
else
  rm -rf "$HOME/MyDSP"
  git clone https://github.com/perrda/MyDSP.git "$HOME/MyDSP"
  cd "$HOME/MyDSP"
fi
echo "Working in $PWD (not ~/AI_Projects/MyDSP)"
if ! npx wrangler whoami >/dev/null 2>&1; then
  echo "Cloudflare login required once. Paste:"
  echo "  cd ~/MyDSP && npx wrangler login"
  echo "Then paste the go-live line again."
  exit 1
fi
npm ci
npm run deploy
LIVE_SW="$(curl -fsSL https://mydspv1.dave-perry.workers.dev/sw.js | grep -o 'mydsp-v[0-9.]*' | head -1 || true)"
echo "Live service worker: ${LIVE_SW:-unknown — hard-refresh and check again}"
echo "Hard-refresh https://mydspv1.dave-perry.workers.dev"
