/** Minimal Midnight DApp Connector v4 surface used by this preview.
 * https://github.com/midnightntwrk/midnight-dapp-connector-api
 * Wallets are discovered by their injected key, never a hardcoded provider name.
 */
import type { WalletSession } from "./types";

export interface MidnightInitialApiStub {
  name?: string;
  icon?: string;
  rdns?: string;
  apiVersion?: string;
  connect?: (networkId: string) => Promise<MidnightConnectedApiStub>;
}
export interface MidnightConnectedApiStub {
  getShieldedAddresses?: () => Promise<{ shieldedAddress?: string }>;
}
export interface DiscoveredProvider {
  injectionKey: string;
  api: MidnightInitialApiStub;
}

export function discoverMidnightProviders(): DiscoveredProvider[] {
  if (typeof window === "undefined") return [];
  const injected = (window as Window & { midnight?: unknown }).midnight;
  if (!injected || typeof injected !== "object") return [];
  return Object.entries(injected).flatMap(([injectionKey, value]) => {
    if (
      !value ||
      typeof value !== "object" ||
      typeof value.connect !== "function"
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
export async function connectMidnightWallet(options?: {
  injectionKey?: string;
  networkId?: string;
  timeoutMs?: number;
}): Promise<WalletSession> {
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
          "No compatible Midnight wallet found. Enable a wallet with DApp Connector v4 support, then try again. You can explore without a wallet.",
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
    const attempt = async (): Promise<WalletSession> => {
      const connected = await chosen.api.connect!(
        options?.networkId ?? "preprod",
      );
      if (!connected || typeof connected.getShieldedAddresses !== "function")
        throw new Error(
          "This wallet returned an unsupported connection. Please update your wallet extension.",
        );
      const addresses = await connected.getShieldedAddresses();
      const address = addresses?.shieldedAddress;
      if (typeof address !== "string" || !address.trim())
        throw new Error(
          "The wallet did not provide a shielded address. Unlock it and try again.",
        );
      return {
        status: "connected",
        injectionKey: chosen.injectionKey,
        walletName: safeWalletLabel(chosen.api),
        rdns: chosen.api.rdns,
        apiVersion: chosen.api.apiVersion,
        shieldedAddress: address,
        addressPreview: abbreviateAddress(address),
      };
    };
    return await Promise.race([
      attempt(),
      new Promise<WalletSession>((_, reject) => {
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
