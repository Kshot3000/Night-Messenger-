#!/usr/bin/env bash
# Build apps/web static export and push to gh-pages (GitHub Pages).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export GITHUB_PAGES=true
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://kshot3000.github.io/Night-Messenger-}"
pnpm --filter @midnight-messenger/web build
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cp -a apps/web/out/. "$WORK/"
touch "$WORK/.nojekyll"
cd "$WORK"
git init -b gh-pages
git config user.name "${GIT_AUTHOR_NAME:-Kshot3000}"
git config user.email "${GIT_AUTHOR_EMAIL:-kshot3000@users.noreply.github.com}"
git add -A
git commit -m "Deploy Night Messenger static site $(date -u +%Y-%m-%dT%H:%MZ)"
git remote add origin https://github.com/Kshot3000/Night-Messenger-.git
git push -f origin gh-pages
echo "Deployed → https://kshot3000.github.io/Night-Messenger-/"
