#!/usr/bin/env node
/**
 * Generate a TEST-ONLY Midnight wallet seed and a random
 * PRIVATE_STATE_PASSWORD. Writes them to a 0600 file outside git and prints
 * only the public unshielded / tNIGHT address. Never prints the seed.
 *
 * Usage:
 *   node contracts/preprod/generate-preprod-wallet.mjs --out /path/to/night-messenger-preprod.env [--network preprod|preview]
 *   node contracts/preprod/generate-preprod-wallet.mjs --from-env /path/to/night-messenger-preprod.env --network preview
 *
 * --from-env derives and prints only the unshielded address for the given
 * network from an existing env file. It never writes, and never prints the seed.
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
const fromEnvIdx = args.indexOf("--from-env");
const fromEnv = fromEnvIdx >= 0 ? args[fromEnvIdx + 1] : "";
const netIdx = args.indexOf("--network");
const networkName = (netIdx >= 0 ? args[netIdx + 1] : process.env.MIDNIGHT_NETWORK ?? "preprod").trim().toLowerCase();
const NETWORK_IDS = {
  preprod: NetworkId.NetworkId.PreProd,
  preview: NetworkId.NetworkId.Preview,
};
const walletNetworkId = NETWORK_IDS[networkName];
if (!walletNetworkId) {
  console.error("MIDNIGHT_NETWORK / --network must be preview or preprod");
  process.exit(2);
}

function addressFromMasterSeed(masterSeed) {
  const seeds = WalletSeeds.fromMasterSeed(masterSeed);
  const keystore = createKeystore({ kind: "schnorr", secret: seeds.unshielded }, walletNetworkId);
  const rawAddr = keystore.getBech32Address();
  const address = rawAddr?.asString?.() ?? String(rawAddr ?? "");
  if (!address || address === "undefined") {
    throw new Error(`failed to derive unshielded ${networkName} address`);
  }
  return address;
}

function seedFromEnvFile(file) {
  const text = fs.readFileSync(file, "utf8");
  const m = text.match(/^MIDNIGHT_WALLET_SEED=([0-9a-fA-F]+)\s*$/m);
  if (!m) throw new Error("MIDNIGHT_WALLET_SEED not found in env file");
  const h = m[1];
  if (h.length % 2 !== 0) throw new Error("MIDNIGHT_WALLET_SEED must be even-length hex");
  return Buffer.from(h, "hex");
}

if (fromEnv) {
  if (!fromEnv || fromEnv.startsWith("-")) {
    console.error("usage: node generate-preprod-wallet.mjs --from-env /path/to/env [--network preview|preprod]");
    process.exit(2);
  }
  const address = addressFromMasterSeed(seedFromEnvFile(path.resolve(fromEnv)));
  process.stdout.write(`${address}\n`);
  process.exit(0);
}

if (!outFile) {
  console.error("usage: node generate-preprod-wallet.mjs --out /path/to/night-messenger-preprod.env [--network preprod|preview] [--force]");
  process.exit(2);
}

const resolved = path.resolve(outFile);
if (fs.existsSync(resolved) && !force) {
  console.error(`refusing to overwrite ${resolved} (pass --force to replace it)`);
  process.exit(1);
}

const masterSeed = randomBytes(32);
const address = addressFromMasterSeed(masterSeed);

// Meet midnight-js password rules: >=16 chars, >=3 classes, limited repeats.
const password = `Nm-${randomBytes(16).toString("hex")}-Aa1!`;
const body = [
  "# TEST-ONLY Midnight wallet for Night Messenger.",
  "# Never use on mainnet. Never commit this file. Do not spend real funds.",
  `# Generated: ${new Date().toISOString()}`,
  `# Network: ${networkName} (ledger 9)`,
  `# Unshielded / tNIGHT address (${networkName}): ${address}`,
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
