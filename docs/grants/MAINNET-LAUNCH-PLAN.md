# Night Messenger mainnet launch plan

Night Messenger is an unaudited Midnight Preview beta for encrypted
browser messages, publicly checkable commitments, and member receipts.
Mainnet remains disabled. The public beta uses sample data and disposable
test identities. The funded work would establish the proof, operations
and review evidence for a narrowly scoped initial production release.

## Milestones and acceptance

| Window after kickoff | Gate | Acceptance evidence |
| --- | --- | --- |
| Weeks 1–4 | Reproducible Ledger 9 artifacts and durable relay | Frozen install, type checks, lint, web export and all simulator tests at a named source SHA. Compact 0.36.1 full build with matching binding, ZKIR and key hashes. Successful local 9.0.2 proof report for every circuit. Repeat the relay load harness, exercise TLS and mailbox capabilities on the intended host, and record a timed backup restore with no lost rows up to the snapshot. |
| Weeks 5–8 | Preprod drill and independent review | Kyle provides a Blockfrost Midnight Preprod project and funded test wallet. Publish a redacted evidence pack with matching build fingerprint, contract address, six finalized drill steps, block heights, one receipt and author-tag check. Reviewer delivers a written assessment of the [threat model](THREAT-MODEL.md), with reproducible findings, prioritized repairs and explicit residual risk. |
| Weeks 9–12 | Close findings and prepare release approval | Fix and independently retest release blockers. Demonstrate a real two-client rehearsal on isolated Preprod origins, with local proving, relay replay, expired rows and a rollback exercise. Review the exact Mainnet SDK and proof artifacts, origins, wallet custody and spending estimate. Attach signed-off release fingerprint, operator checklist and approval record. Kyle decides whether and when to activate Mainnet. |

The timeline assumes test credentials, reviewer availability and
funding at kickoff. A failed gate pauses the next stage. The
[Preprod drill](../PREPROD-DRILL.md) and
[release runbook](../RELEASE-OPERATIONS.md) are the operator procedures.
The [durable relay runbook](../PRODUCTION-RELAY.md) explains capacity,
retention and restore limits. Launch remains contingent on review and
operator approval, even if all engineering milestones are delivered.

## Proposed budget in USD

These are planning rates and caps, subject to quotes and grant rules.
There is no contingency line. Preprod uses a test faucet. Any Mainnet
wallet funding or on-chain spend requires a separate quote, funding
source and Kyle’s approval after the drill.

| Line | Basis | USD | Covers |
| --- | --- | ---: | --- |
| Artifact and regression engineering | 24 h × $110 | $2,640 | Reproduce proofs, pin artifacts, maintain CI and produce release evidence. |
| Relay engineering and host drill | 48 h × $110 | $5,280 | Harden provisioning, measure host TLS and storage, and rehearse restore and abuse response. |
| Network and release engineering | 48 h × $110 | $5,280 | Preprod wallet/indexer integration, isolated origins, two-client drill and rollout rehearsals. |
| Review remediation | 32 h × $110 | $3,520 | Repair prioritized findings, write regression cases and document retest evidence. |
| Independent review | 48 h × $200 | $9,600 | Review protocol, Compact circuits, browser key handling, relay and deployment custody. |
| Independent retest | 16 h × $200 | $3,200 | Reproduce fixes and document release-blocking or accepted residual risks. |
| Relay instances | 2 × 3 months × $24 | $144 | Isolated Preprod and a limited production pilot, activated only after approval. |
| Encrypted backup storage | 3 months × $12 | $36 | Retained backups, restore drills and encrypted storage. |
| Indexer/RPC deployment service | 3 months × $40 maximum | $120 | Allowance for a capped provider tier if the free test quota is insufficient. Use measured requests and a quote before purchase. |
| Preprod tNIGHT and Mainnet transaction funding | Owner-provided or separately approved | $0 | No chain capital requested. Determine the DUST/fee requirement from the intended calls and approved run. |
| **Total requested ceiling** | | **$29,820** | **Engineering $16,720; review and retest $12,800; hosting and backups $180; deployment service $120.** |

The pilot has no revenue, adoption, or partner assumption in this
budget. Remove unneeded service capacity or unused work from the ask.
The Foundation and other programs may cap awards below this plan.
Kyle can apply for a funded subset with the remaining gates stated.

## Decisions and custody

Kyle owns the Blockfrost project, test wallet funding, reviewer budget,
threat-model sign-off, incident contacts and final deployment approval.
Keep test and Mainnet accounts and provider credentials separate.
The repository is the public place for working code and redacted
evidence. No secrets, user data, or private operator artifacts go there.
