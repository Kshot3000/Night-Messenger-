// SPDX-License-Identifier: Apache-2.0
/** Public Preview deployment record and a live indexer check (no secrets, no token). */

export const PREVIEW_INDEXER = "https://indexer.preview.midnight.network/api/v4/graphql";

export type PreviewRecord = {
  network?: string;
  status?: string;
  contractAddress?: string | null;
  explorer?: string | null;
  commitment?: string | null;
  check?: { authorTagMatches?: boolean; acks?: string } | null;
  inboxId?: string | null;
  txs?: Record<string, { txId?: string; blockHeight?: number; explorer?: string | null }>;
  endpoints?: { indexer?: string; explorer?: string };
  verify?: {
    commitment?: string;
    acks?: string;
    posted?: boolean;
    inboxId?: string;
    authorTag?: string;
    seq?: string;
  };
};

export type PreviewLiveCheck = {
  height: number | null;
  ackDeliveryPresent: boolean;
  ackTxId: string | null;
};

function publicBasePath(): string {
  const fromEnv = process.env.NEXT_PUBLIC_BASE_PATH;
  if (fromEnv != null && fromEnv.length > 0) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/Night-Messenger-")) {
    return "/Night-Messenger-";
  }
  return "";
}

export async function loadPreviewRecord(): Promise<PreviewRecord | null> {
  const url = `${publicBasePath()}/preview.json`;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = (await r.json()) as PreviewRecord;
    if (!j?.contractAddress) return null;
    return j;
  } catch {
    return null;
  }
}

export async function checkPreviewAckOnIndexer(record: PreviewRecord): Promise<PreviewLiveCheck> {
  const indexer = record.endpoints?.indexer || PREVIEW_INDEXER;
  const address = record.contractAddress!;
  const expected = (record.txs?.ackDelivery?.txId ?? "").replace(/^0x/, "").toLowerCase();
  const r = await fetch(indexer, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query:
        "query($a: HexEncoded!) { block { height } contract(address: $a) { actions { __typename ... on ContractCall { entryPoint transaction { ... on RegularTransaction { identifiers } } } } } }",
      variables: { a: address },
    }),
  });
  const j = await r.json();
  if (!r.ok || j.errors) throw new Error(j.errors?.[0]?.message || `indexer ${r.status}`);
  const height = j.data?.block?.height ?? null;
  const actions = j.data?.contract?.actions ?? [];
  let ackDeliveryPresent = false;
  for (const a of actions) {
    if (a?.entryPoint !== "ackDelivery") continue;
    const ids = (a.transaction?.identifiers ?? []).map((x: string) => String(x).replace(/^0x/, "").toLowerCase());
    if (!expected || ids.includes(expected)) {
      ackDeliveryPresent = true;
      break;
    }
  }
  return { height, ackDeliveryPresent, ackTxId: expected || null };
}
