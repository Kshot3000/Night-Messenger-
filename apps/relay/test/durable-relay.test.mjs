// SPDX-License-Identifier: Apache-2.0
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";
import { backupRelay } from "../backup.mjs";
import { createDurableRelay, productionOptions, validatePolicy } from "../durable-server.mjs";

const mailbox = "a".repeat(64);
const other = "b".repeat(64);
const app = "https://app.test";
const read = "fixture-read-".padEnd(32, "r");
const write = "fixture-write-".padEnd(32, "w");
const digest = (x) => createHash("sha256").update(x).digest("hex");
const policy = { origins: [app], ttlHours: 1, mailboxes: {
  [mailbox]: { readSha256: digest(read), writeSha256: digest(write) },
  [other]: { readSha256: digest(read + "b"), writeSha256: digest(write + "b") },
} };

async function fixture(t, options) {
  const dir = await mkdtemp(join(tmpdir(), "nm-relay-"));
  const servers = new Set();
  t.after(async () => {
    for (const server of servers) await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  });
  const database = join(dir, "relay.sqlite");
  async function start(file = database) {
    const server = createDurableRelay({ database: file, config: policy, ...options });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    servers.add(server);
    const close = () => new Promise((resolve) => server.close(() => {
      servers.delete(server);
      resolve();
    }));
    const base = "http://127.0.0.1:" + server.address().port;
    const request = (method, { box = mailbox, query = "", token, origin = app, body } = {}) => fetch(
      base + "/v1/mailboxes/" + box + "/messages" + query,
      { method, headers: { origin, ...(token ? { authorization: "Bearer " + token } : {}),
        ...(body ? { "content-type": "application/json" } : {}) }, body },
    );
    const post = (value = 10, opts = {}) => {
      const bytes = Buffer.alloc(256, value);
      bytes[0] = 1;
      return request("POST", { token: write, body: JSON.stringify({ envelope: bytes.toString("base64url") }), ...opts });
    };
    return { request, post, close };
  }
  return { database, start, snapshot: join(dir, "restore.sqlite") };
}

test("durable relay refuses missing TLS config, open origins, and role reuse", () => {
  assert.throws(() => productionOptions({}), /NM_RELAY_DB/);
  assert.throws(() => productionOptions({ NM_RELAY_DB: "db", NM_RELAY_POLICY: "policy" }), /TLS_CERT/);
  for (const origin of ["*", "http://app.test", "https://app.test/path", "https://a.trycloudflare.com"]) {
    assert.throws(() => validatePolicy({ ...policy, origins: [origin] }), /HTTPS/);
  }
  assert.throws(() => validatePolicy({ ...policy, mailboxes: {
    [mailbox]: { readSha256: digest(read), writeSha256: digest(read) },
  } }), /unique/);
});

test("capabilities restrict mailbox and role; approved CORS supports authorization", async (t) => {
  const { request, post } = await (await fixture(t)).start();
  assert.equal((await request("GET")).status, 401);
  assert.equal((await request("GET", { token: write })).status, 401);
  assert.equal((await request("GET", { box: other, token: read })).status, 401);
  assert.equal((await post(1, { token: read })).status, 401);
  assert.equal((await post(1, { origin: "https://spoof.test" })).status, 403);
  const cors = await request("OPTIONS");
  assert.equal(cors.status, 204);
  assert.equal(cors.headers.get("access-control-allow-origin"), app);
  assert.match(cors.headers.get("access-control-allow-headers"), /authorization/);
  assert.equal((await post()).status, 201);
});

test("acknowledged ciphertext persists, exact retries are idempotent, and a new process resets cursors", async (t) => {
  const { start } = await fixture(t, { pageSize: 1 });
  const first = await start();
  const responses = await Promise.all([first.post(), first.post(), first.post(11)]);
  assert.deepEqual(responses.map((x) => x.status).sort(), [200, 201, 201]);
  const records = await Promise.all(responses.map((x) => x.json()));
  assert.deepEqual(records[0], records[1]);
  const page = await (await first.request("GET", { token: read })).json();
  assert.equal(page.messages.length, 1);
  const next = await (await first.request("GET", { token: read, query: "?after=" + page.next + "&instance=" + page.instance })).json();
  assert.equal(next.reset, false);
  assert.equal(next.messages.length, 1);
  await first.close();
  const second = await start();
  const retried = await second.post();
  assert.equal(retried.status, 200);
  assert.deepEqual(await retried.json(), records[0]);
  const replayed = await (await second.request("GET", { token: read, query: "?after=999&instance=" + page.instance })).json();
  assert.equal(replayed.reset, true);
  assert.notEqual(replayed.instance, page.instance);
  assert.equal(replayed.messages[0].seq, page.messages[0].seq);
});

test("delete denies write capabilities, hides ciphertext, and keeps a tombstone until expiry", async (t) => {
  let time = 10_000;
  const { request, post } = await (await fixture(t, { now: () => time, maxPerMailbox: 1 })).start();
  const record = await (await post()).json();
  const query = "?commitment=" + record.commitment;
  assert.equal((await request("DELETE", { token: write, query })).status, 401);
  assert.equal((await request("DELETE", { token: read, query })).status, 204);
  assert.deepEqual((await (await request("GET", { token: read })).json()).messages, []);
  assert.equal((await (await post()).json()).deleted, true);
  assert.equal((await post(11)).status, 507);
  time += 3_600_000;
  assert.equal((await post(11)).status, 201);
  time += 3_600_001;
  assert.deepEqual((await (await request("GET", { token: read })).json()).messages, []);
});

test("oversize, non-v1 envelopes, invalid cursors, mailbox and global quotas", async (t) => {
  const { request, post } = await (await fixture(t, { maxMessages: 1 })).start();
  assert.equal((await post(1, { body: JSON.stringify({ envelope: "A".repeat(100_000) }) })).status, 413);
  assert.equal((await post(1, { body: JSON.stringify({ envelope: "abc" }) })).status, 400);
  assert.equal((await request("GET", { token: read, query: "?after=-1" })).status, 400);
  assert.equal((await post()).status, 201);
  assert.equal((await post(11, { box: other, token: write + "b" })).status, 507);
});

test("write spam is rate limited with Retry-After and resumes in a new window", async (t) => {
  let time = 1_000;
  const { post } = await (await fixture(t, { now: () => time, writesPerMailbox: 1 })).start();
  assert.equal((await post()).status, 201);
  const limited = await post(11);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "59");
  time += 60_000;
  assert.equal((await post(11)).status, 201);
});

test("online backup restores acknowledged ciphertext over a new instance", async (t) => {
  const { database, snapshot, start } = await fixture(t);
  const first = await start();
  await first.post();
  const original = await (await first.request("GET", { token: read })).json();
  await backupRelay(database, snapshot);
  await assert.rejects(backupRelay(database, snapshot), { code: "EEXIST" });
  const restored = await start(snapshot);
  const page = await (await restored.request("GET", { token: read, query: "?after=999&instance=" + original.instance })).json();
  assert.notEqual(page.instance, original.instance);
  assert.equal(page.reset, true);
  assert.deepEqual(page.messages, original.messages);
});
