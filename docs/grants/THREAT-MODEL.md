# Night Messenger threat model and review scope

**Status** · Unaudited Preview beta. This document scopes an independent
review and records expected properties and known limitations. It is
not evidence that an attack has been ruled out. Use disposable
identities and sample content on Preview.

**A compromise of a recipient’s static X25519 private key can expose
older messages if an attacker kept their envelopes. The protocol has
no forward-secrecy guarantee.** Fresh per-message ephemeral keys do
not change that limit. Browser compromise and backup theft can expose
more than relay compromise.

## Assets and adversaries

Protect message contents, recipient keys, Compact member secrets,
invite-to-identity mappings, mailbox capabilities, unshared evidence,
wallet custody and release artifacts. Consider an untrusted network,
malicious or unavailable relay, substituted invites, a malicious
member or inbox owner, compromised browser/origin/extension, upstream
indexer or prover, dependency changes and operator error. Availability
and anonymity from traffic analysis are outside the cipher's guarantees.

## Envelope and invite verification

The [v1 envelope code](../../packages/shared/src/e2ee.ts) uses WebCrypto.
The sender generates a fresh ephemeral X25519 key for each envelope.
HKDF-SHA-256 over ephemeral-to-recipient-static DH derives an
AES-256-GCM key for the sender's static public key. A second domain
uses the ephemeral DH and sender-to-recipient static DH to derive
the AES-256-GCM payload key. The AAD binds the version, ephemeral
key, recipient key and encrypted sender fields as applicable. Both
GCM IVs are 96 bits. The payload binds a message ID, claimed sender
name, timestamp, member commitment, inbox ID and author blind. The
on-chain commitment hashes the full encoded envelope.

An invite carries a display name, X25519 public key, member commitment
and derived mailbox ID. Parsing checks format and mailbox derivation.
That check does not authenticate the human identity behind an invite.
Contacts need a separate trusted channel to verify the complete invite,
including the member commitment. The recipient checks the decrypted
sender key and member against the verified invite and checks that
the inbox is one of the two pair-derived IDs. Unknown senders may be
displayed as unverified. The self-asserted display name gives no
identity proof. A recipient can compute the shared secrets for its own
conversation, so successful decryption by itself is not transferable
proof of who sent a message.

The reviewer should examine domain separation, all-zero DH rejection,
nonce generation, parser bounds and invalid inputs, invite substitution,
replay, and the transition from an unverified placeholder to a contact.
Check both the client binding and the Compact transcript before making
selective-authorship claims.

## Membership, receipts, and selective disclosure

The [Compact contract](../../contracts/src/night_messenger.compact)
stores salted member leaves in per-inbox historic trees. Inbox
creation is bound to a creator commitment and private seed. Owner
permissions gate add/remove/close. Removal rotates the inbox epoch:
all prior leaves stop proving for that inbox; the owner re-adds
remaining members. It preserves root history and does not delete
past ciphertext or renew encryption keys. Re-addition and an old
post’s acknowledgement eligibility should be examined under the
current epoch, along with capacity, in-flight proofs and closes.

A post proves possession of a current member leaf and records an
inbox ID, ciphertext commitment, sequence number and hiding author
tag. A post burns the poster’s receipt nullifier. An eligible other
member can acknowledge once per commitment under its nullifier.
The public counter reflects a contract acknowledgement. It does not
prove that a human read or understood the text. In a one-to-one chat
the sender can infer the other participant acknowledged it. In larger
sets the counter and transaction context still leak activity.

The recipient can compare the computed tag with the tag on the ledger.
Selective disclosure uses the commitment, member and blind for a
specific message. Opening those fields or using `revealAuthor`
deliberately gives up information for that post. Review the claims
made by the public receipt UI when the indexer is stale, a fallback
snapshot is used, or data is missing.

## Relay, network and browser storage

The relay receives a mailbox ID, ciphertext, length, IP address,
timing and browser origin. Mailbox IDs can be derived by anyone who
has the public key. Timing and public ledger activity can be correlated.
The relay may block, reorder, replay or drop deliveries. Hash checks
and authenticated encryption can detect altered ciphertext, with
availability and metadata leakage still in scope. The
[durable relay](../PRODUCTION-RELAY.md) adds capability-based
read/write rules and bounded retention. Theft of a capability
allows the actions that role grants until rotation. Database and
backup expiry cannot erase another party’s copy.

The browser wraps the identity and history with a non-extractable
AES-GCM device key in IndexedDB. Script with the app’s authority
can use that key. XSS, compromised builds, extensions and browser
profile access remain relevant. A separate passphrase identity
backup uses PBKDF2-SHA-256 with 600,000 iterations and AES-GCM.
Review entropy, passphrase strength, error handling, import bounds
and loss or compromise of a device. The legacy local sample app
is a separate demo and its stored text is unencrypted.

## Prover and deployment custody

Use local or in-page proving with verified artifacts where supported.
An external prover or hosted simulator can see private circuit
inputs, including member secret and blind. The simulator is a
loopback-only tool. Treat wallet software and signing prompts as
part of the trusted computing base. Document all public ledger
fields, wallet and fee linkability, and indexer availability
assumptions before launch.

Kyle controls credentials, wallets, network-specific deployment
approval and the exact source/contract/proof/export fingerprint.
Preprod and Mainnet use separate origins, stores and credentials.
Rollback can restore a matching web export and relay state; it cannot
undo a finalized transaction. Confirm spend limits, approval
procedure, custody recovery, evidence retention and incident steps
before a Mainnet deployment.

## Independent review outputs

Request a reproducible review of the envelope and invite cases,
circuit witness and disclosure invariants, epoch/nullifier behavior,
browser and proof-server secrets, relay authorization/abuse/deletion,
build supply chain and operator controls. Ask for pinned revisions,
reproduction steps, severity, repair recommendations, retest evidence
and any residual risks. Kyle signs off on the resulting limits and
release claims before authorizing either production traffic or funds.
