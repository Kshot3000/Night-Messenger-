#!/usr/bin/env bash
# Start the Night Messenger ciphertext relay on 127.0.0.1:8787 and expose it
# with a Cloudflare quick tunnel (no Cloudflare account). Logs and PIDs:
#   /workspace/var/nm-relay.log, nm-relay.pid
#   /workspace/var/nm-tunnel.log, nm-tunnel.pid
#   /workspace/var/nm-relay-url
#
# On this box, system DNS maps *.argotunnel.com to a blackhole (198.18.0.1).
# The tunnel is started in a user namespace with a bind-mounted hosts file
# so cloudflared can reach the real edge over HTTP/2.
set -euo pipefail
VAR="${NM_VAR:-/workspace/var}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/home/box/.local/bin:${PATH}"
mkdir -p "$VAR"

relay_alive() {
  local pid
  pid=$(cat "$VAR/nm-relay.pid" 2>/dev/null || true)
  [[ -n "${pid}" ]] && kill -0 "$pid" 2>/dev/null
}
tunnel_alive() {
  local pid
  pid=$(cat "$VAR/nm-tunnel.pid" 2>/dev/null || true)
  [[ -n "${pid}" ]] && kill -0 "$pid" 2>/dev/null
}

if ! relay_alive; then
  : > "$VAR/nm-relay.log"
  nohup env \
    PORT=8787 \
    HOST=127.0.0.1 \
    NM_RELAY_ORIGINS="http://localhost:3000,http://127.0.0.1:3000,https://kshot3000.github.io" \
    NM_RELAY_TTL_HOURS=168 \
    NM_RELAY_DATA="$VAR/nm-relay-data.json" \
    node "$REPO/apps/relay/server.mjs" \
    >> "$VAR/nm-relay.log" 2>&1 &
  echo $! > "$VAR/nm-relay.pid"
  echo "started relay pid $(cat "$VAR/nm-relay.pid")"
else
  echo "relay already running pid $(cat "$VAR/nm-relay.pid")"
fi

for _ in $(seq 1 30); do
  curl -sf --max-time 1 http://127.0.0.1:8787/health >/dev/null && break
  relay_alive || { echo "relay exited; see $VAR/nm-relay.log" >&2; exit 1; }
  sleep 0.2
done
curl -sf --max-time 2 http://127.0.0.1:8787/health >/dev/null || {
  echo "relay did not become healthy; see $VAR/nm-relay.log" >&2
  exit 1
}

# Hosts override so argotunnel names are not black-holed on this machine.
if [[ ! -f "$VAR/hosts" ]]; then
  {
    cat /etc/hosts
    echo "198.41.192.77 region1.v.argotunnel.com region1.v2.argotunnel.com"
    echo "198.41.200.113 region2.v.argotunnel.com region2.v2.argotunnel.com"
  } > "$VAR/hosts"
fi

if ! tunnel_alive; then
  : > "$VAR/nm-tunnel.log"
  nohup unshare -r -m bash -c "mount --bind '$VAR/hosts' /etc/hosts && exec cloudflared tunnel --url http://127.0.0.1:8787 --no-autoupdate --protocol http2" \
    >> "$VAR/nm-tunnel.log" 2>&1 &
  echo $! > "$VAR/nm-tunnel.pid"
  echo "started tunnel pid $(cat "$VAR/nm-tunnel.pid")"
else
  echo "tunnel already running pid $(cat "$VAR/nm-tunnel.pid")"
fi

url=""
for _ in $(seq 1 60); do
  url=$(rg -o 'https://[a-z0-9-]+\.trycloudflare\.com' "$VAR/nm-tunnel.log" 2>/dev/null | tail -1 || true)
  if [[ -n "$url" ]] && rg -q 'Registered tunnel connection' "$VAR/nm-tunnel.log"; then
    break
  fi
  tunnel_alive || { echo "tunnel exited; see $VAR/nm-tunnel.log" >&2; exit 1; }
  sleep 0.5
done
if [[ -z "$url" ]]; then
  echo "did not find a trycloudflare.com URL in $VAR/nm-tunnel.log" >&2
  exit 1
fi
printf '%s\n' "$url" > "$VAR/nm-relay-url"
echo "tunnel url $url"
