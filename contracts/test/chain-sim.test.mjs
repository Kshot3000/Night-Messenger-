// SPDX-License-Identifier: Apache-2.0
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createChainSim } from "../sim/server.mjs";
import * as E from "../../packages/shared/src/e2ee.ts";

let sim, base;
before(async () => {
  ({ server: sim } = await createChainSim());
  await new Promise((r) => sim.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${sim.address().port}`;
});
after(() => sim.close());
const post = (p, body) => fetch(`${base}/v1/chain/${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

test("send -> public receipt view -> ack -> anyone sees the receipt count; double ack refused", async () => {
  const A = await E.createIdentity("A");
  const B = await E.createIdentity("B");
  const dm = await E.dmInboxes(A, await E.publicIdentity(B));
  const inbox = dm.mine;
  const s = await E.seal(A, await E.publicIdentity(B), "hi", { inbox });
  const c = E.toHex(s.commitment);
  // the inbox id is creator-bound: a wrong seed is refused before any circuit runs
  const bad = await post("send", { sk: E.toHex(A.chainSecret), blind: s.payload.blind, seed: E.toHex(new Uint8Array(32)), inboxId: E.toHex(inbox), commitment: c, members: [] });
  assert.equal(bad.status, 409);
  assert.equal((await (await fetch(`${base}/v1/chain/inboxes/${E.toHex(inbox)}`)).json()).exists, false);
  const r1 = await post("send", { sk: E.toHex(A.chainSecret), blind: s.payload.blind, seed: E.toHex(dm.seed), inboxId: E.toHex(inbox), commitment: c, members: [E.toHex(A.member), E.toHex(B.member)] });
  assert.equal(r1.status, 200);
  const sent = await r1.json();
  assert.deepEqual(sent.txs.map((t) => t.circuit), ["createInbox", "addMember", "addMember", "postEnvelope"]);
  assert.equal(sent.receipt.authorTag, E.toHex(s.authorTag));
  assert.equal(JSON.stringify(sent).includes(E.toHex(A.chainSecret)), false, "public view never echoes secrets");

  assert.equal((await (await fetch(`${base}/v1/chain/inboxes/${E.toHex(inbox)}`)).json()).exists, true);
  assert.equal((await (await fetch(`${base}/v1/chain/posts/${c}`)).json()).receipts, "0");
  // the sender cannot receipt their own message
  const self = await post("ack", { sk: E.toHex(A.chainSecret), commitment: c });
  assert.equal(self.status, 409);
  assert.match((await self.json()).error, /already acknowledged/);
  assert.equal((await post("ack", { sk: E.toHex(B.chainSecret), commitment: c })).status, 200);
  const view = await (await fetch(`${base}/v1/chain/posts/${c}`)).json();
  assert.equal(view.receipts, "1");
  assert.deepEqual(view.txs.map((t) => t.circuit), ["postEnvelope", "ackDelivery"]);
  const again = await post("ack", { sk: E.toHex(B.chainSecret), commitment: c });
  assert.equal(again.status, 409);
  assert.match((await again.json()).error, /already acknowledged/);
  const sum = await (await fetch(`${base}/v1/chain/summary`)).json();
  assert.deepEqual([sum.inboxes, sum.registrations, sum.envelopesPosted, sum.deliveryReceipts], ["1", "2", "1", "1"]);
  // a stranger cannot ack
  const C = await E.createIdentity("C");
  assert.equal((await post("ack", { sk: E.toHex(C.chainSecret), commitment: c })).status, 409);
  // second message reuses the inbox (no create/add)
  const s2 = await E.seal(B, await E.publicIdentity(A), "yo", { inbox });
  const r2 = await (await post("send", { sk: E.toHex(B.chainSecret), blind: s2.payload.blind, inboxId: E.toHex(inbox), commitment: E.toHex(s2.commitment), members: [] })).json();
  assert.deepEqual(r2.txs.map((t) => t.circuit), ["postEnvelope"]);
});

test("unknown commitments show posted:false; bad input is rejected", async () => {
  assert.equal((await (await fetch(`${base}/v1/chain/posts/${"0".repeat(64)}`)).json()).posted, false);
  assert.equal((await post("ack", { sk: "zz", commitment: "0" })).status, 400);
});
