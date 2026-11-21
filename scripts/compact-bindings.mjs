// SPDX-License-Identifier: Apache-2.0
import { createHash } from "node:crypto";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const output = new URL("contracts/src/managed/night_messenger/", root);
const committed = new URL("apps/web/src/generated/night_messenger/", root);
const provenanceFile = new URL("provenance.json", committed);
const bindings = ["contract/index.js", "contract/index.d.ts"];
const matrix = JSON.parse(readFileSync(new URL("toolchain.json", root), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const textHash = (url) => sha256(readFileSync(url, "utf8").replaceAll("\r\n", "\n"));
const source = "contracts/src/night_messenger.compact";
const sourceSha256 = textHash(new URL(source, root));

if (process.argv.length > 2 && process.argv[2] !== "--refresh") {
  throw new Error("Usage: node scripts/compact-bindings.mjs [--refresh]");
}

if (process.argv[2] === "--refresh") {
  const bytes = readFileSync(new URL("compiler/contract-manifest.json", output));
  const manifest = JSON.parse(bytes);
  if (manifest["compiler-version"] !== matrix.compact.compiler ||
      manifest["runtime-version"] !== matrix.compact.runtime ||
      manifest["language-version"] !== matrix.compact.language) {
    throw new Error("The compiled artifacts do not match toolchain.json");
  }
  const artifacts = {};
  for (const [dir, entries] of [
    ["contract", bindings.map((file) => file.split("/")[1])],
    ["zkir", Object.keys(manifest.zkir ?? {}).filter((name) => name.endsWith(".bzkir"))],
    ["keys", Object.keys(manifest.keys ?? {}).filter((name) => name.endsWith(".verifier") || name.endsWith(".prover"))],
  ]) {
    if (entries.length === 0) throw new Error(`Missing ${dir} in the full-build manifest`);
    for (const name of entries.sort()) {
      const file = `${dir}/${name}`;
      const hash = sha256(readFileSync(new URL(file, output)));
      if (hash !== manifest[dir]?.[name]?.hash) throw new Error(`Compiler manifest hash mismatch: ${file}`);
      artifacts[file] = hash;
    }
  }
  const circuits = Object.keys(artifacts).filter((file) => file.startsWith("zkir/"));
  for (const file of circuits) {
    const circuit = file.slice("zkir/".length, -".bzkir".length);
    if (!artifacts[`keys/${circuit}.prover`] || !artifacts[`keys/${circuit}.verifier`]) {
      throw new Error(`Missing proving artifacts for ${circuit}. Run the full compile first.`);
    }
  }
  for (const binding of bindings) copyFileSync(new URL(binding, output), new URL(binding, committed));
  writeFileSync(provenanceFile, JSON.stringify({
    source,
    sourceSha256,
    compiler: manifest["compiler-version"],
    compilerCommit: manifest["compiler-commit"],
    runtime: manifest["runtime-version"],
    compilerManifestSha256: sha256(bytes),
    bindings: Object.fromEntries(bindings.map((file) => [file, textHash(new URL(file, committed))])),
    circuits: Object.fromEntries(Object.entries(artifacts).filter(([file]) => !bindings.includes(file))),
  }, null, 2) + "\n");
}

const record = JSON.parse(readFileSync(provenanceFile, "utf8"));
if (record.source !== source || record.sourceSha256 !== sourceSha256 ||
    record.compiler !== matrix.compact.compiler || record.runtime !== matrix.compact.runtime ||
    bindings.some((file) => record.bindings[file] !== textHash(new URL(file, committed)))) {
  throw new Error("Stale Compact bindings. Run pnpm compile:contracts and node scripts/compact-bindings.mjs --refresh.");
}
console.log(`Compact ${record.compiler} binding provenance matches the checked-in source and JS/types`);
