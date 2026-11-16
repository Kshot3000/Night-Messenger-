import test from "node:test";
import assert from "node:assert/strict";
import {
  LOCAL_PROOF_SERVER,
  walletOffersProvingProvider,
} from "../src/lib/proof-provider.ts";

test("Lace-shaped APIs that expose getProvingProvider are detected", () => {
  assert.equal(walletOffersProvingProvider({ getProvingProvider: async () => ({}) }), true);
  assert.equal(walletOffersProvingProvider({}), false);
  assert.equal(walletOffersProvingProvider(null), false);
  assert.equal(LOCAL_PROOF_SERVER, "http://localhost:6300");
});
