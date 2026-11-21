import test from "node:test";
import assert from "node:assert/strict";
import {
  LOCAL_PROOF_SERVER,
  parseProverPreference,
  proverPreference,
  walletOffersProvingProvider,
} from "../src/lib/proof-provider.ts";
import { SRS_PARAM_SHA256, srsParamFileName } from "../src/lib/zk-params.ts";

test("Lace-shaped APIs that expose getProvingProvider are detected", () => {
  assert.equal(walletOffersProvingProvider({ getProvingProvider: async () => ({}) }), true);
  assert.equal(walletOffersProvingProvider({}), false);
  assert.equal(walletOffersProvingProvider(null), false);
  assert.equal(LOCAL_PROOF_SERVER, "http://localhost:6300");
});

test("prover preference defaults to on-device and only accepts known values", () => {
  assert.equal(proverPreference(), "device"); // no window in Node
  assert.equal(parseProverPreference("LOCAL"), "local");
  assert.equal(parseProverPreference(" wallet "), "wallet");
  assert.equal(parseProverPreference("device"), "device");
  assert.equal(parseProverPreference("remote"), undefined);
  assert.equal(parseProverPreference(null), undefined);
});

test("SRS params for our circuit sizes are pinned", () => {
  for (const k of [13, 14, 15]) assert.match(SRS_PARAM_SHA256[k], /^[0-9a-f]{64}$/);
  assert.equal(srsParamFileName(14), "bls_midnight_2p14");
});
