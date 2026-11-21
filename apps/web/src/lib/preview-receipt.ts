// SPDX-License-Identifier: Apache-2.0
/** Live decode of Night Messenger ledger state on Midnight Preview. No secrets, no proof keys. */
import { ContractState } from "@midnight-ntwrk/compact-runtime";

function fromHex(h: string): Uint8Array {
  const s = h.replace(/^0x/, "");
  if (!/^(?:[0-9a-f]{2})*$/i.test(s)) throw new Error("invalid hex");
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function toHex(u: Uint8Array): string {
  return Array.from(u, (b) => b.toString(16).padStart(2, "0")).join("");
}
import { ledger } from "../generated/night_messenger/contract/index.js";

const PREVIEW_INDEXER = "https://indexer.preview.midnight.network/api/v4/graphql";

export const PREVIEW_CONTRACT_FALLBACK =
  "d2eb042ce54652684fa9cfeace5e40f0da3369c81738bd0570e9513a8199af05";

export type PreviewDecodedReceipt = {
  commitment: string;
  posted: boolean;
  inboxId?: string;
  authorTag?: string;
  seq?: string;
  receipts?: string;
  source: "preview-ledger";
  height: number | null;
  contractAddress: string;
};

const HEX32 = /^(?:0x)?[0-9a-f]{64}$/i;

function normalizeHex32(h: string): string {
  const s = h.trim().toLowerCase().replace(/^0x/, "");
  if (!HEX32.test(s) || s.length !== 64) throw new Error("A commitment is 64 hex characters.");
  return s;
}

export function contractAddressOf(record?: { contractAddress?: string | null } | null): string {
  const a = (record?.contractAddress || PREVIEW_CONTRACT_FALLBACK).replace(/^0x/, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(a)) throw new Error("Invalid Preview contract address.");
  return a;
}

export async function fetchPreviewContractState(options?: {
  contractAddress?: string;
  indexer?: string;
}): Promise<{ height: number | null; stateHex: string; contractAddress: string }> {
  const contractAddress = (options?.contractAddress || PREVIEW_CONTRACT_FALLBACK)
    .replace(/^0x/, "")
    .toLowerCase();
  const indexer = options?.indexer || PREVIEW_INDEXER;
  const r = await fetch(indexer, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query:
        "query($a: HexEncoded!) { block { height } contract(address: $a) { state } }",
      variables: { a: contractAddress },
    }),
  });
  const j = (await r.json()) as {
    errors?: { message?: string }[];
    data?: { block?: { height?: number }; contract?: { state?: string } | null };
  };
  if (!r.ok || j.errors) throw new Error(j.errors?.[0]?.message || `indexer ${r.status}`);
  const stateHex = j.data?.contract?.state;
  if (!stateHex) {
    throw new Error(
      "The Preview contract was not found on the indexer. Preview may have reset.",
    );
  }
  return {
    height: j.data?.block?.height ?? null,
    stateHex,
    contractAddress,
  };
}

export function decodeLedgerFromStateHex(stateHex: string) {
  const cs = ContractState.deserialize(fromHex(stateHex.replace(/^0x/, "")));
  return ledger(cs.data);
}

export async function decodePreviewReceipt(
  commitment: string,
  options?: { contractAddress?: string; indexer?: string },
): Promise<PreviewDecodedReceipt> {
  const c = normalizeHex32(commitment);
  const { height, stateHex, contractAddress } = await fetchPreviewContractState(options);
  const l = decodeLedgerFromStateHex(stateHex);
  const key = fromHex(c);
  if (!l.posts.member(key)) {
    return { commitment: c, posted: false, source: "preview-ledger", height, contractAddress };
  }
  const rec = l.posts.lookup(key);
  const receipts = l.ackCount.member(key) ? String(l.ackCount.lookup(key)) : "0";
  return {
    commitment: c,
    posted: true,
    inboxId: toHex(rec.inboxId),
    authorTag: toHex(rec.authorTag),
    seq: String(rec.seq),
    receipts,
    source: "preview-ledger",
    height,
    contractAddress,
  };
}

export async function previewInboxExists(
  inboxId: string,
  options?: { contractAddress?: string; indexer?: string },
): Promise<boolean> {
  const id = normalizeHex32(inboxId);
  const { stateHex } = await fetchPreviewContractState(options);
  const l = decodeLedgerFromStateHex(stateHex);
  return l.inboxes.member(fromHex(id));
}
