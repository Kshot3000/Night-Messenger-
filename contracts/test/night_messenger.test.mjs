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
    const inbox = privateState.inbox ?? INBOX;
    const p = privateState.path ?? (l.members.member(inbox) ? l.members.lookup(inbox).findPathForLeaf(leaf) : undefined);
    if (!p) throw new Error("not a member (no Merkle path)");
    return [privateState, p];
  },
  authorBlind: ({ privateState }, _c) => [privateState, privateState.blind ?? new Uint8Array(32)],
};
const contract = new Contract(witnesses);
const deploy = (ps) => contract.initialState(RT.createConstructorContext(ps, COIN)).currentContractState;
const run = (state, ps, name, ...args) => contract.impureCircuits[name](RT.createCircuitContext(ADDR, COIN, state, ps), ...args);
const call = (state, ps, name, ...args) => run(state, ps, name, ...args).context.currentQueryContext.state;
const L = (s) => ledger(s);

const owner = { sk: b32() };
const alice = { sk: b32() };
const bob = { sk: b32() };
const mallory = { sk: b32() };
const mc = (p) => P.memberCommitment(p.sk);
const SEED = b32();
const INBOX = P.inboxIdFor(mc(owner), SEED);
const EPOCH0 = new Uint8Array(32);
const leafOf = (s, inbox, m) => P.memberLeaf(inbox, L(s).inboxes.lookup(inbox).epoch, m);

function world() {
  let s = deploy(owner).data;
  const r = run(s, owner, "createInbox", SEED);
  assert.equal(hex(r.result), hex(INBOX), "createInbox returns the creator-bound id");
  s = r.context.currentQueryContext.state;
  s = call(s, owner, "addMember", INBOX, mc(alice));
  s = call(s, owner, "addMember", INBOX, mc(bob));
  return s;
}

test("pure helpers match the browser SDK (SHA-256 over Compact encodings)", async () => {
  const sk = b32(), c = b32(), bl = b32();
  assert.equal(hex(P.memberCommitment(sk)), hex(await E.memberCommitment(sk)));
  assert.equal(hex(P.ownerCommitment(sk)), hex(await E.ownerCommitment(sk)));
  assert.equal(hex(P.memberLeaf(INBOX, c, sk)), hex(await E.memberLeaf(INBOX, c, sk)));
  assert.equal(hex(P.inboxIdFor(sk, c)), hex(await E.inboxIdFor(sk, c)));
  assert.equal(hex(P.nextEpoch(c)), hex(await E.nextEpoch(c)));
  assert.equal(hex(EPOCH0), hex(E.INITIAL_EPOCH));
  assert.equal(hex(P.authorTag(c, sk, bl)), hex(await E.authorTag(c, sk, bl)));
  assert.equal(hex(P.ackNullifier(c, sk)), hex(await E.ackNullifier(c, sk)));
});

test("inbox: owner adds members; only leaves are public; non-owners cannot add", () => {
  const s = world();
  const l = L(s);
  const box = l.inboxes.lookup(INBOX);
  assert.equal(box.members, 2n);
  assert.equal(hex(box.owner), hex(P.ownerCommitment(owner.sk)));
  assert.ok(l.leaves.member(P.memberLeaf(INBOX, EPOCH0, mc(alice))));
  assert.equal(l.leaves.member(mc(alice)), false, "member commitment itself is never stored");
  assert.throws(() => call(s, mallory, "addMember", INBOX, mc(mallory)), /not the inbox owner/);
  assert.throws(() => call(s, owner, "addMember", INBOX, mc(alice)), /already a member/);
  assert.throws(() => call(s, owner, "createInbox", SEED), /already exists/);
});

