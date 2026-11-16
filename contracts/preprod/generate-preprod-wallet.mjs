#!/usr/bin/env node
/**
 * Generate a TEST-ONLY Midnight Preprod wallet seed and a random
 * PRIVATE_STATE_PASSWORD. Writes them to a 0600 file outside git and prints
 * only the public unshielded / tNIGHT address. Never prints the seed.
 *
 * Usage:
 *   node scripts/local-indexer/generate-preprod-wallet.mjs --out /path/to/night-messenger-preprod.env
 *
 * Refuses to overwrite an existing file unless --force is passed.
 */
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createKeystore, NetworkId, WalletSeeds } from "@midnightntwrk/wallet-sdk";

const args = process.argv.slice(2);
const force = args.includes("--force");
const outIdx = args.indexOf("--out");
const outFile = outIdx >= 0 ? args[outIdx + 1] : "";
if (!outFile) {
  console.error("usage: node generate-preprod-wallet.mjs --out /path/to/night-messenger-preprod.env [--force]");
  process.exit(2);
}

const resolved = path.resolve(outFile);
if (fs.existsSync(resolved) && !force) {
  console.error(`refusing to overwrite ${resolved} (pass --force to replace it)`);
  process.exit(1);
}

const masterSeed = randomBytes(32);
const seeds = WalletSeeds.fromMasterSeed(masterSeed);
const keystore = createKeystore({ kind: "schnorr", secret: seeds.unshielded }, NetworkId.NetworkId.PreProd);
const rawAddr = keystore.getBech32Address();
const address = rawAddr?.asString?.() ?? String(rawAddr ?? "");
if (!address || address === "undefined") {
  throw new Error("failed to derive unshielded Preprod address");
}

// Meet midnight-js password rules: >=16 chars, >=3 classes, limited repeats.
const password = `Nm-${randomBytes(16).toString("hex")}-Aa1!`;
const body = [
  "# TEST-ONLY Midnight Preprod wallet for Night Messenger.",
  "# Never use on mainnet. Never commit this file. Do not spend real funds.",
  `# Generated: ${new Date().toISOString()}`,
  "# Network: preprod (ledger 9)",
  `# Unshielded / tNIGHT address: ${address}`,
  "",
  `MIDNIGHT_WALLET_SEED=${Buffer.from(masterSeed).toString("hex")}`,
  `PRIVATE_STATE_PASSWORD=${password}`,
  "",
].join("\n");

fs.mkdirSync(path.dirname(resolved), { recursive: true, mode: 0o700 });
const tmp = `${resolved}.tmp-${process.pid}`;
fs.writeFileSync(tmp, body, { mode: 0o600, flag: "w" });
fs.chmodSync(tmp, 0o600);
fs.renameSync(tmp, resolved);
fs.chmodSync(resolved, 0o600);
const st = fs.statSync(resolved);
if ((st.mode & 0o077) !== 0) {
  throw new Error("env file permissions are too open");
}

process.stdout.write(`${address}\n`);
