/** Midnight DApp Connector API surface used by this preview.
 * https://github.com/midnightntwrk/midnight-dapp-connector-api
 * Wallets are discovered by their injected key (`rdns` / `apiVersion`), never a hardcoded provider name.
 */
import type { WalletSession } from "./types";

/** Network id passed to `connect()`. Preview is the live tester network. */
export const DEFAULT_MIDNIGHT_NETWORK = "preview";

export interface MidnightInitialApiStub {
  name?: string;
  icon?: string;
  rdns?: string;
  apiVersion?: string;
  connect?: (networkId: string) => Promise<MidnightConnectedApiStub>;
}

export interface MidnightConnectionStatus {
  status?: string;
  networkId?: string;
}

export interface MidnightConnectedApiStub {
  getShieldedAddresses?: () => Promise<{ shieldedAddress?: string }>;
  getUnshieldedAddress?: () => Promise<{ unshieldedAddress?: string }>;
  getConnectionStatus?: () => Promise<MidnightConnectionStatus>;
  getProvingProvider?: (keyMaterialProvider: unknown) => Promise<unknown>;
  hintUsage?: (methodNames: string[]) => Promise<void>;
  balanceUnsealedTransaction?: (tx: string, options?: { payFees?: boolean }) => Promise<{ tx: string }>;
  submitTransaction?: (tx: string) => Promise<void>;
}

export interface DiscoveredProvider {
  injectionKey: string;
  api: MidnightInitialApiStub;
}

/** Successful connect also yields the live API object (kept in memory only; not serializable). */
export type MidnightConnectResult = WalletSession & {
  api?: MidnightConnectedApiStub;
};

export function discoverMidnightProviders(): DiscoveredProvider[] {
  if (typeof window === "undefined") return [];
  const injected = (window as Window & { midnight?: unknown }).midnight;
  if (!injected || typeof injected !== "object") return [];
  return Object.entries(injected).flatMap(([injectionKey, value]) => {
    if (
      !value ||
      typeof value !== "object" ||
      typeof (value as MidnightInitialApiStub).connect !== "function"
    )
      return [];
    return [{ injectionKey, api: value as MidnightInitialApiStub }];
  });
}

export function listMidnightApis(): MidnightInitialApiStub[] {
  return discoverMidnightProviders().map((provider) => provider.api);
}

export function abbreviateAddress(address: string, head = 8, tail = 6): string {
  return address.length <= head + tail + 3
    ? address
    : `${address.slice(0, head)}…${address.slice(-tail)}`;
}

export function safeWalletLabel(api: MidnightInitialApiStub): string {
  return (
    String(api.name ?? "Midnight wallet")
      .replace(/[\u0000-\u001F<>]/g, "")
      .slice(0, 60) || "Midnight wallet"
  );
}

function safeNetworkLabel(id: string): string {
  return String(id)
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 32);
}

export async function connectMidnightWallet(options?: {
  injectionKey?: string;
  networkId?: string;
  timeoutMs?: number;
}): Promise<MidnightConnectResult> {
  const networkId = options?.networkId ?? DEFAULT_MIDNIGHT_NETWORK;
  if (typeof window === "undefined")
    return {
      status: "unavailable",
      error: "Wallet connect requires a browser.",
    };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const providers = discoverMidnightProviders();
    if (!providers.length)
      return {
        status: "unavailable",
        error:
          "No compatible Midnight wallet found. Enable the Lace desktop extension (or another wallet with DApp Connector support), then try again. Phones cannot connect Lace.",
      };
    const chosen = options?.injectionKey
      ? providers.find((p) => p.injectionKey === options.injectionKey)
      : providers[0];
    if (!chosen)
      return {
        status: "unavailable",
        error:
          "That wallet is no longer available. Close this dialog and choose a wallet again.",
      };
    const attempt = async (): Promise<MidnightConnectResult> => {
      const connected = await chosen.api.connect!(networkId);
      if (!connected || typeof connected.getShieldedAddresses !== "function")
        throw new Error(
          "This wallet returned an unsupported connection. Please update your wallet extension.",
        );
      if (typeof connected.getConnectionStatus === "function") {
        const st = await connected.getConnectionStatus();
        if (st?.status === "disconnected")
          throw new Error(
            "The wallet reported it is not connected. Approve the request and try again.",
          );
        if (
          st?.status === "connected" &&
          typeof st.networkId === "string" &&
          st.networkId &&
          st.networkId !== networkId
        ) {
          const got = safeNetworkLabel(st.networkId) || "a different network";
          throw new Error(
            `This wallet is on ${got}, not Midnight ${networkId}. In Lace, switch the Midnight network to ${networkId} and connect again.`,
          );
        }
      }
      const addresses = await connected.getShieldedAddresses();
      const address = addresses?.shieldedAddress;
      if (typeof address !== "string" || !address.trim())
        throw new Error(
          "The wallet did not provide a shielded address. Unlock it and try again.",
        );
      let unshieldedAddress: string | undefined;
      if (typeof connected.getUnshieldedAddress === "function") {
        try {
          const u = await connected.getUnshieldedAddress();
          if (typeof u?.unshieldedAddress === "string" && u.unshieldedAddress.trim())
            unshieldedAddress = u.unshieldedAddress;
        } catch {
          /* optional on older wallets */
        }
      }
      return {
        status: "connected",
        injectionKey: chosen.injectionKey,
        walletName: safeWalletLabel(chosen.api),
        rdns: chosen.api.rdns,
        apiVersion: chosen.api.apiVersion,
        shieldedAddress: address,
        unshieldedAddress,
        networkId,
        addressPreview: abbreviateAddress(unshieldedAddress || address),
        api: connected,
      };
    };
    return await Promise.race([
      attempt(),
      new Promise<MidnightConnectResult>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                "The wallet did not respond. Check its permission prompt, then try again.",
              ),
            ),
          options?.timeoutMs ?? 30000,
        );
      }),
    ]);
  } catch (error) {
    return {
      status: "disconnected",
      error:
        error instanceof Error
          ? error.message.slice(0, 240)
          : "Connection was declined or interrupted. You can try again.",
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
