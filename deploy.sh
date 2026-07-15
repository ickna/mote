#!/bin/bash
# Build Mote from source and deploy to the dev server
# Usage: ./deploy.sh

set -e

echo "==> Building mote.html..."
cd /home/codebox/code/mote
node build.js

echo "==> Deploying to /home/codebox/www/mote/..."
cp mote.html /home/codebox/www/mote/
cp -r presets /home/codebox/www/mote/ 2>/dev/null || true
cp control-server.js /home/codebox/www/mote/ 2>/dev/null || true

echo "==> Done. Available at:"
echo "    http://192.168.84.178:8080/mote.html"
echo "    http://192.168.84.178:8080/mote.html?mode=play"
