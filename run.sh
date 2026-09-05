#!/usr/bin/env bash

set -euo pipefail

npm ci
npm run build
if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi
pm2 restart docusaurus || pm2 start npm --name "docusaurus" -- run serve
pm2 save
