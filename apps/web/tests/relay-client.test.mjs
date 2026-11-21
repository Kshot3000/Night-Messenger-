// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { test } from "node:test";
import { pollUrl, relayAuthorization, submitEnvelope } from "../src/lib/relay-client.ts";

const relay = "https://relay.test";
const mailbox = "a".repeat(64);
const token = "x".repeat(32);
const commitment = "b".repeat(64);

test("relay cursors carry the instance only for the same origin", () => {
  const cursor = { relay, instance: "test-instance", after: 21 };
  assert.equal(new URL(pollUrl(relay, mailbox, cursor)).search, "?after=21&instance=test-instance");
  assert.equal(new URL(pollUrl("https://other.test", mailbox, cursor)).search, "?after=0");
});

test("mailbox capabilities require a stable exact HTTPS origin", () => {
  assert.deepEqual(relayAuthorization(relay, token), { authorization: "Bearer " + token });
  for (const origin of ["http://localhost:8787", "https://example.trycloudflare.com", relay + "/path", relay + "?q=1"]) {
    assert.deepEqual(relayAuthorization(origin, token), {});
  }
});

test("a lost response retries the identical sealed envelope once", async () => {
  const requests = [];
  await submitEnvelope({ relay, mailbox, envelope: "literal-ciphertext", commitment, token, request: async (url, init) => {
    const { signal, ...options } = init;
    assert.ok(signal instanceof AbortSignal);
    requests.push([url, options]);
    if (requests.length === 1) throw new Error("fixture connection reset");
    return Response.json({ commitment }, { status: 200 });
  } });
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0], requests[1]);
  assert.equal(requests[0][1].redirect, "error");
  assert.equal(requests[0][1].credentials, "omit");
});

test("Preview duplicate ack is accepted only for the same live commitment", async () => {
  const args = { relay, mailbox, envelope: "literal-ciphertext", commitment };
  await submitEnvelope({ ...args, request: async () => Response.json({ commitment }, { status: 409 }) });
  await assert.rejects(submitEnvelope({ ...args, request: async () => Response.json({ commitment: "wrong" }, { status: 409 }) }), /409/);
  await assert.rejects(submitEnvelope({ ...args, request: async () => Response.json({ commitment, deleted: true }) }), /removed/);
});
