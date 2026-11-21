# Preprod deployment drill

Preprod currently has no recorded Night Messenger contract address.
Midnight retired its hosted Preprod indexer and RPC on October 9, 2026.
Use a [Blockfrost Midnight Preprod project](https://docs.midnight.network/relnotes/network).
The Preview demo is a separate network. A Mainnet project ID or a
Preview wallet is unusable for this drill.

## Offline preparation

1. Check out the reviewed release train at the agreed commit. Run
   `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm test:contracts`,
   `pnpm typecheck`, `pnpm lint`, and `pnpm build:web`.
2. Run `compact update 0.36.1` and `pnpm compile:contracts`.
   Compare the generated compiler manifest and proving artifacts with
   the checked-in [binding provenance](../apps/web/src/generated/night_messenger/README.md).
   Keep the full compiled output in the ignored managed directory.
3. Start `midnightntwrk/proof-server:9.0.2` on loopback only. Run
   `pnpm --filter @midnight-messenger/contracts prove:local` and retain
   a separate observed local proof report. The historical proof report
   is for the old image. A build without this proof run stays unapproved.
4. Run `pnpm drill:preprod --plan`. This reads configuration and lists
   missing inputs. It does not initialize the wallet, create member
   secrets, connect to the indexer, or write a deployment record.

## Kyle’s operator run

1. Provision the Blockfrost project ID and a dedicated Preprod-only
   test wallet. Request free tNIGHT from the
   [Preprod faucet](https://midnight-tmnight-preprod.nethermind.dev/).
   Check tNIGHT and expected DUST registration/cost before approval.
   Preserve a private operator run directory outside the checkout,
   with a parent that already exists. Avoid shell history and
   committed files when supplying sensitive values.
2. Provide `BLOCKFROST_MIDNIGHT_PREPROD_ID`,
   exactly one of `MIDNIGHT_WALLET_SEED` / `MIDNIGHT_WALLET_MNEMONIC`,
   `PRIVATE_STATE_PASSWORD` and `NM_PREPROD_RUN_DIR` through the
   local operator environment. Leave network endpoint overrides
   unset. The proof origin defaults to `http://127.0.0.1:6300`.
3. Verify the plan lists no missing inputs. Only after Kyle approves,
   set `NM_CONFIRM_PREPROD=execute-preprod-drill` and run
   `pnpm drill:preprod --execute`. It checks artifact provenance and
   pins the run directory to that fingerprint. The existing deployment
   script syncs the test wallet, registers DUST if needed, deploys,
   creates one inbox, adds two members, posts a test commitment,
   acknowledges it, then re-reads the ledger.
4. Save the finalized transaction IDs and block heights, the contract
   address and the successful author-tag comparison and one receipt.
   The runner writes `release-fingerprint.json` once the record
   confirms all six steps. Review only that fingerprint and the public
   record before separately approving any update to
   `deployments/preprod.json`. The operator run directory also contains
   secrets and must never be submitted to GitHub.
5. If the run stops after a partial submission, preserve the run
   directory. Check transaction finality on Preprod before resuming
   against the same fingerprint and credentials. Starting with a
   new run directory can deploy a second contract. Do not advance the
   release while any confirmed step or artifact is missing.

The drill is credential- and approval-blocked. No Preprod or Mainnet
submission is claimed by this runbook.
