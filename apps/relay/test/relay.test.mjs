// SPDX-License-Identifier: Apache-2.0
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { createRelay } from "../server.mjs";

let server, base;
before(async () => {
  server = createRelay();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const box = createHash("sha256").update("bob").digest("hex");
const fakeEnvelope = (n = 200) => {
  const b = randomBytes(n);
  b[0] = 1;
  return b.toString("base64url");
};
const post = (mailbox, body, type = "application/json") =>
  fetch(`${base}/v1/mailboxes/${mailbox}/messages`, { method: "POST", headers: { "content-type": type }, body: typeof body === "string" ? body : JSON.stringify(body) });

test("health", async () => {
  const r = await fetch(`${base}/health`);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ok, true);
});

test("stores and returns envelopes in order with the SHA-256 commitment", async () => {
  const e1 = fakeEnvelope(), e2 = fakeEnvelope();
  const r1 = await (await post(box, { envelope: e1 })).json();
  const r2 = await (await post(box, { envelope: e2 })).json();
  assert.equal(r1.commitment, createHash("sha256").update(Buffer.from(e1, "base64url")).digest("hex"));
  const all = await (await fetch(`${base}/v1/mailboxes/${box}/messages`)).json();
  assert.deepEqual(all.messages.map((m) => m.envelope), [e1, e2]);
  const later = await (await fetch(`${base}/v1/mailboxes/${box}/messages?after=${r1.seq}`)).json();
  assert.deepEqual(later.messages.map((m) => m.seq), [r2.seq]);
  assert.equal(later.next, r2.seq);
});

test("rejects bad mailboxes, non-envelopes, duplicates, wrong content type and oversize bodies", async () => {
  assert.equal((await post("nope", { envelope: fakeEnvelope() })).status, 400);
  assert.equal((await post(box, { envelope: "!!" })).status, 400);
  assert.equal((await post(box, { envelope: Buffer.from("hello").toString("base64url") })).status, 400);
  const e = fakeEnvelope();
  assert.equal((await post(box, { envelope: e })).status, 201);
  assert.equal((await post(box, { envelope: e })).status, 409);
  assert.equal((await post(box, "x", "text/plain")).status, 415);
  assert.equal((await post(box, { envelope: "A".repeat(200_000) })).status, 413);
  assert.equal((await fetch(`${base}/v1/mailboxes/${box}/messages?after=-1`)).status, 400);
});

test("CORS preflight is answered", async () => {
  const r = await fetch(`${base}/v1/mailboxes/${box}/messages`, { method: "OPTIONS", headers: { origin: "http://localhost:3000" } });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
});
