#!/usr/bin/env bash
# Stop the local Preprod indexer. The data directory is left in place so a later start resumes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  # shellcheck disable=SC1091
  set -a
  source "$ROOT/.env"
  set +a
fi

INDEXER_NAME="${INDEXER_NAME:-midnight-indexer-preprod}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is not installed or not on PATH" >&2
  exit 1
fi

if docker info >/dev/null 2>&1; then
  DOCKER=(docker)
elif command -v sudo >/dev/null 2>&1 && sudo -n docker info >/dev/null 2>&1; then
  DOCKER=(sudo docker)
else
  echo "the Docker daemon is not running (or this user cannot reach it)" >&2
  exit 1
fi

if "${DOCKER[@]}" ps -a --format '{{.Names}}' | grep -Fx "$INDEXER_NAME" >/dev/null; then
  "${DOCKER[@]}" stop "$INDEXER_NAME" >/dev/null
  echo "stopped $INDEXER_NAME (data kept; ./start.sh to resume)"
else
  echo "container $INDEXER_NAME is not present"
fi
