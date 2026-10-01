#!/usr/bin/env bash
# Build and publish with a normal commit; preserve the existing Pages history.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"
pnpm build:pages
PUBLISH_DIR="$(mktemp -d)"
trap 'rm -rf "$PUBLISH_DIR"' EXIT
git clone --single-branch --branch gh-pages https://github.com/Kshot3000/Night-Messenger-.git "$PUBLISH_DIR"
# Delete only the temporary clone's tracked deploy files.
git -C "$PUBLISH_DIR" rm -r --ignore-unmatch .
cp -a apps/web/out/. "$PUBLISH_DIR/"
git -C "$PUBLISH_DIR" add -A
if git -C "$PUBLISH_DIR" diff --cached --quiet; then
  echo "The published site is already current."
  exit 0
fi
git -C "$PUBLISH_DIR" -c user.name="${GIT_AUTHOR_NAME:-Kshot3000}" -c user.email="${GIT_AUTHOR_EMAIL:-kshot3000@users.noreply.github.com}" commit -m "Publish Night Messenger website"
git -C "$PUBLISH_DIR" push origin HEAD:gh-pages
echo "Published: https://kshot3000.github.io/Night-Messenger-/"
