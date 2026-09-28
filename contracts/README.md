# Night Messenger — Contracts

Selective 1:1 DM contracts for [Midnight](https://midnight.network).

**Status:** stubs only. No Compact compile, no proof server, no deployed addresses.
Interfaces below describe the intended surface so Compact engineers can implement without inventing APIs in the app layer.

## Goals

1. **Commit** that a sealed message exists (binding commitment), without putting plaintext on-chain.
2. **Prove delivery** — recipient can produce a proof that they acknowledged commitment `C`.
3. **Selective disclosure** — prove membership or attributes (e.g. time bucket) without opening content.

## Intended circuit surface (TODO)

| Entry | Purpose | Public outputs (sketch) | Private witnesses (sketch) |
| --- | --- | --- | --- |
| `sendMessage` / `commitMessage` | Bind ciphertext commitment to thread + parties | `commitment`, `threadId` (or hash), epoch | ciphertext hash, salt, sender sk, recipient pk |
| `proveDelivery` | Attest receipt of `commitment` | `commitment`, `delivered=true` | recipient sk, ack nonce |
| `proveMembership` | Prove caller is party to thread | `threadId`, `isMember=true` | membership witness |
| `proveAttribute` | Disclose one allowed attribute | `attrKey`, `attrValue` / range | full attribute set, salt |

Exact Compact types, ledger schema, and nullifier rules are **TBD** — align with current Midnight Compact + ledger docs before implementing.

## TypeScript stub

See [`src/selective-dm.ts`](./src/selective-dm.ts) — clearly marked `TODO` / `unimplemented`.

## What must never go on-chain

- Message plaintext
- Session keys / Noise secrets
- Full participant lists beyond what a circuit explicitly discloses

## Implementation notes for engineers

- Prefer incremental circuits: commit first, then delivery, then attributes.
- App layer should call these only through a typed client; do not fake proof bytes in production paths.
- Wallet: dapps must enumerate `window.midnight` via `Object.values` / `Object.keys` (UUID injection keys) — never hardcode `mnLace`.

## License

Same as repo root (see root README).
