#!/usr/bin/env bash

# Non-interactive SSH sessions may not load the server's Node installation.
# Load NVM before nounset: its initialization reads optional shell variables.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
fi

set -euo pipefail

npm ci
npm run build
if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi
pm2 restart docusaurus || pm2 start npm --name "docusaurus" -- run serve
pm2 save
