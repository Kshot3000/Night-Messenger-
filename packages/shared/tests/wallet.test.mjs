import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  connectMidnightWallet,
  discoverMidnightProviders,
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
test("a chosen wallet receives the network and returns a verified address", async () => {
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
      irrelevant: { name: "Not a provider" },
    },
  };
  assert.equal(discoverMidnightProviders().length, 1);
  const result = await connectMidnightWallet({
    injectionKey: "random_injection_uuid",
    networkId: "preprod",
  });
  assert.equal(network, "preprod");
  assert.equal(result.status, "connected");
  assert.equal(result.shieldedAddress, "mn_shield-addr_preprod_sample");
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
