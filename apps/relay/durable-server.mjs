#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
import { createServer as httpServer } from "node:http";
import { createServer as httpsServer } from "node:https";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import { pathToFileURL } from "node:url";
import { openMailboxStore } from "./durable-store.mjs";

const HEX = /^[0-9a-f]{64}$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const TOKEN = /^[A-Za-z0-9_-]{32,128}$/;
const MAX_BODY = 96 * 1024;
const MAX_ENVELOPE = 64 * 1024;
const sha = (value) => createHash("sha256").update(value).digest();

export function validatePolicy(config) {
  if (!Array.isArray(config?.origins) || config.origins.length === 0 || config.origins.length > 20 ||
      config.origins.some((origin) => {
        try {
          const parsed = new URL(origin);
          return parsed.protocol !== "https:" || parsed.origin !== origin ||
            parsed.hostname.endsWith(".trycloudflare.com") || parsed.hostname === "trycloudflare.com";
        } catch { return true; }
      })) throw new Error("Configure exact HTTPS app origins on stable hosts");
  const records = Object.entries(config.mailboxes ?? {});
  if (!records.length || records.length > 1000) throw new Error("Configure 1–1000 authorized mailboxes");
  const seen = new Set();
  for (const [mailbox, cap] of records) {
    if (!HEX.test(mailbox) || typeof cap?.readSha256 !== "string" || typeof cap?.writeSha256 !== "string" ||
        !HEX.test(cap.readSha256) || !HEX.test(cap.writeSha256)) {
      throw new Error("Mailbox and capability digests must be lowercase SHA-256 hex strings");
    }
    for (const hash of [cap.readSha256, cap.writeSha256]) {
      if (seen.has(hash)) throw new Error("Capabilities must be unique to one mailbox and role");
      seen.add(hash);
    }
  }
  const ttlHours = config.ttlHours ?? 168;
  if (!Number.isInteger(ttlHours) || ttlHours < 1 || ttlHours > 168) throw new Error("ttlHours must be 1–168");
  return { origins: new Set(config.origins), mailboxes: new Map(records), ttlMs: ttlHours * 3_600_000 };
}

async function readEnvelope(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers["content-type"] ?? "")) {
    return { status: 415, error: "use application/json" };
  }
  if (Number(req.headers["content-length"]) > MAX_BODY) return { status: 413, error: "body too large" };
  const chunks = [];
  let size = 0;
  // Keep the connection available for a 413 if a chunked upload crosses the cap.
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > MAX_BODY) return { status: 413, error: "body too large" };
    chunks.push(chunk);
  }
  let json;
  try { json = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { return { status: 400, error: "invalid JSON" }; }
  const envelope = json?.envelope;
  if (typeof envelope !== "string" || !BASE64URL.test(envelope)) return { status: 400, error: "envelope must be base64url" };
  const bytes = Buffer.from(envelope, "base64url");
  if (bytes.length < 128 || bytes.length > MAX_ENVELOPE || bytes[0] !== 1 || bytes.toString("base64url") !== envelope) {
    return { status: 400, error: "not a Night Messenger v1 envelope" };
  }
  return { envelope, commitment: sha(bytes).toString("hex") };
}

