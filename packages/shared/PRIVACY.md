# Night Messenger — Privacy and implementation status

## Today: local preview

The web app is a local product demo. Message text, conversation names, reactions, drafts, and preferences are stored as **readable data in browser localStorage**. Messages are not sent to another person, encrypted, committed to a blockchain, or accompanied by real proofs. Sample conversations are fictional.

A script or person with access to this origin's browser storage can read that data. Browser/device access control is not end-to-end encryption. Use sample content only. Local data does not synchronize across devices or browser tabs.

JSON exports and workspace backups are readable copies. Backup restore validates the workspace schema and requires confirmation before replacing current conversations. Reset restores the sample chats; clearing site data also removes profile/preferences. Downloaded files must be removed separately.

Optional wallet connection enumerates compatible `window.midnight` providers and uses `connect('preprod')` plus `getShieldedAddresses()`. It does not request a transaction, perform identity verification, or establish an encrypted messaging session. The shielded address is held in memory for the current app session. Disconnect clears that state; revoke site access in the wallet extension separately.

The original mobile starter and shared mock API are prototypes. Their mock message/proof values are not security guarantees. Contracts are unimplemented interfaces.

## Intended architecture — not implemented

| Layer | Intended behavior | Current status |
| --- | --- | --- |
| Encrypted transport | Authenticated key agreement, per-device keys, ciphertext relay | Not implemented |
| Optional commitments | Commit to message existence without putting plaintext on-chain | Contract stubs only |
| Selective disclosure | Prove a specific fact without revealing surrounding conversation | No real proof generation |
| Identity and recovery | Verify peers, manage devices, recover safely | Not implemented |

A production release requires a reviewed protocol, key lifecycle, relay authentication, replay protection, deletion/retention policy, delivery semantics, and independent security review. Never treat a local preview indicator, wallet connection, or stubbed proof response as evidence that any of those systems exists.

Connector reference: [Midnight DApp Connector specification](https://github.com/midnightntwrk/midnight-dapp-connector-api/blob/main/docs/api/_media/SPECIFICATION.md).
