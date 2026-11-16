import test from "node:test";
import assert from "node:assert/strict";
import { describeError, maskBytes } from "../src/lib/error-detail.ts";

test("describeError walks the cause chain", () => {
  const inner = new Error("expected one of 'ir-source[v2-generic]' or 'ir-source[v2]', got 'ir-source[v3-generic]'");
  const outer = new Error("proveTx rejected the transaction (circuit 'createInbox').", { cause: inner });
  const text = describeError(outer);
  assert.match(text, /proveTx rejected/);
  assert.match(text, /cause: expected one of/);
});

test("describeError masks long hex so no tx or witness bytes reach the UI", () => {
  const sk = "ab".repeat(32);
  assert.equal(maskBytes(`sk=${sk}`), "sk=[bytes]");
  assert.doesNotMatch(describeError(new Error(`bad ${sk}`)), /abab/);
});

test("describeError handles strings, cycles, and empty input", () => {
  assert.equal(describeError("plain"), "plain");
  const a = new Error("a");
  a.cause = a;
  assert.equal(describeError(a), "a");
  assert.equal(describeError(undefined), "Unknown error");
});
