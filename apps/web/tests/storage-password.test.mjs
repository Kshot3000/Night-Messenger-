import test from "node:test";
import assert from "node:assert/strict";
import {
  passwordLooksValid,
  storagePasswordFromSecret,
} from "../src/lib/storage-password.ts";

test("a derived storage password meets the midnight-js strength rules", () => {
  const samples = [
    new Uint8Array(32).fill(0),
    new Uint8Array(32).fill(15),
    Uint8Array.from({ length: 32 }, (_, i) => i),
    Uint8Array.from({ length: 32 }, (_, i) => (i * 17) & 0xff),
  ];
  for (const s of samples) {
    const p = storagePasswordFromSecret(s);
    assert.ok(passwordLooksValid(p), `rejected: ${p}`);
    assert.equal(storagePasswordFromSecret(s), p);
  }
});
