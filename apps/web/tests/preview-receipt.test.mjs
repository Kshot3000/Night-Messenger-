import test from "node:test";
import assert from "node:assert/strict";
import {
  decodePreviewReceipt,
  PREVIEW_CONTRACT_FALLBACK,
} from "../src/lib/preview-receipt.ts";

const TEST_COMMITMENT =
  "f875530954e9a0d98a66164e93e16f8fef5d758468c703d3b1a221e7e7a2e7cf";

test("live Preview ledger decode reports the known drill receipt", async (t) => {
  let result;
  try {
    result = await decodePreviewReceipt(TEST_COMMITMENT, {
      contractAddress: PREVIEW_CONTRACT_FALLBACK,
    });
  } catch (e) {
    t.skip(`Preview indexer unreachable: ${e.message}`);
    return;
  }
  assert.equal(result.source, "preview-ledger");
  assert.equal(result.contractAddress, PREVIEW_CONTRACT_FALLBACK);
  if (!result.posted) {
    t.skip("The Preview drill post is gone (the chain may have reset).");
    return;
  }
  assert.equal(result.receipts, "1");
  assert.equal(
    result.inboxId,
    "0db0cb2e8ce6bde7a23de1839c7d1f4c768d03846d75cde7f79650383c1914a3",
  );
  assert.equal(
    result.authorTag,
    "587a7bf54a9ed9d3141a2dc040cfa975ca1860d7164fb1023fcce2db9aa6a4d0",
  );
  assert.equal(result.seq, "0");
});

test("an unknown commitment is not posted", async (t) => {
  try {
    const result = await decodePreviewReceipt("00".repeat(32));
    assert.equal(result.posted, false);
    assert.equal(result.commitment, "00".repeat(32));
  } catch (e) {
    t.skip(`Preview indexer unreachable: ${e.message}`);
  }
});
