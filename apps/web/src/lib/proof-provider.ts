// SPDX-License-Identifier: Apache-2.0
/**
 * Choose a proof provider for a browser DApp.
 *
 * Prefer the wallet's `getProvingProvider()` so proving follows Lace Settings →
 * Midnight (Local or, when the wallet offers it, Remote). Fall back to a local
 * proof server on 127.0.0.1:6300 if the method is missing or rejects.
 *
 * We do not point Midnight.js at a proof server we host. A proof server sees
 * private circuit witnesses (member sk, Merkle path, author blind) and, for
 * wallet proofs, coin and DUST secret keys, in the clear.
 * See https://docs.midnight.network/guides/local-proving
 */
import type { MidnightConnectedApiStub } from "@midnight-messenger/shared";

export const LOCAL_PROOF_SERVER = "http://localhost:6300";

export function walletOffersProvingProvider(
  api: Pick<MidnightConnectedApiStub, "getProvingProvider"> | null | undefined,
): boolean {
  return typeof api?.getProvingProvider === "function";
}

export type ProofProviderKind = "wallet" | "local-fallback";

export async function createProofProvider(
  api: MidnightConnectedApiStub,
  zkConfigProvider: unknown,
  costModel: unknown,
): Promise<{ provider: unknown; kind: ProofProviderKind }> {
  if (walletOffersProvingProvider(api)) {
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
