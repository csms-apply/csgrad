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
csgrad_pm2_status="$(pm2 jlist | node -e 'let s=""; process.stdin.on("data",c=>s+=c); process.stdin.on("end",()=>{ const p=JSON.parse(s).find(p=>p.name==="docusaurus"); console.log(p?.pm2_env?.status || "missing"); });')"
if [ "$csgrad_pm2_status" = missing ]; then
  pm2 start npm --name "docusaurus" -- run serve
elif [ "$csgrad_pm2_status" != online ]; then
  pm2 restart docusaurus
fi
pm2 save
