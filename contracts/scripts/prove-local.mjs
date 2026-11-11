#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Real ZK proofs for every Night Messenger circuit against a local proof
 * server (default http://127.0.0.1:6300, Docker image
 * midnightntwrk/proof-server 8.1.0). Runs createInbox -> addMember x2 ->
 * postEnvelope -> ackDelivery -> revealAuthor -> removeMember -> closeInbox in
 * the compact-runtime simulator, then asks the proof server to /check and
 * /prove each call with the full-ZK keys from `pnpm compile`.
 * No wallet, nothing submitted. Prints sizes and timings only (no secrets).
 */
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as RT from "@midnight-ntwrk/compact-runtime";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { httpClientProvingProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "managed", "night_messenger");
const PROOF = process.env.MIDNIGHT_PROOF_SERVER ?? "http://127.0.0.1:6300";
if (!existsSync(path.join(OUT, "keys", "postEnvelope.prover"))) throw new Error("no prover keys: run `pnpm compile` (full ZK build) first");
if (!(await fetch(`${PROOF}/health`).then((r) => r.ok).catch(() => false))) throw new Error(`proof server ${PROOF} is not healthy (docker run -p 6300:6300 midnightntwrk/proof-server:8.1.0 -- midnight-proof-server -v)`);
setNetworkId("preprod");

const { Contract, pureCircuits: P } = await import(path.join(OUT, "contract", "index.js"));
const b32 = () => new Uint8Array(randomBytes(32));
const witnesses = {
  localSecretKey: ({ privateState }) => [privateState, privateState.sk],
  memberPath: ({ privateState, ledger: l }, leaf) => [privateState, l.members.findPathForLeaf(leaf)],
  authorBlind: ({ privateState }) => [privateState, privateState.blind ?? new Uint8Array(32)],
};
const contract = new Contract(witnesses);
const COIN = "0".repeat(64);
const ADDR = RT.sampleContractAddress();
const owner = { sk: b32() };
let state = contract.initialState(RT.createConstructorContext(owner, COIN)).currentContractState.data;
const prover = httpClientProvingProvider(PROOF, new NodeZkConfigProvider(OUT), { timeout: 600_000 });
const report = [];
async function proveCall(ps, name, args) {
  const r = contract.impureCircuits[name](RT.createCircuitContext(ADDR, COIN, state, ps), ...args);
  state = r.context.currentQueryContext.state;
  const pd = r.proofData;
  const pre = RT.proofDataIntoSerializedPreimage(pd.input, pd.output, pd.publicTranscript, pd.privateTranscriptOutputs, name);
  const t0 = Date.now();
  await prover.check(pre, name);
  const t1 = Date.now();
  const proof = await prover.prove(pre, name);
  const t2 = Date.now();
  if (!(proof instanceof Uint8Array) || !proof.byteLength) throw new Error(`${name}: empty proof`);
  report.push({ circuit: name, preimageBytes: pre.byteLength, proofBytes: proof.byteLength, checkMs: t1 - t0, proveMs: t2 - t1 });
  console.error(`proved ${name}: ${proof.byteLength} B in ${t2 - t1} ms`);
}

const inbox = b32();
const alice = { sk: b32() }, bob = { sk: b32() };
const c = b32(), blind = b32();
await proveCall(owner, "createInbox", [inbox]);
await proveCall(owner, "addMember", [inbox, P.memberCommitment(alice.sk)]);
await proveCall(owner, "addMember", [inbox, P.memberCommitment(bob.sk)]);
await proveCall({ ...alice, blind }, "postEnvelope", [inbox, c]);
await proveCall(bob, "ackDelivery", [c]);
await proveCall({ ...alice, blind }, "revealAuthor", [c]);
await proveCall(owner, "removeMember", [inbox, P.memberCommitment(bob.sk)]);
await proveCall(owner, "closeInbox", [inbox]);
console.log(JSON.stringify({ claim: "local ZK proofs against the proof server; not submitted, not a deploy", compiler: "compactc 0.31.1", runtime: "@midnight-ntwrk/compact-runtime 0.16.0", proofServer: PROOF, at: new Date().toISOString(), proofs: report }, null, 2));
