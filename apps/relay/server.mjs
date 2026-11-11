#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Night Messenger relay: a dumb, ciphertext-only mailbox server for demos.
 *
 * It stores opaque sealed envelopes under a mailbox id (SHA-256 of the
 * recipient's public key; see packages/shared/src/e2ee.ts) and hands them back
 * in order. It cannot read messages or see who sent them: the sender's static
 * key is encrypted inside the envelope. It does see mailbox ids, envelope
 * sizes, timing and client IP addresses (a real deployment needs a mixnet /
 * Tor-style transport to hide those).
 *
 *   GET  /health
 *   POST /v1/mailboxes/:mailbox/messages   {"envelope":"<base64url>"} -> {seq, commitment, receivedAt}
 *   GET  /v1/mailboxes/:mailbox/messages?after=<seq>  -> {messages:[{seq, envelope, commitment, receivedAt}], next}
 *
 * The commitment returned is SHA-256(envelope bytes): the same 32 bytes the
 * sender posts on-chain with night_messenger.compact postEnvelope. Anyone can
 * recompute it, so the relay cannot swap a ciphertext without detection.
 *
 * Env: PORT (8787), HOST (127.0.0.1), NM_RELAY_ORIGINS (comma list or *),
 * NM_RELAY_DATA (optional JSON file for persistence), NM_RELAY_TTL_HOURS (168).
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

export const LIMITS = {
  maxEnvelopeBytes: 64 * 1024,
  maxBodyBytes: 96 * 1024,
  maxPerMailbox: 1000,
  maxMailboxes: 10_000,
  pageSize: 100,
  ratePerMinute: 120,
};
const MAILBOX = /^[0-9a-f]{64}$/;
const B64U = /^[A-Za-z0-9_-]+$/;

export function createRelay({ origins = "*", dataFile = "", ttlHours = 168, now = () => Date.now() } = {}) {
  /** @type {Map<string, {seq:number, envelope:string, commitment:string, receivedAt:string}[]>} */
  const boxes = new Map();
  let seq = 0;
  const hits = new Map();
  const allowed = origins === "*" ? "*" : new Set(String(origins).split(",").map((s) => s.trim()).filter(Boolean));

  if (dataFile && fs.existsSync(dataFile)) {
    try {
      const saved = JSON.parse(fs.readFileSync(dataFile, "utf8"));
      seq = Number(saved.seq) || 0;
      for (const [k, v] of Object.entries(saved.boxes ?? {})) if (MAILBOX.test(k) && Array.isArray(v)) boxes.set(k, v);
    } catch {
      /* start empty on a damaged file */
    }
  }
  let saveTimer = null;
  const persist = () => {
    if (!dataFile || saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      fs.mkdirSync(path.dirname(dataFile), { recursive: true });
      fs.writeFileSync(dataFile + ".tmp", JSON.stringify({ seq, boxes: Object.fromEntries(boxes) }), { mode: 0o600 });
      fs.renameSync(dataFile + ".tmp", dataFile);
    }, 250);
    saveTimer.unref?.();
  };
  const sweep = () => {
    const cutoff = now() - ttlHours * 3600_000;
    for (const [k, list] of boxes) {
      const kept = list.filter((m) => Date.parse(m.receivedAt) >= cutoff);
      if (kept.length) boxes.set(k, kept);
      else boxes.delete(k);
    }
  };
  const limited = (ip) => {
    const minute = Math.floor(now() / 60_000);
    const h = hits.get(ip);
    if (!h || h.minute !== minute) {
      if (hits.size > 50_000) hits.clear();
      hits.set(ip, { minute, n: 1 });
      return false;
    }
    return ++h.n > LIMITS.ratePerMinute;
  };

  function cors(req, res) {
    const o = req.headers.origin;
    if (allowed === "*") res.setHeader("access-control-allow-origin", "*");
    else if (o && allowed.has(o)) {
      res.setHeader("access-control-allow-origin", o);
      res.setHeader("vary", "origin");
    }
    res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    res.setHeader("access-control-allow-headers", "content-type");
    res.setHeader("access-control-max-age", "600");
  }
  const send = (res, code, body) => {
    res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
    res.end(JSON.stringify(body));
  };

  async function readBody(req) {
    let size = 0;
    const chunks = [];
    for await (const c of req) {
      size += c.length;
      if (size > LIMITS.maxBodyBytes) throw Object.assign(new Error("body too large"), { code: 413 });
      chunks.push(c);
    }
    return Buffer.concat(chunks).toString("utf8");
  }

  async function handle(req, res) {
    cors(req, res);
    if (req.method === "OPTIONS") return res.writeHead(204).end();
    const url = new URL(req.url, "http://relay");
    if (url.pathname === "/health") return send(res, 200, { ok: true, service: "night-messenger-relay", version: 1 });
    const m = url.pathname.match(/^\/v1\/mailboxes\/([^/]+)\/messages$/);
    if (!m) return send(res, 404, { error: "not found" });
    const mailbox = m[1];
    if (!MAILBOX.test(mailbox)) return send(res, 400, { error: "mailbox must be 64 lowercase hex chars" });
    if (limited(req.socket.remoteAddress ?? "?")) return send(res, 429, { error: "slow down" });

    if (req.method === "GET") {
      sweep();
      const after = Number(url.searchParams.get("after") ?? "0");
      if (!Number.isSafeInteger(after) || after < 0) return send(res, 400, { error: "after must be a non-negative integer" });
      const list = (boxes.get(mailbox) ?? []).filter((x) => x.seq > after).slice(0, LIMITS.pageSize);
      return send(res, 200, { messages: list, next: list.length ? list[list.length - 1].seq : after });
    }
    if (req.method === "POST") {
      if (!String(req.headers["content-type"] ?? "").startsWith("application/json")) {
        req.resume();
        return send(res, 415, { error: "use application/json" });
      }
      let body;
      try {
        body = JSON.parse(await readBody(req));
      } catch (e) {
        if (e.code === 413) {
          res.setHeader("connection", "close");
          send(res, 413, { error: "body too large" });
          return void req.resume();
        }
        return send(res, 400, { error: "invalid JSON" });
      }
      const env = body?.envelope;
      if (typeof env !== "string" || !B64U.test(env)) return send(res, 400, { error: "envelope must be base64url" });
      const bytes = Buffer.from(env, "base64url");
      if (bytes.length < 128 || bytes.length > LIMITS.maxEnvelopeBytes || bytes[0] !== 1) return send(res, 400, { error: "not a Night Messenger v1 envelope" });
      sweep();
      const list = boxes.get(mailbox) ?? [];
      if (!boxes.has(mailbox) && boxes.size >= LIMITS.maxMailboxes) return send(res, 507, { error: "relay is full" });
      if (list.length >= LIMITS.maxPerMailbox) return send(res, 507, { error: "mailbox is full" });
      const commitment = createHash("sha256").update(bytes).digest("hex");
      if (list.some((x) => x.commitment === commitment)) return send(res, 409, { error: "duplicate envelope", commitment });
      const rec = { seq: ++seq, envelope: env, commitment, receivedAt: new Date(now()).toISOString() };
      list.push(rec);
      boxes.set(mailbox, list);
      persist();
      return send(res, 201, { seq: rec.seq, commitment, receivedAt: rec.receivedAt });
    }
    return send(res, 405, { error: "method not allowed" });
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) send(res, 500, { error: "internal error" });
      else res.end();
    });
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 5_000;
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8787);
  const host = process.env.HOST ?? "127.0.0.1";
  const server = createRelay({
    origins: process.env.NM_RELAY_ORIGINS ?? "*",
    dataFile: process.env.NM_RELAY_DATA ?? "",
    ttlHours: Number(process.env.NM_RELAY_TTL_HOURS ?? 168),
  });
  server.listen(port, host, () => console.log(`night-messenger relay on http://${host}:${port} (ciphertext only)`));
}
