# Durable relay operator runbook

The durable relay is a separate entry point using SQLite WAL with
`synchronous=FULL`. A send is acknowledged after the commit. Run one
active process per database on a local persistent filesystem. The Preview
demo still uses `apps/relay/server.mjs` and its existing tunnel. Keep its
database, hostname and browser origin separate from any durable relay.

## Provision and start

Kyle or a designated operator provides the host, DNS, certificate and
private-key files, and mailbox capabilities. Keep plaintext capabilities
and TLS keys out of the repo, build output, command history and logs.
Provision two independent high-entropy base64url capabilities per mailbox
(32–128 characters). Share the read capability with the mailbox owner
and the write capability with approved contacts over a verified channel.
Anyone holding the write capability can submit envelopes for that
mailbox. Revoking a capability requires a policy change and restart.
This release uses operator provisioning, with no self-service enrollment.

The operator-managed JSON file contains `origins` (an array of exact
HTTPS browser origins), `ttlHours` (1–168, optional), and `mailboxes`
(an object keyed by the lowercase SHA-256 mailbox ID). Each mailbox
value has `readSha256` and `writeSha256`, lowercase SHA-256 hex digests
of the UTF-8 capability strings. The policy rejects shared capabilities,
wildcards and quick-tunnel origins. Share the write capability separately
from the public invite. Never share the read capability with contacts.

Set `NM_RELAY_DB`, `NM_RELAY_POLICY`, `NM_RELAY_TLS_CERT`, and
`NM_RELAY_TLS_KEY` to operator-owned file paths outside the source tree.
Run `pnpm --filter @midnight-messenger/relay start:durable` with Node
24 LTS under an unprivileged service user. The CLI requires TLS and
binds to `HOST=127.0.0.1`, `PORT=8443` by default. To expose it, use a
named certificate and a firewall-managed bind address or TCP passthrough.
Pass the original source IP where possible. If proxying TCP behind NAT,
the relay's IP rate limit is shared by all clients on that address.
Keep database and policy restrictive (0600, parent 0700), reserve disk
headroom for WAL and backups, disable request logs with paths or headers,
and configure the service manager to drain and restart on certificate or
policy rotation. Check the certificate chain, allowed browser origin, and
health before giving a user access. A TLS handshake and edge setup need
an operator check on the intended host.

## Protocol and quotas

The existing POST and GET mailbox message routes and response fields
remain. POST takes the write capability. GET and DELETE take the read
capability. Send it with `Authorization: Bearer …`. The browser uses
session memory at the selected stable HTTPS origin. POST of the same
envelope bytes to the same mailbox returns the same sequence,
commitment and receive time (201 first, 200 on retry). An accepted
POST indicates relay storage, with chain posting and receipt verification
separate. GET accepts `after` and `instance`, and returns `next`,
`instance` and `reset` with the existing message list. A missing or
obsolete instance ignores the supplied sequence. Restart or restore
changes the instance. The app de-duplicates replay by commitment or ID.

DELETE accepts one `commitment` query parameter on the same route.
It removes the live ciphertext and leaves a tombstone until the
original expiry, so a retry within retention cannot resurrect it.
After expiry a stale sender retry can be treated as a new submission.
This does not delete the recipient's browser copy or an on-chain
commitment. SQLite and backup copies have their own retention.

Defaults are 64 KiB sealed envelopes, 96 KiB request bodies, 50 messages
per page, 1,000 provisioned mailboxes, 500 rows per mailbox and 25,000
rows total. Tombstones count toward these limits. At the default SQLite
page size the database page ceiling is 512 MiB. The WAL and backups need
additional disk. A fixed minute window limits an IP to 240 requests
and a mailbox to 60 writes. HTTP 429 tells callers when to retry. HTTP
507 means a configured storage bound was reached. Monitor filesystem
free space, 429/507/503 counts and backup age without logging mailbox
paths, tokens or bodies. Increase limits only after measuring the intended
host and volume, including its WAL growth. A single active host is a
capacity and availability limit.

## Backup and restore

1. Schedule `pnpm --filter @midnight-messenger/relay backup:durable <live-db> <new-snapshot>`
   on the relay host. It takes a consistent SQLite online snapshot,
   checks the schema and SQLite integrity, and refuses to replace an
   existing destination. Encrypt backup storage and limit its readers.
2. Restore to a distinct staging database first. Check SQLite
   `PRAGMA quick_check`, validate a scoped test mailbox and note the
   snapshot time and rows acknowledged after that time that may be lost.
3. For a production restore, stop the service. Set `NM_RELAY_DB` to a
   fresh local copy of the checked snapshot, with no WAL or SHM from
   the old database. Keep the old database, WAL and SHM together for
   rollback. Start the service and check the new instance, quota
   behavior and that a previously seen sequence resets correctly.
4. Set backup retention with Kyle. Expired or deleted ciphertext can
   still exist in earlier backups or physical storage. This is not a
   secure-erasure guarantee. To roll back a restore, stop the service,
   point it back to the retained database and matching sidecars, and
   repeat the health and cursor checks.

## Metadata and abuse limits

The relay sees the recipient's mailbox ID (a hash of a public key),
ciphertext byte length, arrival and polling times, source IP, browser
origin and which mailbox and capability role were used. It can link
requests to a mailbox and correlate timing with activity elsewhere.
The encrypted sender-key field does not conceal the network source.
An invite holder who knows the public key can derive its mailbox ID.
The v1 envelope is opaque to the relay, so the service cannot evaluate
the contents or attest who wrote it. Endpoints, reverse proxies and
infrastructure operators may see additional network metadata. The
application writes no request log or IP history. The in-memory IP rate
counters roll over each minute. SQLite stores mailbox ID, commitment,
ciphertext and timestamps until expiry or deletion. Credential leakage
and denial by an authorized writer remain possible. Rotate capabilities
and investigate unexplained write volume before restoring traffic.

## Repeat the local capacity check

`pnpm --filter @midnight-messenger/relay load:durable 8 125` runs eight
concurrent clients against a disposable local SQLite database. It checks
1,000 accepted writes, retries a subset and reads every mailbox by pages.
The harness raises the minute quotas to measure storage and HTTP handling.
Report the observed JSON in the PR. It uses loopback HTTP and synthetic
envelopes, so it does not establish TLS, WAN, peak traffic or host SLOs.
