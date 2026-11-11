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
  const inbox = await E.dmInboxId(A.member, B.member);
  const s = await E.seal(A, await E.publicIdentity(B), "hi", { inbox });
  const c = E.toHex(s.commitment);
  const r1 = await post("send", { sk: E.toHex(A.chainSecret), blind: s.payload.blind, inboxId: E.toHex(inbox), commitment: c, members: [E.toHex(A.member), E.toHex(B.member)] });
  assert.equal(r1.status, 200);
  const sent = await r1.json();
  assert.deepEqual(sent.txs.map((t) => t.circuit), ["createInbox", "addMember", "addMember", "postMessage"]);
  assert.equal(sent.receipt.authorTag, E.toHex(s.authorTag));
  assert.equal(JSON.stringify(sent).includes(E.toHex(A.chainSecret)), false, "public view never echoes secrets");

  assert.equal((await (await fetch(`${base}/v1/chain/posts/${c}`)).json()).receipts, "0");
  assert.equal((await post("ack", { sk: E.toHex(B.chainSecret), commitment: c })).status, 200);
  const view = await (await fetch(`${base}/v1/chain/posts/${c}`)).json();
  assert.equal(view.receipts, "1");
  assert.deepEqual(view.txs.map((t) => t.circuit), ["postMessage", "ackMessage"]);
  const again = await post("ack", { sk: E.toHex(B.chainSecret), commitment: c });
  assert.equal(again.status, 409);
  assert.match((await again.json()).error, /already acknowledged/);
  // a stranger cannot ack
  const C = await E.createIdentity("C");
  assert.equal((await post("ack", { sk: E.toHex(C.chainSecret), commitment: c })).status, 409);
  // second message reuses the inbox (no create/add)
  const s2 = await E.seal(B, await E.publicIdentity(A), "yo", { inbox });
  const r2 = await (await post("send", { sk: E.toHex(B.chainSecret), blind: s2.payload.blind, inboxId: E.toHex(inbox), commitment: E.toHex(s2.commitment), members: [] })).json();
  assert.deepEqual(r2.txs.map((t) => t.circuit), ["postMessage"]);
});

test("unknown commitments show posted:false; bad input is rejected", async () => {
  assert.equal((await (await fetch(`${base}/v1/chain/posts/${"0".repeat(64)}`)).json()).posted, false);
  assert.equal((await post("ack", { sk: "zz", commitment: "0" })).status, 400);
});
