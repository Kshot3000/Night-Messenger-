# Generated Compact output

This is the canonical checked-in copy for the web decoder and the contract
simulators. A full Compact 0.36.1 build reproduced both checked-in files
byte for byte from the unchanged `contracts/src/night_messenger.compact`.
`provenance.json` records the source, compiler and generated artifact hashes.
The build generated ZKIR and prover/verifier material for all seven circuits.
Proof-server verification against 9.0.2 remains a separate check.

From the repository root after the pinned Compact CLI is installed:

```bash
compact update 0.36.1
pnpm install --frozen-lockfile
pnpm compile:contracts
node scripts/compact-bindings.mjs --refresh
pnpm test:contracts
```

Review and commit the source, binding changes, and provenance together.
CI checks source and binding hashes and runs simulation from a clean checkout.
It does not run the compiler. Proving keys stay in the ignored managed output.
Keep the historical Preview artifacts with their original deployment until
compatibility with the on-chain verifier keys is established.
