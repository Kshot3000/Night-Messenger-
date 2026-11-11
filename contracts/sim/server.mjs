#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Local chain simulator for the web demo: runs the REAL compiled
 * night_messenger.compact in @midnight-ntwrk/compact-runtime and exposes it
 * over HTTP so two browsers on your machine can post commitments, send
 * delivery receipts and verify them, before the Preprod deployment exists.
 *
 * Trust model (read this): like Midnight's proof server, this process receives
 * your private circuit inputs (member secret, blind) so it can run the
 * circuit. It must run on YOUR machine; it binds to 127.0.0.1 by default.
 * On Preprod the browser hands those inputs only to the local proof server via
 * the Lace wallet, and the chain sees proofs + public outputs only.
 *
 * With NM_PROOF_SERVER set (e.g. http://127.0.0.1:6300) and full ZK keys from
 * `pnpm compile`, every call is also proven for real and the response carries
 * the proof size and time. Without it, calls are simulated (no proof).
 *
 *   GET  /health
 *   GET  /v1/chain/summary
 *   GET  /v1/chain/posts/:commitment      public receipt view (no secrets)
 *   POST /v1/chain/send   {sk, blind, inboxId, commitment, members:[hex,hex]}
 *        creates the inbox + adds members if needed (caller becomes owner), then postEnvelope
 *   POST /v1/chain/ack    {sk, commitment}
 *   POST /v1/chain/reveal {sk, blind, commitment}
 *
 * Env: PORT (8788), HOST (127.0.0.1), NM_PROOF_SERVER, NM_SIM_ORIGINS (allowlist, default localhost:3000).
 * NEVER host this simulator: it receives member secrets (sk) in plain JSON.
 */
import http from "node:http";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as RT from "@midnight-ntwrk/compact-runtime";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.NM_OUT ?? path.join(HERE, "..", "src", "managed", "night_messenger");
const HEX32 = /^[0-9a-f]{64}$/;
const u8 = (h) => new Uint8Array(Buffer.from(h, "hex"));
const hex = (b) => Buffer.from(b).toString("hex");

/** Aggregate usage from ledger counters only: no per-user data, nothing that narrows a sender. */
export function usage(l) {
  return { inboxes: String(l.inboxCount), registrations: String(l.membersAdded), envelopesPosted: String(l.postCount), deliveryReceipts: String(l.deliveryCount) };
}

export async function createChainSim({ proofServer = "", origins = "http://localhost:3000,http://127.0.0.1:3000" } = {}) {
  const { Contract, ledger, pureCircuits: P } = await import(pathToFileURL(path.join(OUT, "contract", "index.js")).href);
  const witnesses = {
    localSecretKey: ({ privateState }) => [privateState, privateState.sk],
    memberPath: ({ privateState, ledger: l }, leaf) => {
      const p = l.members.member(privateState.inbox) ? l.members.lookup(privateState.inbox).findPathForLeaf(leaf) : undefined;
      if (!p) throw new Error("not a member of this inbox");
      return [privateState, p];
    },
    authorBlind: ({ privateState }) => [privateState, privateState.blind ?? new Uint8Array(32)],
  };
  const contract = new Contract(witnesses);
  const ADDR = RT.sampleContractAddress();
  const COIN = "0".repeat(64);
  const deployer = { sk: new Uint8Array(globalThis.crypto.getRandomValues(new Uint8Array(32))) };
  let state = contract.initialState(RT.createConstructorContext(deployer, COIN)).currentContractState.data;
  const L = () => ledger(state);
  const log = []; // public tx log: circuit, public args, time, proof info

  let prover = null;
  if (proofServer && existsSync(path.join(OUT, "keys", "postEnvelope.prover"))) {
    const { NodeZkConfigProvider } = await import("@midnight-ntwrk/midnight-js-node-zk-config-provider");
    const { httpClientProvingProvider } = await import("@midnight-ntwrk/midnight-js-http-client-proof-provider");
    const { setNetworkId } = await import("@midnight-ntwrk/midnight-js-network-id");
    setNetworkId("preprod");
    prover = httpClientProvingProvider(proofServer, new NodeZkConfigProvider(OUT), { timeout: 600_000 });
  }

  async function run(ps, name, args, publicArgs) {
    const r = contract.impureCircuits[name](RT.createCircuitContext(ADDR, COIN, state, ps), ...args);
    let proof = null;
    if (prover) {
      const pd = r.proofData;
      const pre = RT.proofDataIntoSerializedPreimage(pd.input, pd.output, pd.publicTranscript, pd.privateTranscriptOutputs, name);
      const t0 = Date.now();
      const bytes = await prover.prove(pre, name);
      proof = { bytes: bytes.byteLength, ms: Date.now() - t0 };
    }
    state = r.context.currentQueryContext.state; // commit only after a successful proof
    const entry = { n: log.length + 1, circuit: name, public: publicArgs, at: new Date().toISOString(), proof };
    log.push(entry);
    Object.defineProperty(entry, "result", { value: r.result, enumerable: false });
    return entry;
  }

  function receipt(c) {
    const l = L();
    const k = u8(c);
    if (!l.posts.member(k)) return { commitment: c, posted: false };
    const p = l.posts.lookup(k);
    return {
      commitment: c,
      posted: true,
      inboxId: hex(p.inboxId),
      authorTag: hex(p.authorTag),
      seq: String(p.seq),
      receipts: l.ackCount.member(k) ? String(l.ackCount.lookup(k)) : "0",
      revealedAuthor: l.revealedAuthors.member(k) ? hex(l.revealedAuthors.lookup(k)) : null,
      txs: log.filter((e) => e.public.commitment === c).map(({ circuit, at, proof, n }) => ({ n, circuit, at, proof })),
    };
  }

  const handlers = {
    async send(b) {
      const sk = u8(b.sk), inbox = u8(b.inboxId), c = u8(b.commitment);
      const l = L();
      const txs = [];
      if (!l.inboxes.member(inbox)) {
        // createInbox derives the id from the caller's own member commitment + seed,
        // so a caller can only create an inbox whose id is bound to them.
        if (!b.seed || hex(P.inboxIdFor(P.memberCommitment(sk), u8(b.seed))) !== b.inboxId) throw new Error("inbox id is not bound to this sender (wrong seed)");
        txs.push(await run({ sk }, "createInbox", [u8(b.seed)], { inboxId: b.inboxId }));
        const epoch = L().inboxes.lookup(inbox).epoch;
        for (const m of b.members) txs.push(await run({ sk }, "addMember", [inbox, u8(m)], { inboxId: b.inboxId, leaf: hex(P.memberLeaf(inbox, epoch, u8(m))) }));
      }
      txs.push(await run({ sk, blind: u8(b.blind), inbox }, "postEnvelope", [inbox, c], { inboxId: b.inboxId, commitment: b.commitment }));
      return { txs, receipt: receipt(b.commitment) };
    },
    async ack(b) {
      const k = u8(b.commitment);
      const inbox = L().posts.member(k) ? L().posts.lookup(k).inboxId : undefined;
      const tx = await run({ sk: u8(b.sk), inbox }, "ackDelivery", [u8(b.commitment)], { commitment: b.commitment, nullifier: hex(P.ackNullifier(u8(b.commitment), u8(b.sk))) });
      return { txs: [tx], receipt: receipt(b.commitment) };
    },
    async reveal(b) {
      const tx = await run({ sk: u8(b.sk), blind: u8(b.blind) }, "revealAuthor", [u8(b.commitment)], { commitment: b.commitment });
      return { txs: [tx], receipt: receipt(b.commitment) };
    },
  };
  const valid = {
    send: (b) => HEX32.test(b?.sk) && HEX32.test(b?.blind) && HEX32.test(b?.inboxId) && (b?.seed === undefined || HEX32.test(b.seed)) && HEX32.test(b?.commitment) && Array.isArray(b?.members) && b.members.length <= 2 && b.members.every((m) => HEX32.test(m)),
    ack: (b) => HEX32.test(b?.sk) && HEX32.test(b?.commitment),
    reveal: (b) => HEX32.test(b?.sk) && HEX32.test(b?.blind) && HEX32.test(b?.commitment),
  };

  const send = (req, res, code, body) => {
    const o = req.headers.origin;
    res.writeHead(code, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": origins === "*" ? "*" : String(origins).split(",").includes(o) ? o : "null",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    });
    res.end(JSON.stringify(body));
  };
  let queue = Promise.resolve(); // one circuit at a time, like a single block producer
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === "OPTIONS") return send(req, res, 204, {});
      const url = new URL(req.url, "http://sim");
      if (url.pathname === "/health") return send(req, res, 200, { ok: true, service: "night-messenger-chain-sim", proving: !!prover });
      if (url.pathname === "/v1/chain/summary") {
        const l = L();
        return send(req, res, 200, { mode: prover ? "simulated ledger + real ZK proofs" : "simulated ledger, no proofs", ...usage(l), txs: log.length });
      }
      const m = url.pathname.match(/^\/v1\/chain\/posts\/([0-9a-f]{64})$/);
      if (m && req.method === "GET") return send(req, res, 200, receipt(m[1]));
      const ib = url.pathname.match(/^\/v1\/chain\/inboxes\/([0-9a-f]{64})$/);
      if (ib && req.method === "GET") {
        const l = L(), k = u8(ib[1]);
        if (!l.inboxes.member(k)) return send(req, res, 200, { inboxId: ib[1], exists: false });
        const box = l.inboxes.lookup(k);
        return send(req, res, 200, { inboxId: ib[1], exists: true, members: String(box.members), active: box.active });
      }
      const a = url.pathname.match(/^\/v1\/chain\/(send|ack|reveal)$/);
      if (a && req.method === "POST") {
        let raw = "";
        for await (const ch of req) {
          raw += ch;
          if (raw.length > 8192) return send(req, res, 413, { error: "body too large" });
        }
        let b;
        try {
          b = JSON.parse(raw);
        } catch {
          return send(req, res, 400, { error: "invalid JSON" });
        }
        if (!valid[a[1]](b)) return send(req, res, 400, { error: "invalid arguments" });
        const p = queue.then(() => handlers[a[1]](b));
        queue = p.catch(() => {});
        try {
          return send(req, res, 200, await p);
        } catch (e) {
          return send(req, res, 409, { error: String(e?.message ?? e).replace(/^.*failed assert: /, "") });
        }
      }
      return send(req, res, 404, { error: "not found" });
    } catch {
      if (!res.headersSent) send(req, res, 500, { error: "internal error" });
    }
  });
  return { server, receipt };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server } = await createChainSim({ proofServer: process.env.NM_PROOF_SERVER ?? "", origins: process.env.NM_SIM_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000" });
  const port = Number(process.env.PORT ?? 8788);
  const host = process.env.HOST ?? "127.0.0.1";
  server.listen(port, host, () => console.log(`night-messenger chain simulator on http://${host}:${port} (${process.env.NM_PROOF_SERVER ? "proving via " + process.env.NM_PROOF_SERVER : "no proofs"})`));
}
