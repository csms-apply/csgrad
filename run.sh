#!/usr/bin/env bash

# Non-interactive SSH sessions may not load the server's Node installation.
# Load NVM before nounset: its initialization reads optional shell variables.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
fi

set -euo pipefail

npm ci
# Build away from the directory currently served by Docusaurus.
mkdir -p .site-releases
csgrad_release="$(mktemp -d "$PWD/.site-releases/release-XXXXXXXX")"
if ! npm run build -- --out-dir "$csgrad_release"; then
  rm -rf "$csgrad_release"
  exit 1
fi
python3 scripts/activate-build.py "$PWD" "$csgrad_release"
if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi
# The server resolves build paths per request; switching the symlink is enough.
# Restarting here would create an unnecessary gap in report availability.
pm2 describe docusaurus >/dev/null 2>&1 || pm2 start npm --name "docusaurus" -- run serve
pm2 save
