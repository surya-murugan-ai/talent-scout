#!/bin/bash
cd /home/ubuntu/apps/talent-scout
git pull
npm install
npm run build
pm2 restart talent-scout-app
echo "Talent Scout deployed successfully!"
