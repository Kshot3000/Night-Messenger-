# Night Messenger — Compact contract

`src/night_messenger.compact` (compactc **0.31.1**, `pragma language_version >= 0.23`). Apache-2.0.

Private group inboxes on Midnight: salted member leaves in a `HistoricMerkleTree<16>`, anonymous `postEnvelope` with a hiding author tag, anonymous one-per-member `ackDelivery` receipts, opt-in `revealAuthor`, `removeMember` with root-history reset, `closeInbox`, and aggregate usage counters. Message bodies, keys and identities never touch the ledger. See the root README for the full table of what is public.

```bash
pnpm compile         # full build with proving keys -> src/managed/night_messenger (git-ignored)
pnpm compile:fast    # --skip-zk, for tests
pnpm test            # simulator tests for every circuit + the chain simulator
pnpm prove:local     # real proofs against proof server 8.1.0 on :6300 (docs/local-proofs.json)
pnpm demo            # terminal end-to-end demo (E2EE -> relay -> contract -> receipt)
pnpm sim             # HTTP chain simulator for the web demo (NM_PROOF_SERVER for real proofs)
pnpm stats -- --sim http://localhost:8788      # usage counters (or --contract <addr> on Preprod)
```

The pure helpers (`memberCommitment`, `memberLeaf`, `authorTag`, `ackNullifier`) are SHA-256 over the concatenated 32-byte fields, which is exactly what `persistentHash<Vector<n, Bytes<32>>>` computes; `packages/shared/src/e2ee.ts` mirrors them and a test checks they match.

Preprod: `preprod/night-messenger-preprod.mjs` deploys and runs a drill. Not run yet: it needs a funded Preprod wallet (tNIGHT + tDUST) and a Blockfrost Midnight Preprod project id.

Not audited. Testnet only.
