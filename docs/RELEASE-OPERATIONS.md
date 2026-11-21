# Release operations

| Target | Web and relay origins | Contract slot | Behavior |
| --- | --- | --- | --- |
| Preview | Existing GitHub Pages path and its demo relay | Recorded Preview address | Public, unaudited Preview beta |
| Preprod | Distinct team-controlled HTTPS hosts to be assigned by Kyle | Empty until drill evidence is reviewed | Locked web export. CLI drill requires Blockfrost and a funded test wallet. |
| Mainnet | Unassigned. Separate site and durable relay hosts required. | Empty | Disabled. The prepared export has no wallet, simulator, relay override or tunnel path. |

Checked-in slots live in `deployments/targets/`. Keep build output,
wallet storage, relay policy/data and backups isolated across the three
networks. Review exact origins and a network-specific allowlist before
any activation. Preview Pages stays on its existing publish path.

## Stamp and verify a build

Use `pnpm build:web` for the default Preview build. The app footer
displays the target, contract address slot, and SHA-256 hashes for the
Compact source and JS/type bindings. It includes a proof manifest hash
only when the build packages checked proving artifacts. A null hash
means no such artifact was packaged. The fingerprint ID hashes that
record. It identifies these inputs and target settings, without
attesting the running ledger, a historical deployment, or the entire
export. Preserve the source commit and a separate digest of the final
export with deployment evidence.

`pnpm build:release preprod` and `pnpm build:release mainnet` produce
locked, noindex builds for local inspection in `apps/web/out`. Each
export removes Preview deployment, relay, and proving assets, scans
the exported HTML and JS for Preview transport controls, and writes
`release-fingerprint.json`. They do not upload, start a relay, or
initiate any transaction. A locked build cannot be used as the
functional release. Network-specific browser wallet and indexer
integration with the reviewed contract remains an activation gate.

For each approved publication archive its `release-fingerprint.json`,
source SHA, static export digest, approved origins, artifact manifest,
rollback export, and test evidence in Kyle's release record. The
Preview Pages packager writes the JSON alongside the export. Historical
records in `deployments/` are evidence of the runs they describe.
Do not backfill a proof artifact hash on a historical deployment
unless the original bytes can be authenticated.

## Incidents and rollback

1. On mismatched fingerprints, suspected credential leakage, unexpected
   commitments or receipt divergence, pause rollout. Kyle isolates the
   affected origin and blocks writes at the relay or edge. Use a status
   page if no known-good release can safely handle traffic. Keep the
   Preview beta and other networks isolated.
2. Record the incident time, target, served fingerprint and export
   digest, public transaction IDs where relevant, relay status codes
   and database/backup generation. Restrict incident evidence. Keep
   session tokens, wallet secrets, bodies and mailbox or IP logs
   out of public reports. An envelope-key incident can expose older
   messages. Rotate affected credentials and notify affected users
   according to Kyle's incident process.
3. Restore a reviewed previous frontend and matching artifact set for
   the exact same network and contract, or continue to serve the status
   page. A frontend rollback cannot undo on-chain transactions. New
   contract deployments or state-changing repairs require new approval.
   For storage rollback use the [durable relay runbook](PRODUCTION-RELAY.md).
4. Confirm the previous fingerprint from the served page, rehearse an
   isolated two-client delivery and replay check, verify contract and
   receipt data on the intended network under Kyle's approval, and
   document the cause and remediation before reopening writes. Keep
   the compromised release out of the rollback set.

See the [Preprod drill](PREPROD-DRILL.md) for evidence and owner actions.
