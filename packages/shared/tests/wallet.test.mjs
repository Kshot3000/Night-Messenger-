import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  connectMidnightWallet,
  discoverMidnightProviders,
  DEFAULT_MIDNIGHT_NETWORK,
} from "../src/wallet.ts";
afterEach(() => {
  delete globalThis.window;
});

test("wallet discovery is safe without a browser or extension", async () => {
  assert.deepEqual(discoverMidnightProviders(), []);
  assert.equal((await connectMidnightWallet()).status, "unavailable");
  globalThis.window = {};
  assert.equal((await connectMidnightWallet()).status, "unavailable");
});

test("the default network is Midnight Preview", () => {
  assert.equal(DEFAULT_MIDNIGHT_NETWORK, "preview");
});

test("a chosen wallet receives the network and returns a verified address", async () => {
  let network;
  globalThis.window = {
    midnight: {
      random_injection_uuid: {
        name: "Test wallet",
        rdns: "io.lace.wallet",
        apiVersion: "4.1.0",
        connect: async (id) => {
          network = id;
          return {
            getShieldedAddresses: async () => ({
              shieldedAddress: "mn_shield-addr_preview_sample",
            }),
            getUnshieldedAddress: async () => ({
              unshieldedAddress: "mn_addr_preview1sample",
            }),
            getConnectionStatus: async () => ({
              status: "connected",
              networkId: "preview",
            }),
            getProvingProvider: async () => ({}),
          };
        },
      },
      irrelevant: { name: "Not a provider" },
    },
  };
  assert.equal(discoverMidnightProviders().length, 1);
  const result = await connectMidnightWallet({
    injectionKey: "random_injection_uuid",
  });
  assert.equal(network, "preview");
  assert.equal(result.status, "connected");
  assert.equal(result.networkId, "preview");
  assert.equal(result.shieldedAddress, "mn_shield-addr_preview_sample");
  assert.equal(result.unshieldedAddress, "mn_addr_preview1sample");
  assert.equal(typeof result.api?.getProvingProvider, "function");
});

test("an explicit networkId is still honored", async () => {
  let network;
  globalThis.window = {
    midnight: {
      random_injection_uuid: {
        name: "Test wallet",
        connect: async (id) => {
          network = id;
          return {
            getShieldedAddresses: async () => ({
              shieldedAddress: "mn_shield-addr_preprod_sample",
            }),
          };
        },
      },
    },
  };
  const result = await connectMidnightWallet({
    injectionKey: "random_injection_uuid",
    networkId: "preprod",
  });
  assert.equal(network, "preprod");
  assert.equal(result.status, "connected");
  assert.equal(result.networkId, "preprod");
});

test("a wallet on the wrong network does not report success", async () => {
  globalThis.window = {
    midnight: {
      lace: {
        connect: async () => ({
          getShieldedAddresses: async () => ({
            shieldedAddress: "mn_shield-addr_mainnet_sample",
          }),
          getConnectionStatus: async () => ({
            status: "connected",
            networkId: "mainnet",
          }),
        }),
      },
    },
  };
  const result = await connectMidnightWallet({ networkId: "preview" });
  assert.equal(result.status, "disconnected");
  assert.match(result.error, /mainnet/);
  assert.match(result.error, /preview/);
});

test("a missing selected wallet never falls back to a different wallet", async () => {
  let called = false;
  globalThis.window = {
    midnight: {
      another: {
        connect: async () => {
          called = true;
        },
      },
    },
  };
  assert.equal(
    (await connectMidnightWallet({ injectionKey: "removed" })).status,
    "unavailable",
  );
  assert.equal(called, false);
});

test("rejection, unusable responses and timeouts do not report success", async () => {
  for (const connect of [
    async () => {
      throw new Error("Permission declined");
    },
    async () => ({}),
    async () => ({ getShieldedAddresses: async () => ({}) }),
    () => new Promise(() => {}),
  ]) {
    globalThis.window = { midnight: { provider: { connect } } };
    const result = await connectMidnightWallet({ timeoutMs: 5 });
    assert.equal(result.status, "disconnected");
    assert.ok(result.error);
  }
});
