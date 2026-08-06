#!/usr/bin/env bash
set -euo pipefail
# Usage from smart-employee/: GH_TOKEN=xxxx ./scripts/publish-github.sh
TOKEN="${GH_TOKEN:?set GH_TOKEN}"
OWNER="${GH_OWNER:-Abumahaa2025}"
REPO="${GH_REPO:-stitch-saudi-smart}"
API="https://api.github.com"
curl -fsSL -X POST -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
  "$API/user/repos" \
  -d "{\"name\":\"$REPO\",\"private\":false,\"description\":\"الموظف العقاري الذكي - Saudi Smart\"}" \
  || true
git init -b main 2>/dev/null || true
git remote remove origin 2>/dev/null || true
git remote add origin "https://x-access-token:${TOKEN}@github.com/${OWNER}/${REPO}.git"
git add -A
git commit -m "feat: stitch-saudi-smart release" || true
git push -u origin main --force
echo "Repo: https://github.com/${OWNER}/${REPO}"
echo "Next: vercel.com/new → import repo → Vite → output dist"
