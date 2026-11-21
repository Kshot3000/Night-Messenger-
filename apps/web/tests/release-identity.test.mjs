// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildFingerprint, checkedProofManifest, readReleaseTarget, repoRoot } from "../../../scripts/release-identity.mjs";
import { preprodPlan } from "../../../scripts/preprod-drill.mjs";

test("Preview uses its recorded address; Preprod and Mainnet do not inherit Preview origins", () => {
  const preview = readReleaseTarget("preview");
  assert.equal(preview.status, "preview-beta");
  assert.match(preview.contractAddress, /^[0-9a-f]{64}$/);
  assert.equal(preview.relayMode, "published-demo");
  assert.equal(readReleaseTarget("preprod").contractAddress, null);
  assert.equal(readReleaseTarget("preprod").relayMode, "durable");
  assert.equal(readReleaseTarget("mainnet").siteOrigin, null);
  assert.equal(readReleaseTarget("mainnet").status, "disabled");
  assert.throws(() => readReleaseTarget("other"), /Select/);
});

test("the fingerprint binds checked-in bytes, target and address and exposes an empty proving slot", async () => {
  const hash = createHash("sha256").update(await readFile(join(repoRoot, "contracts/src/night_messenger.compact"))).digest("hex");
  const preview = buildFingerprint("preview");
  const mainnet = buildFingerprint("mainnet");
  assert.equal(preview.artifacts.compactSource, hash);
  assert.equal(mainnet.artifacts.proofManifest, null);
  assert.equal(mainnet.contractAddress, null);
  assert.notEqual(preview.id, mainnet.id);
  assert.notEqual(buildFingerprint("preprod").id, buildFingerprint("preprod", { contractAddress: "a".repeat(64) }).id);
  assert.deepEqual(buildFingerprint("preview"), preview);
  assert.throws(() => buildFingerprint("mainnet", { contractAddress: "a".repeat(64) }), /address/);
});

test("an unprepared Preprod plan names gates, excludes values, and rejects cross-network settings", () => {
  const plan = preprodPlan({});
  assert.ok(plan.missing.includes("BLOCKFROST_MIDNIGHT_PREPROD_ID"));
  assert.equal(plan.steps.length, 6);
  assert.equal(plan.proofOrigin, "http://127.0.0.1:6300");
  assert.throws(() => preprodPlan({ MIDNIGHT_NETWORK: "mainnet" }), /Preprod only/);
  assert.throws(() => preprodPlan({ MIDNIGHT_NODE: "https://node-fixture.test" }), /overrides/);
  assert.throws(() => preprodPlan({ MIDNIGHT_PROOF_SERVER: "https://prover-fixture.test" }), /loopback/);
});

test("proof manifest verification refuses stale, wrong-version, and missing files", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "nm-artifacts-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const fake = "synthetic test artifact";
  const hash = createHash("sha256").update(fake).digest("hex");
  for (const dir of ["compiler", "keys", "zkir"]) await mkdir(join(root, dir));
  await writeFile(join(root, "compiler/contract-manifest.json"), JSON.stringify({
    "compiler-version": "0.36.1", zkir: { "test.bzkir": { hash } },
    keys: { "test.verifier": { hash }, "test.prover": { hash } },
  }));
  for (const file of ["keys/test.verifier", "zkir/test.bzkir"]) await writeFile(join(root, file), fake);
  assert.throws(() => checkedProofManifest(root, { requireKeys: true }), /ENOENT/);
  assert.throws(() => checkedProofManifest(root, { expectedCompiler: "0.36.0" }), /pinned compiler/);
  await writeFile(join(root, "keys/test.prover"), fake);
  assert.equal(checkedProofManifest(root, { requireKeys: true }).circuits, 1);
  await writeFile(join(root, "zkir/test.bzkir"), "changed");
  assert.throws(() => checkedProofManifest(root, { requireKeys: true }), /differs/);
});
