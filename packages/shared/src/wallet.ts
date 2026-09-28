/**
 * Lace / Midnight wallet discovery.
 *
 * Lace injects under a fresh UUID key on `window.midnight`.
 * Do NOT hardcode `window.midnight.mnLace` — enumerate with Object.values / Object.keys.
 *
 * @see https://docs.midnight.network/guides/react-wallet-connect
 *
 * TODO: pin @midnight-ntwrk/dapp-connector-api when wiring production connect.
 */

import type { WalletSession } from './types';

export interface MidnightInitialApiStub {
  name?: string;
  icon?: string;
  rdns?: string;
  apiVersion?: string;
  connect?: (networkId?: string) => Promise<MidnightConnectedApiStub>;
  enable?: () => Promise<unknown>;
  isEnabled?: () => Promise<boolean>;
}

export interface MidnightConnectedApiStub {
  getShieldedAddresses?: () => Promise<{ shieldedAddress?: string } | string[]>;
  getConnectionStatus?: () => Promise<boolean>;
}

export interface DiscoveredProvider {
  injectionKey: string;
  api: MidnightInitialApiStub;
}

function assertBrowser(): void {
  if (typeof window === 'undefined') {
    throw new Error('Midnight wallet connector is browser-only (window undefined).');
  }
}

/** Enumerate wallets via Object.keys — never hardcode mnLace. */
export function discoverMidnightProviders(): DiscoveredProvider[] {
  assertBrowser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const midnight = (window as any).midnight as Record<string, MidnightInitialApiStub> | undefined;
  if (!midnight) return [];

  const providers: DiscoveredProvider[] = [];
  for (const key of Object.keys(midnight)) {
    const api = midnight[key];
    if (!api) continue;
    if (typeof api.connect !== 'function' && typeof api.enable !== 'function') continue;
    providers.push({ injectionKey: key, api });
  }
  return providers;
}

/** Object.values-first enumeration (same rule, values style). */
export function listMidnightApis(): MidnightInitialApiStub[] {
  assertBrowser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const midnight = (window as any).midnight as Record<string, MidnightInitialApiStub> | undefined;
  if (!midnight) return [];
  return Object.values(midnight).filter(
    (api) => api && (typeof api.connect === 'function' || typeof api.enable === 'function'),
  );
}

export function abbreviateAddress(addr: string, head = 8, tail = 6): string {
  if (addr.length <= head + tail + 3) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function safeWalletLabel(api: MidnightInitialApiStub): string {
  return String(api.name ?? 'Midnight wallet').replace(/[\u0000-\u001F<>]/g, '');
}

/**
 * Connect to first discovered provider (or chosen injection key).
 * TODO: wallet picker when multiple providers / duplicate rdns.
 */
export async function connectMidnightWallet(options?: {
  injectionKey?: string;
  networkId?: string;
}): Promise<WalletSession> {
  try {
    assertBrowser();
  } catch {
    return { status: 'unavailable', error: 'Wallet connect requires a browser.' };
  }

  const providers = discoverMidnightProviders();
  if (providers.length === 0) {
    return {
      status: 'unavailable',
      error:
        'No Midnight wallet found. Install Lace with Midnight enabled, then refresh. Enumerate Object.values(window.midnight) — do not hardcode mnLace.',
    };
  }

  const chosen =
    (options?.injectionKey
      ? providers.find((p) => p.injectionKey === options.injectionKey)
      : undefined) ?? providers[0]!;

  const networkId = options?.networkId ?? 'preprod';

  try {
    let shieldedAddress: string | undefined;

    if (typeof chosen.api.connect === 'function') {
      const connected = await chosen.api.connect(networkId);
      if (connected?.getShieldedAddresses) {
        const addrs = await connected.getShieldedAddresses();
        if (Array.isArray(addrs)) {
          shieldedAddress = typeof addrs[0] === 'string' ? addrs[0] : undefined;
        } else if (addrs && typeof addrs === 'object') {
          shieldedAddress = addrs.shieldedAddress;
        }
      }
    } else if (typeof chosen.api.enable === 'function') {
      await chosen.api.enable();
    }

    return {
      status: 'connected',
      injectionKey: chosen.injectionKey,
      walletName: safeWalletLabel(chosen.api),
      rdns: chosen.api.rdns,
      apiVersion: chosen.api.apiVersion,
      shieldedAddress,
      addressPreview: shieldedAddress ? abbreviateAddress(shieldedAddress) : undefined,
    };
  } catch (err) {
    return {
      status: 'disconnected',
      injectionKey: chosen.injectionKey,
      walletName: safeWalletLabel(chosen.api),
      error: err instanceof Error ? err.message : 'Failed to connect wallet',
    };
  }
}
