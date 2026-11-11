#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Read-only usage numbers for Night Messenger, straight from contract ledger
 * counters (no analytics, no trackers, no per-user data):
 *   inboxes, registrations (member leaves added), envelopes posted, delivery receipts.
 *
 *   node scripts/stats.mjs --sim http://127.0.0.1:8788
 *   node scripts/stats.mjs --contract <address>     (Preprod indexer; needs
 *       BLOCKFROST_MIDNIGHT_PREPROD_ID or MIDNIGHT_INDEXER_URL/_WS_URL and the
 *       @midnight-ntwrk/midnight-js-indexer-public-data-provider package)
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const arg = (k) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const sim = arg("--sim");
const address = arg("--contract");
if (sim) {
  const s = await (await fetch(`${sim.replace(/\/$/, "")}/v1/chain/summary`)).json();
  const { inboxes, registrations, envelopesPosted, deliveryReceipts } = s;
  console.log(JSON.stringify({ source: `chain simulator ${sim}`, inboxes, registrations, envelopesPosted, deliveryReceipts, at: new Date().toISOString() }, null, 2));
} else if (address) {
  const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "managed", "night_messenger");
  const { ledger } = await import(pathToFileURL(path.join(OUT, "contract", "index.js")).href);
  const { indexerPublicDataProvider } = await import("@midnight-ntwrk/midnight-js-indexer-public-data-provider");
  const { setNetworkId } = await import("@midnight-ntwrk/midnight-js-network-id");
  setNetworkId("preprod");
  const BF = process.env.BLOCKFROST_MIDNIGHT_PREPROD_ID ?? "";
  const q = BF ? `?project_id=${encodeURIComponent(BF)}` : "";
  const http = process.env.MIDNIGHT_INDEXER_URL || `https://midnight-preprod.blockfrost.io/api/v0${q}`;
  const ws = process.env.MIDNIGHT_INDEXER_WS_URL || `wss://midnight-preprod.blockfrost.io/api/v0/ws${q}`;
  const st = await indexerPublicDataProvider(http, ws).queryContractState(address);
  if (!st) throw new Error("contract not found on the indexer");
  const l = ledger(st.data ?? st);
  console.log(JSON.stringify({ source: `midnight-preprod ${address}`, inboxes: String(l.inboxCount), registrations: String(l.membersAdded), envelopesPosted: String(l.postCount), deliveryReceipts: String(l.deliveryCount), at: new Date().toISOString() }, null, 2));
} else {
  console.error("usage: stats.mjs --sim <url> | --contract <address>");
  process.exit(2);
}
