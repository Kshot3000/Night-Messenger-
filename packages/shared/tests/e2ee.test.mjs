// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as E from "../src/e2ee.ts";

const sha = (...p) => new Uint8Array(createHash("sha256").update(Buffer.concat(p.map((x) => Buffer.from(x)))).digest());

test("alice -> bob round trip: only bob decrypts, sender key and author tag recovered", async () => {
  const alice = await E.createIdentity("Alice");
  const bob = await E.createIdentity("Bob");
  const eve = await E.createIdentity("Eve");
  const bobInvite = await E.parseInvite(await E.inviteCode(bob));
  const s = await E.seal(alice, bobInvite, "meet at the usual place ☾");
  const plainBytes = new TextEncoder().encode("meet at the usual place");
  assert.equal(Buffer.from(s.envelope).includes(Buffer.from(plainBytes)), false, "ciphertext must not contain plaintext");
  assert.equal(Buffer.from(s.envelope).includes(Buffer.from(alice.encPublic)), false, "relay must not see the sender's static key");

  const o = await E.open(bob, s.envelope);
  assert.equal(o.payload.body, "meet at the usual place ☾");
  assert.equal(o.senderKey, E.toB64u(alice.encPublic));
  assert.equal(o.payload.member, E.toHex(alice.member));
  assert.deepEqual(o.commitment, s.commitment);
  assert.ok(await E.verifyAuthorTag(o, s.authorTag));
  await assert.rejects(E.open(eve, s.envelope), /cannot decrypt/);
});

test("tampering with any envelope byte is rejected", async () => {
  const a = await E.createIdentity("A");
  const b = await E.createIdentity("B");
  const s = await E.seal(a, await E.publicIdentity(b), "hello");
  for (const i of [0, 5, 40, 70, 100, s.envelope.length - 1]) {
    const t = s.envelope.slice();
    t[i] ^= 1;
    await assert.rejects(E.open(b, t));
  }
});

test("each message gets a fresh ephemeral key and blind", async () => {
  const a = await E.createIdentity("A");
  const b = await E.publicIdentity(await E.createIdentity("B"));
  const [x, y] = [await E.seal(a, b, "same"), await E.seal(a, b, "same")];
  assert.notDeepEqual(x.envelope.subarray(1, 33), y.envelope.subarray(1, 33));
  assert.notEqual(x.payload.blind, y.payload.blind);
  assert.notDeepEqual(x.commitment, y.commitment);
});

test("contract mirrors equal SHA-256 over the Compact encodings", async () => {
  const sk = new Uint8Array(32).fill(7);
  assert.equal(E.toHex(await E.memberCommitment(sk)), "b060a1af05f507dec3301c7f90fa373c8de6839f64285d02afcca9762b0a267a");
  const c = new Uint8Array(32).fill(1), m = new Uint8Array(32).fill(2), bl = new Uint8Array(32).fill(3);
  assert.deepEqual(await E.authorTag(c, m, bl), sha(E.pad32("nm:author:v1"), c, m, bl));
  assert.deepEqual(await E.inboxIdFor(m, c), sha(E.pad32("nm:inbox:v1"), m, c));
  assert.deepEqual(await E.memberLeaf(c, E.INITIAL_EPOCH, m), sha(E.pad32("nm:leaf:v2"), c, E.INITIAL_EPOCH, m));
});

test("DM inbox ids come from the X25519 shared secret: both parties agree, an outsider cannot derive them", async () => {
  const a = await E.createIdentity("A"), b = await E.createIdentity("B"), m = await E.createIdentity("Mallory");
  const [A, B] = [await E.publicIdentity(a), await E.publicIdentity(b)];
  const ab = await E.dmInboxes(a, B), ba = await E.dmInboxes(b, A);
  assert.deepEqual(ab.seed, ba.seed);
  assert.deepEqual(ab.mine, ba.theirs);
  assert.deepEqual(ab.theirs, ba.mine);
  // the old public-only derivation is gone: knowing both invites is not enough
  const mb = await E.dmInboxes(m, B), ma = await E.dmInboxes(m, A);
  for (const x of [mb.seed, ma.seed]) assert.notDeepEqual(x, ab.seed);
  for (const x of [mb.mine, mb.theirs, ma.mine, ma.theirs]) {
    assert.notDeepEqual(x, ab.mine);
    assert.notDeepEqual(x, ab.theirs);
  }
});

test("open() can refuse a payload that names an unexpected inbox", async () => {
  const a = await E.createIdentity("A"), b = await E.createIdentity("B");
  const ok = await E.seal(a, await E.publicIdentity(b), "hi");
  const exp = await E.dmInboxes(b, await E.publicIdentity(a));
  assert.equal((await E.open(b, ok.envelope, { expectedInboxes: [exp.mine, exp.theirs] })).payload.body, "hi");
  const bad = await E.seal(a, await E.publicIdentity(b), "hi", { inbox: new Uint8Array(32).fill(9) });
  await assert.rejects(E.open(b, bad.envelope, { expectedInboxes: [exp.mine, exp.theirs] }), /unexpected inbox/);
});

test("author disclosure: a third party can verify who wrote one message; a wrong member fails", async () => {
  const a = await E.createIdentity("A");
  const b = await E.createIdentity("B");
  const s = await E.seal(a, await E.publicIdentity(b), "tip");
  const d = E.authorDisclosure(await E.open(b, s.envelope));
  assert.ok(await E.checkAuthorDisclosure(d, s.authorTag));
  assert.equal(await E.checkAuthorDisclosure({ ...d, member: E.toHex(b.member) }, s.authorTag), false);
});

test("invites are validated; tampered mailbox or key is refused", async () => {
  const b = await E.createIdentity("Bob");
  const code = await E.inviteCode(b);
  const inv = await E.parseInvite(code);
  assert.equal(inv.mailbox, await E.mailboxFor(b.encPublic));
  assert.ok(!code.includes(E.toHex(b.chainSecret)), "invite must not carry the chain secret");
  const bad = { ...inv, mailbox: "00".repeat(32) };
  await assert.rejects(E.parseInvite("nm1:" + E.toB64u(new TextEncoder().encode(JSON.stringify(bad)))), /does not match/);
  await assert.rejects(E.parseInvite("hello"), /not a Night Messenger invite/);
});

test("passphrase backup round-trips and rejects a wrong passphrase", async () => {
  const a = await E.createIdentity("A");
  const blob = await E.backupIdentity(a, "correct horse battery");
  assert.ok(!JSON.stringify(blob).includes(E.toHex(a.chainSecret)));
  const back = await E.restoreIdentity(blob, "correct horse battery");
  assert.deepEqual(back.member, a.member);
  const b = await E.createIdentity("B");
  const s = await E.seal(b, await E.publicIdentity(back), "still works");
  assert.equal((await E.open(a, s.envelope)).payload.body, "still works");
  await assert.rejects(E.restoreIdentity(blob, "wrong passphrase!"), /wrong passphrase/);
  await assert.rejects(E.backupIdentity(a, "short"), /at least 8/);
});
