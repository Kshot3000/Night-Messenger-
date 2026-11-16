# Optional local Midnight Preprod indexer

Run Midnight's public `indexer-standalone` 4.4.101 against a Preprod node so Night Messenger can deploy without a Blockfrost project id.

This is optional. It does not touch mainnet, does not sign up for anything, and does not spend funds.

## Verdict (16 November 2026, America/Chicago)

**Works with caveats.** The image and the client libraries are ready; a full catch-up from the public Preprod RPC is too slow to unblock a deploy this week.

Evidence from a live run on this box, started 8:16 AM CT on 16 November 2026:

- `midnightntwrk/indexer-standalone:4.4.101` is public (Docker Hub and GHCR, digest `sha256:119f35db548ba1c390845f215bb1e928e73038bef7c315825aee0461bd54499d`). It accepts `APP__APPLICATION__NETWORK_ID=preprod` and indexes ledger 8 and the ledger 9 fork. Wallet SDK 2.0.0 and Midnight.js 5.0.0 require this 4.4.101 line.
- The hosted indexer `https://indexer.preprod.midnight.network/api/v4/graphql` still returns HTTP 410 `ENDPOINT_DECOMMISSIONED`.
- The hosted node `https://rpc.preprod.midnight.network` and `wss://rpc.preprod.midnight.network` still work, even though the [environment docs](https://docs.midnight.network/relnotes/network) say they were retired on 9 October 2026 and should not be relied on. On this run the node reported Midnight Node `2.1.101`, ledger `9.1.0.1` (runtime `specVersion` 2001100), chain name `Midnight Preprod`, archive RPCs enabled, and tip around height 3,445,663. WebSocket subscriptions (`chain_subscribeNewHeads`) work.
- The standalone indexer connected to that WebSocket, started at genesis (height 0), served GraphQL at `http://127.0.0.1:8088/api/v4/graphql`, and `/ready` correctly returned 503 until catch-up finishes. After about 2.7 minutes it was at height 211, a steady **1.3 blocks/s**, using about **2% CPU and 45 MiB RAM**. At that rate, 3.45 million blocks take **about 31 days**. Docs also say a public RPC is much slower than a local archive node.
- Disk grew to 22 MiB by height 211 (including SQLite WAL), or roughly 100 KiB/block in this early window. Later empty blocks should be smaller, but plan for tens of gigabytes and watch the data directory. A constant 100 KiB/block would exceed the free space on a 128 GB disk.
- No indexer errors or rate-limit responses were seen in that window.

## Running our own `midnight-node` instead

A self-hosted Preprod node is **not practical on a 16 GB / 128 GB box**.

Official [full node](https://docs.midnight.network/nodes/full-node) setup needs node 2.1.101 **and** a synced Cardano-db-sync PostgreSQL database (TLS only). The node verifies every Midnight block against that Cardano data and stalls with `Verification failed for block` without it. Cardano Preprod alone is documented at about 16 GB RAM and 40 GB disk (node + db-sync + Postgres). This box has 15.6 GB RAM and about 90 GB free, already half in use, so a Cardano stack plus a Midnight archive of 3.45 million blocks does not fit. There is no supported way to run `midnight-node` in Preprod mode against only the public Midnight RPC.

If you later run a local archive node on a larger machine, point `APP__INFRA__NODE__URL` at `ws://127.0.0.1:9944` and expect a much faster re-index.

## Pointing Midnight.js 5.0.0 and Wallet SDK 2.0.0 at it

Both already accept a self-hosted indexer and node. `networks.preprod(projectId)` is only a Blockfrost default; [midnight-js-utils](https://www.npmjs.com/package/@midnight-ntwrk/midnight-js-utils) says to build your own `MidnightNetwork` for other endpoints. Night Messenger's deploy script already does that when all four variables are set:

```bash
export MIDNIGHT_INDEXER_URL=http://127.0.0.1:8088/api/v4/graphql
export MIDNIGHT_INDEXER_WS_URL=ws://127.0.0.1:8088/api/v4/graphql/ws
export MIDNIGHT_NODE=https://rpc.preprod.midnight.network
export MIDNIGHT_NODE_WS=wss://rpc.preprod.midnight.network
```

Use the public RPC for the node URLs only while it still answers, or your own node if you have one. Wait until `curl http://127.0.0.1:8088/ready` returns HTTP 200 before deploying. GraphQL queries work during catch-up, but the index is incomplete.

## How to run

Needs Docker (the `docker` CLI and a running daemon). `docker compose` is optional; `start.sh` falls back to `docker run`.

```bash
./scripts/local-indexer/start.sh
./scripts/local-indexer/status.sh   # height, tip, rough ETA
./scripts/local-indexer/stop.sh     # keeps the data dir so the next start resumes
```

By default:

- Image: `midnightntwrk/indexer-standalone:4.4.101`
- API: `127.0.0.1:8088` only (not published on all interfaces)
- Data: `scripts/local-indexer/data/` (gitignored)
- Node: `wss://rpc.preprod.midnight.network`
- `APP__INFRA__SPO_NODE__BLOCKFROST_ID` is the required placeholder `dummy-not-using-spo`. That is not a sign-up and is not used for the DApp deploy path.

Override with env vars documented in `env.example`. On a Docker daemon without a bridge network (port publish silently fails), `start.sh` retries with `--network host` and still binds the API to 127.0.0.1.

## Test-only wallet

A fresh Preprod wallet seed belongs in a 0600 file **outside git**, never in this directory. Generate one with:

```bash
# prints only the public unshielded / tNIGHT address; never prints the seed
./scripts/local-indexer/generate-preprod-wallet.sh --out /path/to/night-messenger-preprod.env
# or: pnpm --filter @midnight-messenger/contracts preprod:wallet -- --out /path/to/night-messenger-preprod.env
```

The file contains `MIDNIGHT_WALLET_SEED` and `PRIVATE_STATE_PASSWORD`. Fund the printed address from the free Preprod faucet in a browser (captcha): https://midnight-tmnight-preprod.nethermind.dev/. Do not use this wallet on mainnet.