test("end to end: alice seals for bob, posts the commitment anonymously, bob verifies the author tag", async () => {
  let s = world();
  const A = await E.createIdentity("Alice");
  const B = await E.createIdentity("Bob");
  // Use the E2EE identities' chain secrets as the Midnight member secrets.
  const aPs = { sk: A.chainSecret };
  const bPs = { sk: B.chainSecret };
  // Alice opens the DM inbox from the seed only she and Bob can derive.
  const dm = await E.dmInboxes(A, await E.publicIdentity(B));
  const DM = dm.mine;
  const r = run(s, aPs, "createInbox", dm.seed);
  assert.equal(hex(r.result), hex(DM));
  s = r.context.currentQueryContext.state;
  s = call(s, aPs, "addMember", DM, A.member);
  s = call(s, aPs, "addMember", DM, B.member);
  aPs.inbox = bPs.inbox = DM;

  const sealed = await E.seal(A, await E.publicIdentity(B), "verified staff here: the report is real", { inbox: DM });
  s = call(s, { ...aPs, blind: E.fromHex(sealed.payload.blind) }, "postEnvelope", DM, sealed.commitment);

  const post = L(s).posts.lookup(sealed.commitment);
  assert.equal(hex(post.inboxId), hex(DM));
  assert.equal(L(s).postCount, 1n);
  // Public record reveals neither the member commitment nor the body.
  assert.notEqual(hex(post.authorTag), hex(A.member));

  const bDm = await E.dmInboxes(B, await E.publicIdentity(A));
  const opened = await E.open(B, sealed.envelope, { expectedInboxes: [bDm.mine, bDm.theirs] });
  assert.equal(opened.payload.inbox, hex(post.inboxId), "payload inbox matches the on-chain post");
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

test("no self-receipts: the author cannot ackDelivery their own message (Joe #1)", () => {
  let s = world();
  const c = b32();
  s = call(s, { ...alice, blind: b32() }, "postEnvelope", INBOX, c);
  // the sender's nullifier is burned at post time, but not counted as a delivery
  assert.ok(L(s).acks.member(P.ackNullifier(c, alice.sk)));
  assert.equal(L(s).ackCount.member(c), false);
  assert.equal(L(s).deliveryCount, 0n);
  assert.throws(() => call(s, alice, "ackDelivery", c), /already acknowledged/);
  // a different member still can, exactly once
  s = call(s, bob, "ackDelivery", c);
  assert.equal(L(s).ackCount.lookup(c), 1n);
  assert.equal(L(s).deliveryCount, 1n);
  assert.throws(() => call(s, bob, "ackDelivery", c), /already acknowledged/);
});

test("membership is bound to the inbox: a member of inbox A cannot post into inbox B", () => {
  let s = world();
  const OSEED = b32();
  const OTHER = P.inboxIdFor(mc(mallory), OSEED);
  s = call(s, mallory, "createInbox", OSEED); // mallory owns OTHER
  s = call(s, { ...mallory, inbox: OTHER }, "addMember", OTHER, mc(mallory));
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

test("DM inbox front-running fails: a third party cannot claim either DM inbox id (Joe #2)", async () => {
  let s = deploy(owner).data;
  const A = await E.createIdentity("Alice"), B = await E.createIdentity("Bob"), M = await E.createIdentity("Mallory");
  const [pA, pB] = [await E.publicIdentity(A), await E.publicIdentity(B)];
  const dm = await E.dmInboxes(A, pB);
  // Mallory knows both invites (member commitments are public) and even copies the seed
  // out of Alice's pending createInbox: the id is bound to the caller's own commitment.
  const stolen = run(s, { sk: M.chainSecret }, "createInbox", dm.seed);
  assert.notEqual(hex(stolen.result), hex(dm.mine));
  assert.notEqual(hex(stolen.result), hex(dm.theirs));
  s = stolen.context.currentQueryContext.state;
  // her own guesses from public data don't land on the DM ids either
  const guess = await E.dmInboxes(M, pA);
  for (const g of [guess.mine, guess.theirs]) for (const d of [dm.mine, dm.theirs]) assert.notEqual(hex(g), hex(d));
  // Alice still creates the real one, and owns it
  s = call(s, { sk: A.chainSecret }, "createInbox", dm.seed);
  assert.equal(hex(L(s).inboxes.lookup(dm.mine).owner), hex(P.ownerCommitment(A.chainSecret)));
  assert.throws(() => call(s, { sk: M.chainSecret }, "addMember", dm.mine, M.member), /not the inbox owner/);
  // Bob can create the other valid id for the same pair (both are accepted by open())
  s = call(s, { sk: B.chainSecret }, "createInbox", (await E.dmInboxes(B, pA)).seed);
  assert.ok(L(s).inboxes.member(dm.theirs));
});

test("removeMember rotates the epoch: no history reset, stale paths fail, other inboxes untouched (Joe #3)", () => {
  let s = world();
  // a second inbox with an in-flight path that must survive removals elsewhere
  const OSEED = b32(), OTHER = P.inboxIdFor(mc(bob), OSEED);
  s = call(s, bob, "createInbox", OSEED);
  s = call(s, bob, "addMember", OTHER, mc(bob));
  const otherPath = L(s).members.lookup(OTHER).findPathForLeaf(leafOf(s, OTHER, mc(bob)));
  const stale = L(s).members.lookup(INBOX).findPathForLeaf(leafOf(s, INBOX, mc(alice)));

  s = call(s, owner, "removeMember", INBOX, mc(alice));
  const box = L(s).inboxes.lookup(INBOX);
  assert.equal(hex(box.epoch), hex(P.nextEpoch(EPOCH0)));
  assert.equal(box.members, 0n);
  assert.throws(() => call(s, { ...alice, blind: b32() }, "postEnvelope", INBOX, b32()), /no Merkle path|not a live member|does not lead/);
  assert.throws(() => call(s, { ...alice, blind: b32(), path: stale }, "postEnvelope", INBOX, b32()), /does not lead|not a live member/);
  assert.throws(() => call(s, owner, "removeMember", INBOX, mc(alice)), /not a member/);
  // the other inbox's cached path still verifies: root history was not reset
  s = call(s, { ...bob, blind: b32(), inbox: OTHER, path: otherPath }, "postEnvelope", OTHER, b32());
  // owner re-adds bob under the new epoch; bob posts, alice still cannot
  s = call(s, owner, "addMember", INBOX, mc(bob));
  s = call(s, { ...bob, blind: b32() }, "postEnvelope", INBOX, b32());
  assert.throws(() => call(s, { ...alice, blind: b32() }, "postEnvelope", INBOX, b32()), /no Merkle path|not a live member|does not lead/);
  assert.equal(L(s).postCount, 2n);
});

test("membership trees are per inbox: the 32,768-leaf cap is per inbox, not global", () => {
  let s = world();
  const OSEED = b32(), OTHER = P.inboxIdFor(mc(mallory), OSEED);
  s = call(s, mallory, "createInbox", OSEED);
  s = call(s, mallory, "addMember", OTHER, mc(mallory));
  assert.equal(L(s).members.lookup(INBOX).firstFree(), 2n);
  assert.equal(L(s).members.lookup(OTHER).firstFree(), 1n);
});

test("closeInbox stops posting and adding", () => {
  let s = world();
  s = call(s, owner, "closeInbox", INBOX);
  assert.throws(() => call(s, { ...alice, blind: b32() }, "postEnvelope", INBOX, b32()), /closed/);
  assert.throws(() => call(s, owner, "addMember", INBOX, mc(mallory)), /closed/);
});
