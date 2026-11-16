// SPDX-License-Identifier: Apache-2.0
/**
 * Choose a proof provider for a browser DApp.
 *
 * Default: prove on this device, in the page (a Web Worker running
 * @midnightntwrk/zkir-v3). Our contract is compiled with compactc 0.36.0,
 * which emits ZKIR v3. Lace 2.5.1's in-app ("Run in this app (WASM)") prover
 * is @midnight-ntwrk/zkir-v2, which rejects ZKIR v3 ("expected one of
 * 'ir-source[v2-generic]' or 'ir-source[v2]', got 'ir-source[v3-generic]'"),
 * so Lace shows "Circuit check #1 — Failed" before it proves anything.
 *
 * Overrides (for testing): `?prover=local` uses a proof server on
 * 127.0.0.1:6300; `?prover=wallet` uses the wallet's getProvingProvider().
 * The choice is remembered in localStorage under `nm.prover`.
 *
 * We do not point Midnight.js at a proof server we host. A proof server sees
 * private circuit witnesses (member sk, Merkle path, author blind) in the clear.
 * See https://docs.midnight.network/guides/local-proving
 */
import type { MidnightConnectedApiStub } from "@midnight-messenger/shared";

export const LOCAL_PROOF_SERVER = "http://localhost:6300";

export type ProverPreference = "device" | "local" | "wallet";
export type ProofProviderKind = "device" | "wallet" | "local-fallback";

export function walletOffersProvingProvider(
  api: Pick<MidnightConnectedApiStub, "getProvingProvider"> | null | undefined,
): boolean {
  return typeof api?.getProvingProvider === "function";
}

export function parseProverPreference(value: string | null | undefined): ProverPreference | undefined {
  const v = (value ?? "").trim().toLowerCase();
  return v === "device" || v === "local" || v === "wallet" ? v : undefined;
}

/** `?prover=` wins (and is remembered); otherwise the remembered choice; otherwise on-device. */
export function proverPreference(): ProverPreference {
  if (typeof window === "undefined") return "device";
  const fromUrl = parseProverPreference(new URLSearchParams(window.location.search).get("prover"));
  try {
    if (fromUrl) window.localStorage.setItem("nm.prover", fromUrl);
    return fromUrl ?? parseProverPreference(window.localStorage.getItem("nm.prover")) ?? "device";
  } catch {
    return fromUrl ?? "device";
  }
}

export async function createProofProvider(
  api: MidnightConnectedApiStub,
  zkConfigProvider: unknown,
  costModel: unknown,
  options: { preference?: ProverPreference; paramsBase: string },
): Promise<{ provider: unknown; kind: ProofProviderKind }> {
  const preference = options.preference ?? "device";
  if (preference === "device") {
    const { inPageProvingSupported, inPageProofProvider } = await import("./in-page-prover");
    if (inPageProvingSupported()) {
      return { provider: inPageProofProvider(zkConfigProvider, costModel, options.paramsBase), kind: "device" };
    }
    console.warn("This browser cannot run the on-device prover; using the local proof server instead.");
  }
  if (preference === "wallet" && walletOffersProvingProvider(api)) {
    const { dappConnectorProofProvider } = await import(
      "@midnight-ntwrk/midnight-js-dapp-connector-proof-provider"
    );
    try {
      const provider = await dappConnectorProofProvider(
        api as never,
        zkConfigProvider as never,
        costModel as never,
      );
      return { provider, kind: "wallet" };
    } catch (error) {
      console.warn(
        "The wallet did not return a proving provider; using the local proof server instead.",
        error,
      );
    }
  }
  const { httpClientProofProvider } = await import(
    "@midnight-ntwrk/midnight-js-http-client-proof-provider"
  );
  return {
    provider: httpClientProofProvider(LOCAL_PROOF_SERVER, zkConfigProvider as never),
    kind: "local-fallback",
  };
}
