// SPDX-License-Identifier: Apache-2.0
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { buildFingerprint, checkedProofManifest, repoRoot } from "./release-identity.mjs";

const required = [
  "BLOCKFROST_MIDNIGHT_PREPROD_ID", "PRIVATE_STATE_PASSWORD", "NM_PREPROD_RUN_DIR",
];
const endpointOverrides = ["MIDNIGHT_INDEXER_URL", "MIDNIGHT_INDEXER_WS_URL", "MIDNIGHT_NODE", "MIDNIGHT_NODE_WS"];
const steps = ["deploy", "createInbox", "addMember_alice", "addMember_bob", "postEnvelope", "ackDelivery"];
const hex = /^[0-9a-f]{64}$/i;
const readJSON = (file) => JSON.parse(readFileSync(file, "utf8"));
const json = (data) => JSON.stringify(data, null, 2) + "\n";

export function preprodPlan(env, root = repoRoot) {
  const artifacts = resolve(root, "contracts/src/managed/night_messenger");
  const fingerprint = buildFingerprint("preprod", { root });
  const missing = required.filter((name) => !env[name]?.trim());
  const wallets = Number(Boolean(env.MIDNIGHT_WALLET_SEED?.trim())) +
    Number(Boolean(env.MIDNIGHT_WALLET_MNEMONIC?.trim()));
  if (wallets !== 1) missing.push("exactly one Preprod wallet seed or mnemonic");
  if (!existsSync(join(artifacts, "compiler", "contract-manifest.json"))) missing.push("full Compact build");
  let proof;
  try { proof = new URL(env.MIDNIGHT_PROOF_SERVER ?? "http://127.0.0.1:6300"); }
  catch { throw new Error("Use a loopback proof-server origin for the Preprod drill"); }
  if (proof.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(proof.hostname) ||
      proof.origin !== proof.href.replace(/\/$/, "")) {
    throw new Error("Use a loopback proof-server origin for the Preprod drill");
  }
  if (env.MIDNIGHT_NETWORK && env.MIDNIGHT_NETWORK !== "preprod") throw new Error("This drill is Preprod only");
  if (endpointOverrides.some((name) => env[name])) throw new Error("Remove endpoint overrides; the drill uses Blockfrost Midnight Preprod");
  return { artifacts, fingerprint, missing, proofOrigin: proof.origin, steps };
}

function checkRunDirectory(directory) {
  if (!isAbsolute(directory)) throw new Error("NM_PREPROD_RUN_DIR must be an absolute path outside the repository");
  // Resolve an existing parent before creating anything at the supplied path.
  const absolute = resolve(directory);
  const parent = realpathSync(resolve(absolute, ".."));
  const target = existsSync(absolute) ? realpathSync(absolute) : join(parent, basename(absolute));
  const fromRepo = relative(realpathSync(repoRoot), target);
  if (!fromRepo || (!isAbsolute(fromRepo) && fromRepo !== ".." && !fromRepo.startsWith(".." + sep))) {
    throw new Error("Use a private Preprod run directory outside the repository");
  }
  return target;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args[0] && !["--plan", "--execute"].includes(args[0]))) {
    throw new Error("Usage: pnpm drill:preprod [--plan|--execute]");
  }
  if (args[0] === "--execute" && process.env.NM_CONFIRM_PREPROD !== "execute-preprod-drill") {
    throw new Error("Kyle must approve --execute with NM_CONFIRM_PREPROD=execute-preprod-drill");
  }
  const plan = preprodPlan(process.env);
  if (args[0] !== "--execute") {
    process.stdout.write(json({
      network: "preprod",
      mode: "offline plan",
      missing: plan.missing,
      steps: plan.steps,
      targetCompiler: plan.fingerprint.targetCompiler,
    }));
    return;
  }
  if (plan.missing.length) throw new Error("Missing prerequisites: " + plan.missing.join(", "));
  const proof = checkedProofManifest(plan.artifacts, {
    requireKeys: true, requireBindings: true, expectedCompiler: plan.fingerprint.targetCompiler,
  });
  const prov = readJSON(join(repoRoot, "apps/web/src/generated/night_messenger/provenance.json"));
  if (prov.compilerManifestSha256 !== proof.sha256 ||
      prov.bindings["contract/index.js"] !== plan.fingerprint.artifacts.bindingJs ||
      prov.sourceSha256 !== plan.fingerprint.artifacts.compactSource) {
    throw new Error("Compiled Preprod artifacts do not match the checked-in source and provenance");
  }
  const pinned = buildFingerprint("preprod", { proof });
  const directory = checkRunDirectory(process.env.NM_PREPROD_RUN_DIR);
  process.umask(0o077);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const anchor = join(directory, "drill-identity.json");
  if (existsSync(anchor)) {
    if (readJSON(anchor).id !== pinned.id) throw new Error("Use a new run directory after an artifact or target change");
  } else {
    if (existsSync(join(directory, "night-messenger-preprod-run.json"))) throw new Error("Existing run has no trusted fingerprint");
    writeFileSync(anchor, json(pinned), { flag: "wx", mode: 0o600 });
  }
  const publicRecord = join(directory, "public-record.json");
  const result = spawnSync(process.execPath, [
    "--experimental-strip-types", "--no-warnings", join(repoRoot, "contracts/preprod/night-messenger-preprod.mjs"),
  ], {
    cwd: directory, stdio: "inherit",
    env: { ...process.env, MIDNIGHT_NETWORK: "preprod", MIDNIGHT_PROOF_SERVER: plan.proofOrigin,
      NM_OUT: plan.artifacts, NM_SECRETS: directory, NM_PUBLIC_RECORD: publicRecord,
      NM_E2EE: join(repoRoot, "packages/shared/src/e2ee.ts") },
  });
  if (result.status !== 0) throw new Error("Preprod drill did not finish. Preserve the run directory for review.");
  const record = readJSON(publicRecord);
  if (record.network !== "midnight-preprod" || record.status !== "deployed-drill-passed" ||
      !hex.test(record.contractAddress ?? "") || record.check?.authorTagMatches !== true || record.check?.acks !== "1" ||
      steps.some((step) => !hex.test(record.txs?.[step]?.txId ?? "") || !Number.isSafeInteger(record.txs[step].blockHeight))) {
    throw new Error("Drill output did not establish all six confirmed steps and the expected receipt");
  }
  const completed = buildFingerprint("preprod", { contractAddress: record.contractAddress.toLowerCase(), proof });
  writeFileSync(join(directory, "release-fingerprint.json"), json(completed), { mode: 0o600 });
  console.log("Preprod drill evidence ready for Kyle to review, fingerprint " + completed.id);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main();
