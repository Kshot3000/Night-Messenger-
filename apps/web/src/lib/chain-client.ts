// SPDX-License-Identifier: Apache-2.0
/**
 * Client for the chain the demo talks to. Today: the local chain simulator
 * (contracts/sim/server.mjs), which runs the real compiled contract and, with
 * a proof server, real ZK proofs. Preprod (Lace + proof server + indexer) is
 * the next step and plugs in behind the same three calls.
 */
import { chainUrlRisk } from "./private-store";

export const DEFAULT_CHAIN =
  process.env.NEXT_PUBLIC_NM_CHAIN_URL || "http://localhost:8788";
export const CHAIN_KEY = "nm_private_chain_v1";
const PRODUCTION = process.env.NODE_ENV === "production";
/** See chainUrlRisk: the simulator gets sk in plain JSON, so never send it anywhere but localhost in a production build. */
export const chainRisk = (base: string) => chainUrlRisk(base, PRODUCTION);

export type TxInfo = { n: number; circuit: string; at: string; proof: { bytes: number; ms: number } | null };
export type Receipt = {
  commitment: string;
  posted: boolean;
  inboxId?: string;
  authorTag?: string;
  seq?: string;
  receipts?: string;
  revealedAuthor?: string | null;
  txs?: TxInfo[];
};

async function call<T>(base: string, path: string, body?: unknown): Promise<T> {
  if (body !== undefined && chainRisk(base) === "refuse")
    throw new Error(`refusing to send your member secret to a non-local chain simulator (${base}); run it on localhost`);
  const r = await fetch(`${base.replace(/\/$/, "")}${path}`, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || `chain returned ${r.status}`);
  return j as T;
}
export const chainHealth = (base: string) => call<{ ok: boolean; proving: boolean }>(base, "/health");
export const chainReceipt = (base: string, commitment: string) => call<Receipt>(base, `/v1/chain/posts/${commitment}`);
export const chainInbox = (base: string, inboxId: string) => call<{ inboxId: string; exists: boolean; members?: string; active?: boolean }>(base, `/v1/chain/inboxes/${inboxId}`);
/** seed: the DM inbox seed, needed only when this send creates the inbox (the id is bound to the sender in-circuit). */
export const chainSend = (base: string, b: { sk: string; blind: string; seed?: string; inboxId: string; commitment: string; members: string[] }) =>
  call<{ txs: TxInfo[]; receipt: Receipt }>(base, "/v1/chain/send", b);
export const chainAck = (base: string, b: { sk: string; commitment: string }) => call<{ txs: TxInfo[]; receipt: Receipt }>(base, "/v1/chain/ack", b);
export type Usage = { inboxes: string; registrations: string; envelopesPosted: string; deliveryReceipts: string; mode?: string };
/** Aggregate ledger counters only (no per-user data). */
export const chainSummary = (base: string) => call<Usage>(base, "/v1/chain/summary");
