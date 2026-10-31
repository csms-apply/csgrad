#!/usr/bin/env bash
# bash run.sh             install, build and activate a release on this server
# bash run.sh --prebuilt  activate the tar.gz build CI streams on stdin

# Non-interactive SSH sessions may not load the server's Node installation.
# Load NVM before nounset: its initialization reads optional shell variables.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
fi

set -euo pipefail

# Serialize builds, activation and cleanup across overlapping SSH deployments.
exec 9>.site-deploy.lock
flock 9

# `docusaurus serve` still runs from node_modules. A prebuilt deploy only
# reinstalls when package-lock.json changed since the last install.
csgrad_lock_hash="$(sha256sum package-lock.json)"
if [ "${1:-}" != --prebuilt ] || [ "$(cat node_modules/.csgrad-lock-sha256 2>/dev/null)" != "$csgrad_lock_hash" ]; then
  npm ci </dev/null
  echo "$csgrad_lock_hash" > node_modules/.csgrad-lock-sha256
fi
# Build away from the directory currently served by Docusaurus.
mkdir -p .site-releases
csgrad_release="$(mktemp -d "$PWD/.site-releases/release-XXXXXXXX")"
# Any failure before activation drops the partial release; the live one keeps serving.
trap '[ "$(readlink -f build)" = "$(readlink -f "$csgrad_release")" ] || rm -rf "$csgrad_release"' EXIT
if [ "${1:-}" = --prebuilt ]; then
  tar -xzf - -C "$csgrad_release"
else
  npm run build -- --out-dir "$csgrad_release"
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
