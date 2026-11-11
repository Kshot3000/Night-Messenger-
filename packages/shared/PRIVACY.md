# Night Messenger — Privacy and implementation status

## Sample app (/app): local preview

The web app is a local product demo. Message text, conversation names, reactions, drafts, and preferences are stored as **readable data in browser localStorage**. Messages are not sent to another person, encrypted, committed to a blockchain, or accompanied by real proofs. Sample conversations are fictional.

A script or person with access to this origin's browser storage can read that data. Browser/device access control is not end-to-end encryption. Use sample content only. Local data does not synchronize across devices or browser tabs.

JSON exports and workspace backups are readable copies. Backup restore validates the workspace schema and requires confirmation before replacing current conversations. Reset restores the sample chats; clearing site data also removes profile/preferences. Downloaded files must be removed separately.

Optional wallet connection enumerates compatible `window.midnight` providers and uses `connect('preprod')` plus `getShieldedAddresses()`. It does not request a transaction, perform identity verification, or establish an encrypted messaging session. The shielded address is held in memory for the current app session. Disconnect clears that state; revoke site access in the wallet extension separately.

The original mobile starter and shared mock API are prototypes. Their mock message/proof values are not security guarantees.

## Private chat (/private) — implemented, testnet only, not audited

| Layer | What it does now | Status |
| --- | --- | --- |
| Encrypted transport | X25519 + HKDF-SHA-256 + AES-256-GCM (WebCrypto), Noise-X style sealed envelopes; sender key hidden from the relay; ciphertext-only relay (`apps/relay`) | Working |
| Keys at rest | Identity sealed with a non-extractable AES-GCM device key in IndexedDB; passphrase backup (PBKDF2-SHA-256, 600k) | Working |
| Commitments | SHA-256 of each envelope posted with `postEnvelope`; anonymous membership proof | Real Compact circuits + real ZK proofs locally; Preprod deploy pending |
| Delivery receipts | `ackDelivery` nullifier, one per member per message, public count at `/verify` | Same as above |
| Selective disclosure | Hiding author tag; recipient verifies sender; opt-in per-message authorship bundle; `revealAuthor` | Same as above |
| Identity and recovery | Single device; manual backup file | No multi-device sync |

See the root README for what is on-chain, what each party sees and known limits. The sample app (`/app`) described above is unchanged and still unencrypted.

A production release requires a reviewed protocol, key lifecycle, relay authentication, replay protection, deletion/retention policy, delivery semantics, and independent security review. Never treat a local preview indicator, wallet connection, or stubbed proof response as evidence that any of those systems exists.

Connector reference: [Midnight DApp Connector specification](https://github.com/midnightntwrk/midnight-dapp-connector-api/blob/main/docs/api/_media/SPECIFICATION.md).