export function createDurableRelay({
  database, config, tls, now = Date.now, maxMessages = 25_000, maxPerMailbox = 500,
  maxDatabasePages = 131_072, pageSize = 50, perIp = 240, writesPerMailbox = 60,
}) {
  const policy = validatePolicy(config);
  const store = openMailboxStore(database, { ttlMs: policy.ttlMs, maxMessages, maxPerMailbox, maxDatabasePages });
  const instance = randomUUID();
  const counters = new Map();
  let minute = -1;
  function limited(key, limit, time) {
    const bucket = Math.floor(time / 60_000);
    if (bucket !== minute) {
      counters.clear();
      minute = bucket;
    }
    if (!counters.has(key) && counters.size >= 20_000) return true;
    const hits = (counters.get(key) ?? 0) + 1;
    counters.set(key, hits);
    return hits > limit;
  }
  function reply(res, status, body) {
    res.setHeader("cache-control", "no-store");
    res.setHeader("x-content-type-options", "nosniff");
    if (body !== undefined) res.setHeader("content-type", "application/json; charset=utf-8");
    res.writeHead(status);
    res.end(body === undefined ? undefined : JSON.stringify(body));
  }
  function reject(req, res, status, error) {
    // Refuse before reading untrusted bodies; do not keep the socket alive.
    if (req.method === "POST") res.setHeader("connection", "close");
    reply(res, status, { error });
    req.resume();
  }
  function rateLimited(req, res, time) {
    res.setHeader("retry-after", Math.max(1, Math.ceil((60_000 - time % 60_000) / 1000)));
    return reject(req, res, 429, "slow down");
  }
  function authorized(req, mailbox, role) {
    const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
    const digest = policy.mailboxes.get(mailbox)?.[role + "Sha256"];
    return typeof token === "string" && TOKEN.test(token) && digest &&
      timingSafeEqual(sha(token), Buffer.from(digest, "hex"));
  }
  async function handle(req, res) {
    const time = now();
    const origin = req.headers.origin;
    const originAllowed = origin && policy.origins.has(origin);
    if (originAllowed) {
      res.setHeader("access-control-allow-origin", origin);
      res.setHeader("access-control-expose-headers", "retry-after");
      res.setHeader("vary", "origin");
    }
    // Direct TLS. Never trust X-Forwarded-For from the caller.
    if (limited("ip:" + (req.socket.remoteAddress ?? "unknown"), perIp, time)) return rateLimited(req, res, time);
    if (origin && !originAllowed) return reject(req, res, 403, "origin not allowed");
    const url = new URL(req.url, "https://relay.invalid");
    if (url.pathname === "/health" && req.method === "GET") {
      return reply(res, 200, { ok: true, service: "night-messenger-relay", version: 1, instance, auth: "mailbox-capability" });
    }
    const mailbox = /^\/v1\/mailboxes\/([0-9a-f]{64})\/messages$/.exec(url.pathname)?.[1];
    if (!mailbox) return reject(req, res, 404, "not found");
    if (req.method === "OPTIONS") {
      res.setHeader("access-control-allow-methods", "GET, POST, DELETE, OPTIONS");
      res.setHeader("access-control-allow-headers", "authorization, content-type");
      res.setHeader("access-control-max-age", "600");
      return reply(res, 204);
    }
    if (!["GET", "POST", "DELETE"].includes(req.method)) return reject(req, res, 405, "method not allowed");
    const role = req.method === "POST" ? "write" : "read";
    if (!authorized(req, mailbox, role)) return reject(req, res, 401, "mailbox authorization required");

    if (req.method === "GET") {
      const rawAfter = url.searchParams.get("after") ?? "0";
      const requested = Number(rawAfter);
      if (!/^(0|[1-9]\d*)$/.test(rawAfter) || !Number.isSafeInteger(requested)) return reject(req, res, 400, "invalid cursor");
      const reset = url.searchParams.get("instance") !== instance;
      const after = reset ? 0 : requested;
      const messages = store.list(mailbox, after, time, pageSize);
      return reply(res, 200, { messages, next: messages.at(-1)?.seq ?? after, instance, reset });
    }
    if (req.method === "DELETE") {
      const commitment = url.searchParams.get("commitment") ?? "";
      if (!HEX.test(commitment)) return reject(req, res, 400, "invalid commitment");
      store.delete(mailbox, commitment);
      return reply(res, 204);
    }
    if (limited("write:" + mailbox, writesPerMailbox, time)) return rateLimited(req, res, time);
    const data = await readEnvelope(req);
    if (data.error) return reject(req, res, data.status, data.error);
    const result = store.append(mailbox, data.commitment, data.envelope, now());
    return reply(res, result.status, result.body);
  }
  function listener(req, res) {
    handle(req, res).catch((error) => {
      if (res.headersSent) return res.end();
      const full = (error.errcode & 0xff) === 13; // SQLITE_FULL
      reject(req, res, full ? 507 : 503, full ? "relay storage is full" : "relay temporarily unavailable");
    });
  }
  const options = { requestTimeout: 10_000, headersTimeout: 5000, keepAliveTimeout: 5000, maxHeaderSize: 8192 };
  const server = tls ? httpsServer({ ...options, ...tls, minVersion: "TLSv1.2" }, listener) : httpServer(options, listener);
  server.maxConnections = 256;
  const timer = setInterval(() => {
    try { store.expire(now()); } catch { console.error("relay expiry sweep failed"); }
  }, 60_000);
  timer.unref();
  server.once("close", () => { clearInterval(timer); store.close(); });
  return server;
}

export function productionOptions(env) {
  for (const name of ["NM_RELAY_DB", "NM_RELAY_POLICY", "NM_RELAY_TLS_CERT", "NM_RELAY_TLS_KEY"]) {
    if (!env[name]) throw new Error(name + " must point to an operator-managed file");
  }
  const port = Number(env.PORT ?? 8443);
  const host = env.HOST ?? "127.0.0.1";
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !isIP(host)) throw new Error("Invalid HOST or PORT");
  return {
    database: env.NM_RELAY_DB,
    config: JSON.parse(readFileSync(env.NM_RELAY_POLICY, "utf8")),
    tls: { cert: readFileSync(env.NM_RELAY_TLS_CERT), key: readFileSync(env.NM_RELAY_TLS_KEY) },
    host, port,
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    process.umask(0o077);
    const options = productionOptions(process.env);
    const server = createDurableRelay(options);
    server.on("error", () => { console.error("Durable relay failed to bind"); process.exitCode = 1; server.close(); });
    server.listen(options.port, options.host, () => console.log("Night Messenger durable relay listening over TLS"));
    for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, () => server.close());
  } catch {
    console.error("Durable relay configuration, TLS, or database initialization failed");
    process.exitCode = 1;
  }
}
