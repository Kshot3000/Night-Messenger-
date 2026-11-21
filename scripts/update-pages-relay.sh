#!/usr/bin/env bash
# Update only relay.json on the gh-pages branch (no site rebuild).
# Usage: scripts/update-pages-relay.sh [https://….trycloudflare.com]
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
URL="${1:-}"
if [[ -z "$URL" && -f /workspace/var/nm-relay-url ]]; then
  URL=$(tr -d '[:space:]' < /workspace/var/nm-relay-url)
fi
if [[ ! "$URL" =~ ^https://[^[:space:]]+$ ]]; then
  echo "Usage: $0 https://<subdomain>.trycloudflare.com" >&2
  exit 1
fi
URL="${URL%/}"
PUBLISH_DIR="$(mktemp -d)"
trap 'rm -rf "$PUBLISH_DIR"' EXIT
git clone --single-branch --branch gh-pages https://github.com/Kshot3000/Night-Messenger-.git "$PUBLISH_DIR"
python3 - "$PUBLISH_DIR/relay.json" "$URL" << 'PY'
import json, sys
from pathlib import Path
Path(sys.argv[1]).write_text(json.dumps({"relay": sys.argv[2]}, indent=2) + "\n")
PY
git -C "$PUBLISH_DIR" add relay.json
if git -C "$PUBLISH_DIR" diff --cached --quiet; then
  echo "relay.json on gh-pages already points at $URL"
  exit 0
fi
git -C "$PUBLISH_DIR" -c user.name="${GIT_AUTHOR_NAME:-Kshot3000}" -c user.email="${GIT_AUTHOR_EMAIL:-Kshot3000@users.noreply.github.com}" \
  commit -m "Update interim ciphertext relay URL"
git -C "$PUBLISH_DIR" push origin HEAD:gh-pages
echo "Updated relay.json to $URL"
echo "Tester link: https://kshot3000.github.io/Night-Messenger-/private/?relay=${URL}"
