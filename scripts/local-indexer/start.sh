#!/usr/bin/env bash
# Start a local Midnight Preprod indexer (ledger 9 / indexer 4.4.101).
# Optional: used only when you want to avoid a Blockfrost project id.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  # shellcheck disable=SC1091
  set -a
  source "$ROOT/.env"
  set +a
fi

INDEXER_IMAGE="${INDEXER_IMAGE:-midnightntwrk/indexer-standalone:4.4.101}"
INDEXER_NAME="${INDEXER_NAME:-midnight-indexer-preprod}"
NETWORK_ID="${NETWORK_ID:-preprod}"
NODE_WS="${NODE_WS:-wss://rpc.preprod.midnight.network}"
INDEXER_BIND="${INDEXER_BIND:-127.0.0.1}"
INDEXER_PORT="${INDEXER_PORT:-8088}"
DATA_DIR="${DATA_DIR:-$ROOT/data}"

DOCKER=(docker)
need_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "docker is not installed or not on PATH" >&2
    exit 1
  fi
  if docker info >/dev/null 2>&1; then
    DOCKER=(docker)
  elif command -v sudo >/dev/null 2>&1 && sudo -n docker info >/dev/null 2>&1; then
    DOCKER=(sudo docker)
  else
    echo "the Docker daemon is not running (or this user cannot reach it; try adding yourself to the docker group)" >&2
    exit 1
  fi
}

ensure_data() {
  mkdir -p "$DATA_DIR"
  if [[ ! -f "$DATA_DIR/infra.secret" ]]; then
    openssl rand -hex 32 > "$DATA_DIR/infra.secret"
  fi
  chmod 700 "$DATA_DIR"
  chmod 600 "$DATA_DIR/infra.secret"
  # Image runs as uid 10001.
  if command -v id >/dev/null && [[ "$(id -u)" -eq 0 ]]; then
    chown -R 10001:10001 "$DATA_DIR"
  elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    sudo chown -R 10001:10001 "$DATA_DIR"
  else
    echo "warning: could not chown $DATA_DIR to 10001:10001; the container may be unable to write" >&2
  fi
}

docker_run_common=(
  --name "$INDEXER_NAME"
  --user 10001:10001
  -v "$DATA_DIR:/data"
  -e "APP__APPLICATION__NETWORK_ID=$NETWORK_ID"
  -e "APP__INFRA__NODE__URL=$NODE_WS"
  -e "APP__INFRA__SPO_NODE__URL=$NODE_WS"
  -e "APP__INFRA__SECRET_FILE=/data/infra.secret"
  -e "APP__INFRA__SPO_NODE__BLOCKFROST_ID=dummy-not-using-spo"
  -e "APP__INFRA__STORAGE__CNN_URL=/data/indexer.sqlite"
  -e "APP__INFRA__LEDGER_DB__CNN_URL=/data/ledger-db.sqlite"
  -e "APP__INFRA__NODE__RECONNECT_MAX_ATTEMPTS=1000000"
  -e "APP__INFRA__NODE__RECONNECT_MAX_DELAY=30s"
  -e "APP__INFRA__NODE__SUBSCRIPTION_RECOVERY_TIMEOUT=120s"
  -e "RUST_LOG=indexer_standalone=info,chain_indexer=info,indexer_api=info,wallet_indexer=info,indexer_common=info,midnight_ledger=warn,info"
)

api_up() {
  local i code
  for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    code="$(curl -sS -m 2 -o /dev/null -w "%{http_code}" "http://${INDEXER_BIND}:${INDEXER_PORT}/ready" || true)"
    if [[ "$code" =~ ^[0-9]{3}$ ]]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

need_docker
ensure_data

if "${DOCKER[@]}" ps -a --format "{{.Names}}" | grep -Fx "$INDEXER_NAME" >/dev/null; then
  if "${DOCKER[@]}" ps --format "{{.Names}}" | grep -Fx "$INDEXER_NAME" >/dev/null; then
    echo "container $INDEXER_NAME is already running"
  else
    echo "starting existing container $INDEXER_NAME"
    "${DOCKER[@]}" start "$INDEXER_NAME" >/dev/null
  fi
else
  echo "pulling $INDEXER_IMAGE"
  "${DOCKER[@]}" pull "$INDEXER_IMAGE"
  echo "starting $INDEXER_NAME on ${INDEXER_BIND}:${INDEXER_PORT} (bridge publish)"
  if ! "${DOCKER[@]}" run -d \
    "${docker_run_common[@]}" \
    -e "APP__INFRA__API__ADDRESS=0.0.0.0" \
    -e "APP__INFRA__API__PORT=8088" \
    -p "${INDEXER_BIND}:${INDEXER_PORT}:8088" \
    "$INDEXER_IMAGE"; then
    echo "docker run failed" >&2
    exit 1
  fi
fi

if ! api_up; then
  echo "port publish did not reach ${INDEXER_BIND}:${INDEXER_PORT}; retrying with --network host" >&2
  "${DOCKER[@]}" rm -f "$INDEXER_NAME" >/dev/null
  "${DOCKER[@]}" run -d \
    --network host \
    "${docker_run_common[@]}" \
    -e "APP__INFRA__API__ADDRESS=${INDEXER_BIND}" \
    -e "APP__INFRA__API__PORT=${INDEXER_PORT}" \
    "$INDEXER_IMAGE" >/dev/null
  if ! api_up; then
    echo "indexer started but the API is not reachable at http://${INDEXER_BIND}:${INDEXER_PORT}" >&2
    echo "logs: ${DOCKER[*]} logs $INDEXER_NAME" >&2
    exit 1
  fi
fi

echo "indexer listening at http://${INDEXER_BIND}:${INDEXER_PORT}"
echo "  GraphQL:    http://${INDEXER_BIND}:${INDEXER_PORT}/api/v4/graphql"
echo "  GraphQL WS: ws://${INDEXER_BIND}:${INDEXER_PORT}/api/v4/graphql/ws"
echo "  Ready:      http://${INDEXER_BIND}:${INDEXER_PORT}/ready"
echo "Do not deploy until /ready returns HTTP 200. Run ./status.sh for height and ETA."
echo "Deploy env:"
echo "  MIDNIGHT_INDEXER_URL=http://${INDEXER_BIND}:${INDEXER_PORT}/api/v4/graphql"
echo "  MIDNIGHT_INDEXER_WS_URL=ws://${INDEXER_BIND}:${INDEXER_PORT}/api/v4/graphql/ws"
echo "  MIDNIGHT_NODE=${NODE_HTTP:-https://rpc.preprod.midnight.network}"
echo "  MIDNIGHT_NODE_WS=$NODE_WS"
