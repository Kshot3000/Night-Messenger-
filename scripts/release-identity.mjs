// SPDX-License-Identifier: Apache-2.0
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const repoRoot = fileURLToPath(new URL("../", import.meta.url));
export const NETWORKS = ["preview", "preprod", "mainnet"];
const HEX = /^[0-9a-f]{64}$/;
const source = "contracts/src/night_messenger.compact";
const bindings = "apps/web/src/generated/night_messenger/contract/";
const readJSON = (file) => JSON.parse(readFileSync(file, "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const digest = (file) => hash(readFileSync(file));

function origin(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.origin !== value ||
      url.hostname === "trycloudflare.com" || url.hostname.endsWith(".trycloudflare.com")) {
    throw new Error("Release origins must be exact HTTPS origins on stable hosts");
  }
  return value;
}

export function readReleaseTarget(network, root = repoRoot) {
  if (!NETWORKS.includes(network)) throw new Error("Select preview, preprod, or mainnet");
  const targets = NETWORKS.map((tier) => {
    const target = readJSON(resolve(root, "deployments/targets", tier + ".json"));
    if (target.network !== tier) throw new Error("Release target does not match its network");
    for (const key of ["siteOrigin", "relayOrigin", "indexerOrigin"]) {
      if (target[key] !== null) origin(target[key]);
    }
    return target;
  });
  const origins = targets.flatMap((entry) => [entry.siteOrigin, entry.relayOrigin]).filter(Boolean);
  if (new Set(origins).size !== origins.length) throw new Error("App and relay origins must be separate across release targets");
  const target = targets.find((entry) => entry.network === network);
  const record = target.deploymentRecord ? readJSON(resolve(root, target.deploymentRecord)) : null;
  if (record && record.network !== "midnight-" + network) throw new Error("Deployment record belongs to another network");
  const contractAddress = record?.contractAddress ?? target.contractAddress ?? null;
  if (contractAddress !== null && !HEX.test(contractAddress)) throw new Error("Invalid release contract address");
  if (network === "mainnet" && (target.status !== "disabled" || contractAddress ||
      target.siteOrigin || target.relayOrigin || target.indexerOrigin)) {
    throw new Error("Mainnet is disabled in this repository");
  }
  return { ...target, contractAddress };
}

/** Check the binary circuits and matching verifier/prover material against the compiler manifest. */
export function checkedProofManifest(directory, { requireKeys = false, requireBindings = false, expectedCompiler } = {}) {
  const file = resolve(directory, "compiler/contract-manifest.json");
  const manifest = readJSON(file);
  if (expectedCompiler && manifest["compiler-version"] !== expectedCompiler) {
    throw new Error("Proof artifacts do not match the pinned compiler");
  }
  const circuits = Object.keys(manifest.zkir ?? {}).filter((key) => key.endsWith(".bzkir"));
  if (circuits.length === 0) throw new Error("Proof artifacts contain no circuits");
  const verify = (dir, name) => {
    if (digest(resolve(directory, dir, name)) !== manifest[dir]?.[name]?.hash) {
      throw new Error("Artifact differs from compiler manifest at " + dir + "/" + name);
    }
  };
  if (requireBindings) {
    verify("contract", "index.js");
    verify("contract", "index.d.ts");
  }
  for (const ir of circuits) {
    const stem = ir.slice(0, -".bzkir".length);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(stem)) throw new Error("Invalid circuit name");
    verify("zkir", ir);
    verify("keys", stem + ".verifier");
    if (requireKeys) verify("keys", stem + ".prover");
  }
  return { compiler: manifest["compiler-version"], sha256: digest(file), circuits: circuits.length };
}

export function buildFingerprint(network, { root = repoRoot, contractAddress, proof = null } = {}) {
  const target = readReleaseTarget(network, root);
  const address = contractAddress ?? target.contractAddress;
  if ((address !== null && !HEX.test(address)) || (network === "mainnet" && address !== null)) {
    throw new Error("Invalid contract address for release target");
  }
  const matrix = readJSON(resolve(root, "toolchain.json"));
  const body = {
    schema: 1,
    network,
    status: target.status,
    contractAddress: address,
    siteOrigin: target.siteOrigin,
    relayOrigin: target.relayOrigin,
    artifacts: {
      compactSource: digest(resolve(root, source)),
      bindingJs: digest(resolve(root, bindings, "index.js")),
      bindingTypes: digest(resolve(root, bindings, "index.d.ts")),
      proofManifest: proof?.sha256 ?? null,
    },
    targetCompiler: matrix.compact.compiler,
    proofCompiler: proof?.compiler ?? null,
  };
  return { ...body, id: hash(JSON.stringify(body)) };
}

export function previewBuildFingerprint(root = repoRoot) {
  const zk = resolve(root, "apps/web/public/zk/night_messenger");
  const proof = existsSync(resolve(zk, "compiler/contract-manifest.json")) ?
    checkedProofManifest(zk, { requireKeys: true }) : null;
  return buildFingerprint("preview", { root, proof });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [network = "preview", destination] = process.argv.slice(2);
  const record = network === "preview" ? previewBuildFingerprint() : buildFingerprint(network);
  const output = JSON.stringify(record, null, 2) + "\n";
  if (destination) writeFileSync(destination, output, { flag: "wx" });
  else process.stdout.write(output);
}
