#!/usr/bin/env bash
# Print local indexer height, node tip, and a rough catch-up ETA.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  # shellcheck disable=SC1091
  set -a
  source "$ROOT/.env"
  set +a
fi

INDEXER_BIND="${INDEXER_BIND:-127.0.0.1}"
INDEXER_PORT="${INDEXER_PORT:-8088}"
NODE_HTTP="${NODE_HTTP:-https://rpc.preprod.midnight.network}"
INDEXER_NAME="${INDEXER_NAME:-midnight-indexer-preprod}"
DATA_DIR="${DATA_DIR:-$ROOT/data}"
BASE="http://${INDEXER_BIND}:${INDEXER_PORT}"

python3 - "$BASE" "$NODE_HTTP" "$INDEXER_NAME" "$DATA_DIR" <<'PY'
import json, shutil, subprocess, sys, urllib.request, urllib.error
from pathlib import Path

base, node, name, data_dir = sys.argv[1:]

def get(url, timeout=10, data=None, headers=None):
    req = urllib.request.Request(url, data=data, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")
    except Exception as e:
        return None, str(e)

ready_code, ready_body = get(base + "/ready", timeout=5)
q = json.dumps({"query": "{ block { height hash } }"}).encode()
gql_code, gql_body = get(
    base + "/api/v4/graphql",
    data=q,
    headers={"Content-Type": "application/json"},
)
height = None
if gql_code == 200:
    try:
        height = json.loads(gql_body)["data"]["block"]["height"]
    except Exception:
        pass

rpc = json.dumps({"id": 1, "jsonrpc": "2.0", "method": "system_syncState", "params": []}).encode()
rpc_code, rpc_body = get(node, data=rpc, headers={"Content-Type": "application/json"})
tip = None
if rpc_code == 200:
    try:
        tip = json.loads(rpc_body)["result"]["highestBlock"]
    except Exception:
        pass

print(f"API        {base}")
print(f"/ready     {ready_code} {ready_body.strip()}")
print(f"indexed    {height}")
print(f"node tip   {tip} ({node})")
if isinstance(height, int) and isinstance(tip, int) and tip > height:
    remaining = tip - height
    # 1.3 blk/s was the measured rate against the public Preprod RPC on 16 Nov 2026.
    rate = 1.3
    seconds = remaining / rate
    days = seconds / 86400
    print(f"remaining  {remaining} blocks, ~{days:.1f} days at 1.3 blk/s (public RPC trial rate)")
elif isinstance(height, int) and isinstance(tip, int):
    print("remaining  caught up (or at tip)")

data = Path(data_dir)
if data.exists():
    total = 0
    for p in data.rglob("*"):
        if p.is_file():
            total += p.stat().st_size
    print(f"data dir   {data} ({total / (1024*1024):.1f} MiB)")

def docker_cmd():
    if not shutil.which("docker"):
        return None
    for cmd in (["docker"], ["sudo", "-n", "docker"]):
        try:
            subprocess.check_output(cmd + ["info"], text=True, stderr=subprocess.DEVNULL)
            return cmd
        except Exception:
            continue
    return None

cmd = docker_cmd()
if cmd:
    try:
        out = subprocess.check_output(
            cmd + ["ps", "-a", "--filter", f"name={name}", "--format", "{{.Status}}"],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
        if out:
            print(f"container  {name}: {out}")
    except Exception:
        pass
PY
