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
  const { networks } = await import("@midnight-ntwrk/midnight-js-utils");
  const { ContractState } = await import("@midnight-ntwrk/compact-runtime");
  const BF = process.env.BLOCKFROST_MIDNIGHT_PREPROD_ID ?? "";
  // networks.preprod puts the Blockfrost token on the URLs: never log them.
  const net = process.env.MIDNIGHT_INDEXER_URL
    ? { indexer: { queryURL: process.env.MIDNIGHT_INDEXER_URL, subscriptionURL: process.env.MIDNIGHT_INDEXER_WS_URL ?? "" } }
    : BF
      ? networks.preprod(BF)
      : null;
  if (!net) throw new Error("set BLOCKFROST_MIDNIGHT_PREPROD_ID (Blockfrost 'Midnight Preprod' project id) or MIDNIGHT_INDEXER_URL");
  const read = await indexerPublicDataProvider({ queryURL: net.indexer.queryURL, subscriptionURL: net.indexer.subscriptionURL }).queryContractState(address);
  if (!read) throw new Error("contract not found on the indexer");
  // Midnight.js 5 hands back serialized, era-tagged state; decode with the v9 runtime.
  const l = ledger(read.contractState.deserialize({ v9: ContractState }).data);
  console.log(JSON.stringify({ source: `midnight-preprod ${address}`, inboxes: String(l.inboxCount), registrations: String(l.membersAdded), envelopesPosted: String(l.postCount), deliveryReceipts: String(l.deliveryCount), at: new Date().toISOString() }, null, 2));
} else {
  console.error("usage: stats.mjs --sim <url> | --contract <address>");
  process.exit(2);
}
