# Night Messenger — Selective Privacy Model

High-level privacy architecture for 1:1 DMs on [Midnight](https://midnight.network).
Contract interfaces are stubs (`TODO`) until Compact circuits land.

## Layers at a glance

| Layer | What lives here | Who can see it |
| --- | --- | --- |
| **On-chain / proven** | Message existence commitments, optional sender/recipient membership proofs, user-chosen metadata attributes | Network / verifiers with the disclosed proof |
| **Off-chain / encrypted** | Message plaintext (E2EE between parties) | Only intended recipients with session keys |
| **Selective disclosure** | Proofs of delivery, conversation membership, or message attributes **without** revealing content | Parties / apps the user chooses to prove to |

Midnight’s ZK + selective disclosure model lets a user prove *facts about* a message (e.g. “I sent a sealed DM to this recipient before time T”) without opening the ciphertext.

## On-chain / proven

- **Message existence commitment** — a binding commitment (e.g. hash of ciphertext + salt + thread id) posted or witnessed on Midnight so existence can be proven later.
- **Sender / recipient proofs** — when needed, prove you are a party to a conversation (membership) without revealing other participants or content.
- **Optional metadata** — the user *opts in* to reveal attributes (timestamp bucket, thread tag, delivery flag). Nothing is public by default beyond what the circuit and policy allow.

> **TODO (contracts):** Compact circuits for `commitMessage`, `proveMembership`, `proveAttribute`. See `/contracts`.

## Off-chain / encrypted

- Message bodies are encrypted end-to-end between the two parties (device/session keys).
- Relays or indexers (when added) store only ciphertext + commitments — they cannot read plaintext.
- MVP uses local mock storage; real transport is stubbed.

> **TODO:** Noise/X3DH-style (or Midnight-native) key agreement; never invent fake crypto APIs in production paths.

## Selective disclosure

Users can disclose **proofs**, not plaintext:

1. **Proof of delivery** — “recipient acknowledged commitment C” without showing the body.
2. **Proof of membership** — “I am a party to thread T” without listing others.
3. **Proof of attributes** — e.g. message sent in a time window, marked urgent, or satisfying a policy — without opening content.

UI surfaces these as explicit actions (“Prove delivery”, “Disclose timestamp”) so disclosure is intentional.

## What is public vs private vs selective (MVP defaults)

| Data | Default |
| --- | --- |
| Wallet address (shielded) | Private; shown abbreviated in-app after connect |
| Conversation list | Local / private to device |
| Message plaintext | Private (E2EE); never on-chain |
| Existence commitment | On-chain when user sends (stubbed) |
| Delivery receipt | Selective — user opts to prove |
| Media / groups | Out of scope for MVP |

## Honesty for this MVP

- Wallet connect enumerates `window.midnight` via `Object.values` / `Object.keys` (not hardcoded `mnLace`).
- Contracts and proof calls are **stubs** labeled `TODO`.
- No real Midnight node, Compact compile, or proof server in this cut.
- Mock conversations appear when the wallet is not connected so UX can be explored.

## References

- Midnight docs: selective disclosure & DApp Connector
- Lace injects under UUID keys — enumerate providers; never hardcode `window.midnight.mnLace`
