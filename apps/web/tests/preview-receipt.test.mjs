// SPDX-License-Identifier: Apache-2.0
import { before, test } from "node:test";
import assert from "node:assert/strict";
import * as RT from "@midnight-ntwrk/compact-runtime";
import { Contract, pureCircuits as P } from "../src/generated/night_messenger/contract/index.js";
import { runCircuit } from "../../../contracts/lib/runtime.mjs";
import { decodePreviewReceipt, PREVIEW_CONTRACT_FALLBACK } from "../src/lib/preview-receipt.ts";

const coin = "0".repeat(64);
const b32 = (value) => new Uint8Array(32).fill(value);
const hex = (value) => Buffer.from(value).toString("hex");
const author = { sk: b32(1), blind: b32(2) };
const recipient = { sk: b32(3) };
const seed = b32(4);
const commitment = b32(5);
const member = P.memberCommitment(author.sk);
const inbox = P.inboxIdFor(member, seed);
const contractAddress = PREVIEW_CONTRACT_FALLBACK;
let stateHex;

before(async () => {
  const contract = new Contract({
    localSecretKey: ({ privateState }) => [privateState, privateState.sk],
    authorBlind: ({ privateState }) => [privateState, privateState.blind],
    memberPath: ({ privateState, ledger }, leaf) => [
      privateState, ledger.members.lookup(inbox).findPathForLeaf(leaf),
    ],
  });
  const { currentContractState } = await contract.initialState(RT.createConstructorContext(author, coin));
  for (const [who, name, args] of [
    [author, "createInbox", [seed]],
    [author, "addMember", [inbox, member]],
    [author, "addMember", [inbox, P.memberCommitment(recipient.sk)]],
    [author, "postEnvelope", [inbox, commitment]],
    [recipient, "ackDelivery", [commitment]],
  ]) {
    const result = await runCircuit(contract, { address: contractAddress, coin }, currentContractState.data, who, name, args);
    currentContractState.data = result.state;
  }
  stateHex = hex(currentContractState.serialize());
});

function stubIndexer(t, contract = { state: stateHex }) {
  const indexer = "https://indexer-fixture.test";
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, indexer);
    assert.equal(options.method, "POST");
    assert.equal(JSON.parse(options.body).variables.a, contractAddress);
    return Response.json({ data: { block: { height: 10 }, contract } });
  });
  return { indexer, contractAddress };
}

test("receipt decoder reads a locally simulated post and receipt through the indexer response shape", async (t) => {
  const result = await decodePreviewReceipt(hex(commitment), stubIndexer(t));
  assert.deepEqual(result, {
    source: "preview-ledger", commitment: hex(commitment), contractAddress,
    posted: true, receipts: "1", inboxId: hex(inbox), seq: "0", height: 10,
    authorTag: hex(P.authorTag(commitment, member, author.blind)),
  });
});

test("an unknown commitment is not posted", async (t) => {
  const result = await decodePreviewReceipt(hex(b32(0)), stubIndexer(t));
  assert.equal(result.posted, false);
  assert.equal(result.commitment, hex(b32(0)));
});

test("an indexer without the configured contract yields no receipt", async (t) => {
  await assert.rejects(decodePreviewReceipt(hex(commitment), stubIndexer(t, null)), /contract was not found/);
});
