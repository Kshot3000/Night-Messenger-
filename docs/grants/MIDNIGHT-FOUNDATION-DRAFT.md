# DRAFT ONLY · Night Messenger launch and independent review

This is a proposal draft for Kyle. A live program, eligibility, award
cap, requested currency and submission form need confirmation.
Use current program requirements at submission time.

## Problem

Participant identity, message content and delivery evidence are often
bundled together. Night Messenger explores whether a sender can show
membership of a conversation and a recipient can acknowledge a
commitment while keeping message content out of the ledger. This is
a reference implementation for selective disclosure and verifiable
message receipts, with the [limits and trust assumptions](THREAT-MODEL.md)
visible to users.

## What exists today

The current public product is an unaudited Midnight Preview beta.
The implementation train is
[Night Messenger PR #1](https://github.com/Kshot3000/Night-Messenger-/pull/1),
the `feat/midnight-messaging` branch at `8d9f3ce`. Independent
verification on November 19, 2026 reported a passing frozen install,
type checks and ESLint, **57/57 web/shared/relay tests** and **13/13
Compact simulation tests** using the committed web bindings. These
are historical results on that tree. The release-readiness PRs record
their own results. The [Preview deployment record](../../deployments/preview.json)
has chain evidence for a disposable test deployment. The
[local proof report](../local-proofs.json) records an earlier local
proof run. Neither constitutes an independent security audit,
Preprod or Mainnet launch, production load proof, or user adoption.

The repo contains browser envelope encryption, the Compact contract,
Lace Preview flow, relay and receipt verifier. A durable relay and
isolated release exports are proposed on the launch-readiness train.
The milestone work will turn those pieces into a reviewed release
candidate rather than claim production usage based on a beta.

## Milestones and budget

1. Weeks 1–4. Reproduce Ledger 9 output and contract proofs, then
   test the durable relay on the intended host with TLS and restore.
2. Weeks 5–8. Record the Preprod deploy/post/ack drill and obtain an
   independent review with actionable findings.
3. Weeks 9–12. Fix and retest findings, prove the isolated release
   and rollback path, and give Kyle the evidence for an activation
   decision.

Proposed award ceiling **$29,820 USD**, comprising **$16,720**
engineering, **$12,800** independent review and retest, **$180**
relay hosting and backups, and **$120** capped deployment service.
The [launch plan](MAINNET-LAUNCH-PLAN.md) gives the itemized basis,
evidence gates and owner dependencies. No transaction funding is
part of this ask. Reduce the ask to fit the chosen program without
removing release safety gates.

## Team, license and public evidence

**Kyle Cox / Kshot Applications** is the applicant and release owner.
Public contact [@kshot9000](https://x.com/kshot9000) and
[kshot.tech](https://kshot.tech). Independent review is a proposed
budget item. No reviewer, partner or funding commitment is claimed.

The Compact contract, envelope implementation, relay and new
Midnight deliverables are open source under **Apache-2.0**. The
pre-existing sample app retains its **MIT** license and notices.
Receipts will be public commits, a reproducible build and test record,
the reviewed Preprod evidence, and the redacted review/retest summary
in [the repository](https://github.com/Kshot3000/Night-Messenger-).

The draft uses the problem, evidence, milestones, budget and team
sections appropriate to a Midnight ecosystem funding application.
The [Foundation](https://midnight.foundation/) and the published
[Midnight Compact DApps criteria](https://midnight.network/blog/how-to-get-involved-in-catalyst-fund15-s-midnight-category)
describe relevant open-source implementation and milestone criteria.
They do not establish an active round, eligibility, or an award.
Kyle reviews and submits the final application himself.
