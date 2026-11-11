// SPDX-License-Identifier: Apache-2.0
/**
 * Off-chain simulation of night_messenger.compact with the compiler-generated
 * Contract and @midnight-ntwrk/compact-runtime 0.16.0: no network, no proof
 * server. Every circuit runs exactly as before proving (witnesses, ledger
 * reads/writes, asserts). The E2EE side uses the real packages/shared e2ee.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import * as RT from "@midnight-ntwrk/compact-runtime";
import { Contract, ledger, pureCircuits as P } from "../src/managed/night_messenger/contract/index.js";
import * as E from "../../packages/shared/src/e2ee.ts";

const COIN = "0".repeat(64);
const ADDR = RT.sampleContractAddress();
const b32 = () => new Uint8Array(randomBytes(32));
const hex = (b) => Buffer.from(b).toString("hex");

const witnesses = {
  localSecretKey: ({ privateState }) => [privateState, privateState.sk],
  memberPath: ({ privateState, ledger: l }, leaf) => {
    const p = privateState.path ?? l.members.findPathForLeaf(leaf);
    if (!p) throw new Error("not a member (no Merkle path)");
    return [privateState, p];
  },
  authorBlind: ({ privateState }, _c) => [privateState, privateState.blind ?? new Uint8Array(32)],
};
const contract = new Contract(witnesses);
const deploy = (ps) => contract.initialState(RT.createConstructorContext(ps, COIN)).currentContractState;
const call = (state, ps, name, ...args) =>
  contract.impureCircuits[name](RT.createCircuitContext(ADDR, COIN, state, ps), ...args).context.currentQueryContext.state;
const L = (s) => ledger(s);

const owner = { sk: b32() };
const alice = { sk: b32() };
const bob = { sk: b32() };
const mallory = { sk: b32() };
const mc = (p) => P.memberCommitment(p.sk);
const INBOX = b32();

function world() {
  let s = deploy(owner).data;
  s = call(s, owner, "createInbox", INBOX);
  s = call(s, owner, "addMember", INBOX, mc(alice));
  s = call(s, owner, "addMember", INBOX, mc(bob));
  return s;
}

test("pure helpers match the browser SDK (SHA-256 over Compact encodings)", async () => {
  const sk = b32(), c = b32(), bl = b32();
  assert.equal(hex(P.memberCommitment(sk)), hex(await E.memberCommitment(sk)));
  assert.equal(hex(P.ownerCommitment(sk)), hex(await E.ownerCommitment(sk)));
  assert.equal(hex(P.memberLeaf(INBOX, sk)), hex(await E.memberLeaf(INBOX, sk)));
  assert.equal(hex(P.authorTag(c, sk, bl)), hex(await E.authorTag(c, sk, bl)));
  assert.equal(hex(P.ackNullifier(c, sk)), hex(await E.ackNullifier(c, sk)));
});

test("inbox: owner adds members; only leaves are public; non-owners cannot add", () => {
  const s = world();
  const l = L(s);
  const box = l.inboxes.lookup(INBOX);
  assert.equal(box.members, 2n);
  assert.equal(hex(box.owner), hex(P.ownerCommitment(owner.sk)));
  assert.ok(l.memberIndex.member(P.memberLeaf(INBOX, mc(alice))));
  assert.equal(l.memberIndex.member(mc(alice)), false, "member commitment itself is never stored");
  assert.throws(() => call(s, mallory, "addMember", INBOX, mc(mallory)), /not the inbox owner/);
  assert.throws(() => call(s, owner, "addMember", INBOX, mc(alice)), /already a member/);
  assert.throws(() => call(s, owner, "createInbox", INBOX), /already exists/);
});

test("end to end: alice seals for bob, posts the commitment anonymously, bob verifies the author tag", async () => {
  let s = world();
  const A = await E.createIdentity("Alice");
  const B = await E.createIdentity("Bob");
  // Use the E2EE identities' chain secrets as the Midnight member secrets.
  const aPs = { sk: A.chainSecret };
  const bPs = { sk: B.chainSecret };
  s = call(s, owner, "addMember", INBOX, A.member);
  s = call(s, owner, "addMember", INBOX, B.member);

  const sealed = await E.seal(A, await E.publicIdentity(B), "verified staff here: the report is real", { inbox: INBOX });
  s = call(s, { ...aPs, blind: E.fromHex(sealed.payload.blind) }, "postEnvelope", INBOX, sealed.commitment);

  const post = L(s).posts.lookup(sealed.commitment);
  assert.equal(hex(post.inboxId), hex(INBOX));
  assert.equal(L(s).postCount, 1n);
  // Public record reveals neither the member commitment nor the body.
  assert.notEqual(hex(post.authorTag), hex(A.member));

  const opened = await E.open(B, sealed.envelope);
  assert.ok(await E.verifyAuthorTag(opened, post.authorTag), "recipient verifies sender from ledger");
  // A third party with the disclosure bundle can verify too; a forged member cannot.
  const d = E.authorDisclosure(opened);
  assert.ok(await E.checkAuthorDisclosure(d, post.authorTag));
  assert.equal(await E.checkAuthorDisclosure({ ...d, member: hex(B.member) }, post.authorTag), false);

  // Delivery receipt: bob acks once, anonymously.
  s = call(s, bPs, "ackDelivery", sealed.commitment);
  assert.equal(L(s).ackCount.lookup(sealed.commitment), 1n);
  assert.ok(L(s).acks.member(P.ackNullifier(sealed.commitment, B.chainSecret)));
  assert.throws(() => call(s, bPs, "ackDelivery", sealed.commitment), /already acknowledged/);
});

test("non-members cannot post or ack; replays of a commitment are refused", () => {
  let s = world();
  const c = b32();
  assert.throws(() => call(s, mallory, "postEnvelope", INBOX, c), /no Merkle path|not a/);
  s = call(s, { ...alice, blind: b32() }, "postEnvelope", INBOX, c);
  assert.throws(() => call(s, { ...bob, blind: b32() }, "postEnvelope", INBOX, c), /already posted/);
  assert.throws(() => call(s, mallory, "ackDelivery", c), /no Merkle path|not a/);
  assert.throws(() => call(s, alice, "ackDelivery", b32()), /unknown message/);
});

test("membership is bound to the inbox: a member of inbox A cannot post into inbox B", () => {
  let s = world();
  const OTHER = b32();
  s = call(s, mallory, "createInbox", OTHER); // mallory owns OTHER
  s = call(s, mallory, "addMember", OTHER, mc(mallory));
  assert.throws(() => call(s, { ...mallory, blind: b32() }, "postEnvelope", INBOX, b32()), /no Merkle path|not a/);
  // mallory cannot inject members into an inbox she does not own
  assert.throws(() => call(s, mallory, "addMember", INBOX, mc(mallory)), /not the inbox owner/);
});

test("revealAuthor: only the real author can publish their member commitment", () => {
  let s = world();
  const c = b32(), blind = b32();
  s = call(s, { ...alice, blind }, "postEnvelope", INBOX, c);
  assert.throws(() => call(s, { ...bob, blind }, "revealAuthor", c), /not the author/);
  assert.throws(() => call(s, { ...alice, blind: b32() }, "revealAuthor", c), /not the author/);
  s = call(s, { ...alice, blind }, "revealAuthor", c);
  assert.equal(hex(L(s).revealedAuthors.lookup(c)), hex(mc(alice)));
  assert.throws(() => call(s, { ...alice, blind }, "revealAuthor", c), /already revealed/);
});

test("removeMember revokes posting, including with a stale cached path", () => {
  let s = world();
  const stale = L(s).members.findPathForLeaf(P.memberLeaf(INBOX, mc(alice)));
  s = call(s, owner, "removeMember", INBOX, mc(alice));
  assert.equal(L(s).inboxes.lookup(INBOX).members, 1n);
  assert.throws(() => call(s, { ...alice, blind: b32() }, "postEnvelope", INBOX, b32()), /no Merkle path|not a live member/);
  assert.throws(() => call(s, { ...alice, blind: b32(), path: stale }, "postEnvelope", INBOX, b32()), /not a live member/);
  // bob (still a member) re-derives his path against the new root and posts fine
  s = call(s, { ...bob, blind: b32() }, "postEnvelope", INBOX, b32());
  assert.equal(L(s).postCount, 1n);
});

test("closeInbox stops posting and adding", () => {
  let s = world();
  s = call(s, owner, "closeInbox", INBOX);
  assert.throws(() => call(s, { ...alice, blind: b32() }, "postEnvelope", INBOX, b32()), /closed/);
  assert.throws(() => call(s, owner, "addMember", INBOX, mc(mallory)), /closed/);
});
