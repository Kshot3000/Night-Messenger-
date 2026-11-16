// SPDX-License-Identifier: Apache-2.0
/// <reference lib="webworker" />
/**
 * On-device prover for Night Messenger's circuits, run off the main thread.
 *
 * compactc 0.36 (ledger 9) emits ZKIR v3 (`ir-source[v3-generic]`). Lace 2.5.1's
 * in-app prover is @midnight-ntwrk/zkir-v2, which only reads ZKIR v2, so its
 * "Circuit check" fails before any proof starts. This worker uses
 * @midnightntwrk/zkir-v3, the same engine midnight-js testkit uses for 0.36
 * circuits. Witnesses never leave this browser tab.
 */
import { provingProvider } from "@midnightntwrk/zkir-v3";
import { SRS_PARAM_SHA256, srsParamFileName } from "./zk-params";

type KeyMaterial = { proverKey: Uint8Array; verifierKey: Uint8Array; ir: Uint8Array };
export type ProverRequest = {
  id: number;
  op: "check" | "prove";
  preimage: Uint8Array;
  keyLocation: string;
  keyMaterial: KeyMaterial;
  overwriteBindingInput?: bigint;
  paramsBase: string;
};
export type ProverReply =
  | { id: number; ok: true; check?: (bigint | undefined)[]; proof?: Uint8Array }
  | { id: number; ok: false; error: string };

const params = new Map<string, Promise<Uint8Array>>();

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function getParams(base: string, k: number): Promise<Uint8Array> {
  const url = `${base.replace(/\/$/, "")}/${srsParamFileName(k)}`;
  let p = params.get(url);
  if (!p) {
    p = (async () => {
      const expected = SRS_PARAM_SHA256[k];
      if (!expected) throw new Error(`No pinned SRS parameters for k=${k}`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`SRS parameters k=${k} answered HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const actual = await sha256Hex(bytes);
      if (actual !== expected) throw new Error(`SRS parameters k=${k} failed the integrity check`);
      return bytes;
    })();
    p.catch(() => params.delete(url));
    params.set(url, p);
  }
  return p;
}

const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = async (event: MessageEvent<ProverRequest>) => {
  const r = event.data;
  try {
    const pp = provingProvider({
      lookupKey: async (location: string) => (location === r.keyLocation ? r.keyMaterial : undefined),
      getParams: (k: number) => getParams(r.paramsBase, k),
    });
    if (r.op === "check") {
      const check = await pp.check(r.preimage, r.keyLocation);
      scope.postMessage({ id: r.id, ok: true, check } satisfies ProverReply);
    } else {
      const proof = new Uint8Array(await pp.prove(r.preimage, r.keyLocation, r.overwriteBindingInput));
      scope.postMessage({ id: r.id, ok: true, proof } satisfies ProverReply, [proof.buffer]);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    scope.postMessage({ id: r.id, ok: false, error: message } satisfies ProverReply);
  }
};
