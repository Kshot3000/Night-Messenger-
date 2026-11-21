// SPDX-License-Identifier: Apache-2.0
/**
 * Prove Night Messenger's contract calls inside this browser tab.
 *
 * The page resolves each circuit's key material (prover key, verifier key,
 * ZKIR) through midnight-js's ZKConfigRegistry, which only accepts artifacts
 * whose verifier key matches the deployed contract, then hands the work to a
 * dedicated worker running @midnightntwrk/zkir-v3. Nothing is sent to a
 * proof server; the wallet only balances, signs, and submits.
 */
import {
  createProofProviderFromHandlers,
  ZKConfigRegistry,
  zkConfigToProvingKeyMaterial,
} from "@midnight-ntwrk/midnight-js-types";
import { Transaction } from "@midnight-ntwrk/midnight-js-protocol/v9";
import type { ProverReply, ProverRequest } from "./zkir-v3.worker";

export function inPageProvingSupported(): boolean {
  return (
    typeof Worker !== "undefined" &&
    typeof WebAssembly !== "undefined" &&
    typeof crypto !== "undefined" &&
    typeof crypto.subtle !== "undefined"
  );
}

type Pending = { resolve: (r: ProverReply) => void; reject: (e: Error) => void };

export function createInPageProvingProvider(zkConfigProvider: unknown, paramsBase: string) {
  const registry =
    zkConfigProvider instanceof ZKConfigRegistry
      ? zkConfigProvider
      : new ZKConfigRegistry([zkConfigProvider as never]);
  let worker: Worker | undefined;
  let nextId = 0;
  const pending = new Map<number, Pending>();

  const failAll = (error: Error) => {
    for (const p of pending.values()) p.reject(error);
    pending.clear();
    worker?.terminate();
    worker = undefined;
  };

  const getWorker = () => {
    if (!worker) {
      worker = new Worker(new URL("./zkir-v3.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<ProverReply>) => {
        const p = pending.get(event.data.id);
        if (!p) return;
        pending.delete(event.data.id);
        p.resolve(event.data);
      };
      worker.onerror = (event) => failAll(new Error(`On-device prover stopped: ${event.message || "worker error"}`));
    }
    return worker;
  };

  const keyMaterial = async (keyLocation: string) => {
    const resolved = await registry.resolveKeyLocation(keyLocation);
    if (resolved === undefined) {
      throw new Error(`No key material for '${keyLocation}' (only this contract's circuits are proved in the page)`);
    }
    return zkConfigToProvingKeyMaterial(resolved);
  };

  const run = async (
    op: ProverRequest["op"],
    preimage: Uint8Array,
    keyLocation: string,
    overwriteBindingInput?: bigint,
  ): Promise<ProverReply & { ok: true }> => {
    const km = await keyMaterial(keyLocation);
    const id = ++nextId;
    const request: ProverRequest = {
      id,
      op,
      preimage: preimage.slice(),
      keyLocation,
      keyMaterial: { proverKey: km.proverKey.slice(), verifierKey: km.verifierKey.slice(), ir: km.ir.slice() },
      overwriteBindingInput,
      paramsBase,
    };
    const reply = await new Promise<ProverReply>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      getWorker().postMessage(request, [
        request.preimage.buffer,
        request.keyMaterial.proverKey.buffer,
        request.keyMaterial.verifierKey.buffer,
        request.keyMaterial.ir.buffer,
      ]);
    });
    if (!reply.ok) throw new Error(`On-device ${op} failed: ${reply.error}`);
    return reply;
  };

  return {
    lookupKey: async (keyLocation: string) => {
      try {
        return await keyMaterial(keyLocation);
      } catch {
        return undefined;
      }
    },
    check: async (preimage: Uint8Array, keyLocation: string) =>
      (await run("check", preimage, keyLocation)).check ?? [],
    prove: async (preimage: Uint8Array, keyLocation: string, overwriteBindingInput?: bigint) =>
      (await run("prove", preimage, keyLocation, overwriteBindingInput)).proof as Uint8Array,
    dispose: () => failAll(new Error("On-device prover disposed")),
  };
}

/** A midnight-js ProofProvider (ledger 9) backed by the in-page prover. */
export function inPageProofProvider(zkConfigProvider: unknown, costModel: unknown, paramsBase: string) {
  const provingProvider = createInPageProvingProvider(zkConfigProvider, paramsBase);
  return createProofProviderFromHandlers({
    v8: undefined,
    v9: (tx: { deserialize: (d: { v9: typeof Transaction }) => { prove: (p: unknown, c: unknown) => unknown } }) =>
      tx.deserialize({ v9: Transaction }).prove(provingProvider, costModel),
  } as never);
}
