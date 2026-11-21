// SPDX-License-Identifier: Apache-2.0
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { createDurableRelay } from "./durable-server.mjs";

const clients = Number(process.argv[2] ?? 8);
const perClient = Number(process.argv[3] ?? 125);
if (!Number.isInteger(clients) || clients < 1 || clients > 32 ||
    !Number.isInteger(perClient) || perClient < 1 || perClient > 500) {
  throw new Error("Usage: node load.mjs [clients 1–32] [writes per client 1–500]");
}
const digest = (text) => createHash("sha256").update(text).digest("hex");
const readers = Array.from({ length: clients }, (_, index) => ({
  mailbox: digest("fixture-box-" + index),
  read: ("fixture-read-" + index + "-").padEnd(32, "r"),
  write: ("fixture-write-" + index + "-").padEnd(32, "w"),
}));
const directory = await mkdtemp(join(tmpdir(), "nm-relay-load-"));
const server = createDurableRelay({
  database: join(directory, "mailboxes.sqlite"),
  config: { origins: ["https://app.test"], mailboxes: Object.fromEntries(readers.map((x) => [
    x.mailbox, { readSha256: digest(x.read), writeSha256: digest(x.write) },
  ])) },
  perIp: clients * (perClient + 100),
  writesPerMailbox: perClient + 100,
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = "http://127.0.0.1:" + server.address().port + "/v1/mailboxes/";
const timings = [];
function auth(token) { return { authorization: "Bearer " + token }; }
async function send(reader, index, status) {
  const bytes = Buffer.alloc(1024);
  bytes[0] = 1;
  bytes.writeUInt32BE(index, 1);
  const start = performance.now();
  const response = await fetch(base + reader.mailbox + "/messages", {
    method: "POST", headers: { ...auth(reader.write), "content-type": "application/json" },
    body: JSON.stringify({ envelope: bytes.toString("base64url") }),
  });
  const result = await response.json();
  if (response.status !== status || result.commitment !== digest(bytes)) {
    throw new Error("Unexpected POST response " + response.status);
  }
  if (status === 201) timings.push(performance.now() - start);
}
try {
  const started = performance.now();
  await Promise.all(readers.map(async (reader) => {
    for (let index = 0; index < perClient; index++) await send(reader, index, 201);
  }));
  const writeMs = performance.now() - started;
  const retries = Math.min(perClient, 10);
  await Promise.all(readers.map(async (reader) => {
    for (let index = 0; index < retries; index++) await send(reader, index, 200);
  }));
  let readCount = 0;
  let pages = 0;
  await Promise.all(readers.map(async (reader) => {
    let after = 0;
    let instance = "";
    let seen = 0;
    for (;;) {
      const query = new URLSearchParams({ after: String(after), instance });
      const response = await fetch(base + reader.mailbox + "/messages?" + query, { headers: auth(reader.read) });
      const page = await response.json();
      if (response.status !== 200 || (instance && instance !== page.instance) ||
          (page.messages.length && page.next <= after)) throw new Error("Invalid poll page");
      pages++;
      after = page.next;
      instance = page.instance;
      seen += page.messages.length;
      if (!page.messages.length) break;
      if (seen > perClient) throw new Error("Unexpected duplicate delivery");
    }
    if (seen !== perClient) throw new Error("Missing accepted ciphertext");
    readCount += seen;
  }));
  timings.sort((a, b) => a - b);
  const quantile = (p) => Number(timings[Math.ceil(timings.length * p) - 1].toFixed(2));
  console.log(JSON.stringify({
    node: process.version, transport: "loopback HTTP", storage: "SQLite WAL synchronous FULL",
    clients, ciphertextBytes: 1024, accepted: timings.length, successfulRetries: clients * retries,
    readCount, pages, writeMs: Number(writeMs.toFixed(2)),
    writesPerSecond: Number((timings.length / (writeMs / 1000)).toFixed(1)),
    p50Ms: quantile(0.5), p95Ms: quantile(0.95), p99Ms: quantile(0.99),
  }, null, 2));
} finally {
  await new Promise((resolve) => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
