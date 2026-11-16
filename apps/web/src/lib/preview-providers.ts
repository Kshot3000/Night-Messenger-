// SPDX-License-Identifier: Apache-2.0
import type { Identity, MidnightConnectedApiStub } from "@midnight-messenger/shared";
import { toHex } from "@midnight-messenger/shared";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { dappConnectorWalletProviders } from "@midnight-ntwrk/midnight-js-dapp-connector-proof-provider";
import { CostModel } from "@midnight-ntwrk/midnight-js-protocol/v9";
import { networks } from "@midnight-ntwrk/midnight-js-utils";
import { Level } from "level";
import { createProofProvider, type ProofProviderKind } from "./proof-provider";
import { storagePasswordFromSecret } from "./storage-password";

function publicBasePath(): string {
  const fromEnv = process.env.NEXT_PUBLIC_BASE_PATH;
  if (fromEnv != null && fromEnv.length > 0) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/Night-Messenger-")) {
    return "/Night-Messenger-";
  }
  return "";
}

/** Origin + base path where this site serves keys/, zkir/, and compiler/. */
export function zkConfigBaseUrl(): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${publicBasePath()}/zk/night_messenger`;
}

export type PreviewProviders = Awaited<ReturnType<typeof buildPreviewProviders>>;

export async function buildPreviewProviders(
  api: MidnightConnectedApiStub,
  identity: Identity,
) {
  const preview = networks.preview();
  // Use Midnight's hosted Preview indexer, not whatever the wallet last cached.
  // Lace 2.4.3 has been seen pointing at a retired Blockfrost host.
  const publicDataProvider = indexerPublicDataProvider({
    queryURL: preview.indexer.queryURL,
    subscriptionURL: preview.indexer.subscriptionURL,
    webSocket: typeof WebSocket !== "undefined" ? WebSocket : undefined,
  });

  const zkConfigProvider = new FetchZkConfigProvider(zkConfigBaseUrl(), {
    fetchFunc: fetch.bind(globalThis),
    verify: "require",
  });

  const costModel = CostModel.initialCostModel();
  const { provider: proofProvider, kind: provingKind } = await createProofProvider(
    api,
    zkConfigProvider,
    costModel,
  );

  const { walletProvider, midnightProvider } = await dappConnectorWalletProviders(api as never);

  const privateStateProvider = levelPrivateStateProvider({
    accountId: `nm:${toHex(identity.member)}`,
    privateStoragePasswordProvider: () => storagePasswordFromSecret(identity.chainSecret),
    midnightDbName: "night-messenger-preview",
    levelFactory: (dbName: string) =>
      new Level(dbName, { valueEncoding: "utf8" }) as never,
  });

  return {
    privateStateProvider,
    zkConfigProvider,
    proofProvider: proofProvider as never,
    publicDataProvider,
    walletProvider,
    midnightProvider,
    config: { networkId: preview.networkId, ttlSeconds: 3600 },
    provingKind: provingKind as ProofProviderKind,
  };
}
