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
npm ci
npm run deploy
echo "Live should now match main. Hard-refresh https://mydspv1.dave-perry.workers.dev"
