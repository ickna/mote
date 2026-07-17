#!/bin/bash
# Build Mote and deploy to dev.ickna.net (CT 103 LEMP stack)
# Usage: ./deploy.sh

set -e

echo "==> Building mote.html..."
cd /home/codebox/code/mote
node build.js

echo "==> Deploying to CT 103 (/var/www/html/mote/)..."
tar czf /tmp/mote-deploy.tar.gz mote.html presets/ index.html --transform 's|^|mote/|'
scp -i ~/.ssh/id_ed25519_hermes /tmp/mote-deploy.tar.gz root@192.168.84.206:/tmp/mote-deploy.tar.gz
ssh inknet-pve "pct push 103 /tmp/mote-deploy.tar.gz /tmp/mote-deploy.tar.gz"
ssh inknet-pve "pct exec 103 -- tar xzf /tmp/mote-deploy.tar.gz -C /var/www/html/"
rm /tmp/mote-deploy.tar.gz

echo "==> Done. Available at:"
echo "    https://dev.ickna.net/mote/mote.html"
echo "    https://dev.ickna.net/mote/mote.html?mode=play"
echo "    https://dev.ickna.net/  (dashboard)"
