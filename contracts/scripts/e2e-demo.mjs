#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * End-to-end Night Messenger demo, all local:
 *   real E2EE (packages/shared/src/e2ee.ts) -> real relay (apps/relay) ->
 *   night_messenger.compact running in the compact-runtime simulator.
 * No proof server, no wallet, no network beyond 127.0.0.1. Prints what each
 * party and the public can see. Run: pnpm demo:e2e (from the repo root).
 */
import * as RT from "@midnight-ntwrk/compact-runtime";
import { Contract, ledger } from "../src/managed/night_messenger/contract/index.js";
import * as E from "../../packages/shared/src/e2ee.ts";
import { createRelay } from "../../apps/relay/server.mjs";

const hex = (b) => Buffer.from(b).toString("hex");
const short = (b) => `${(typeof b === "string" ? b : hex(b)).slice(0, 12)}…`;
const say = (who, msg) => console.log(`${who.padEnd(8)} ${msg}`);

const relay = createRelay();
await new Promise((r) => relay.listen(0, "127.0.0.1", r));
const RELAY = `http://127.0.0.1:${relay.address().port}`;

const witnesses = {
  localSecretKey: ({ privateState }) => [privateState, privateState.sk],
  memberPath: ({ privateState, ledger: l }, leaf) => [privateState, l.members.findPathForLeaf(leaf)],
  authorBlind: ({ privateState }) => [privateState, privateState.blind ?? new Uint8Array(32)],
};
const contract = new Contract(witnesses);
const ADDR = RT.sampleContractAddress();
const COIN = "0".repeat(64);
const call = (state, ps, name, ...args) =>
  contract.impureCircuits[name](RT.createCircuitContext(ADDR, COIN, state, ps), ...args).context.currentQueryContext.state;

try {
  // 1. Identities are made on each device; only invites are exchanged.
  const alice = await E.createIdentity("Alice");
  const bob = await E.createIdentity("Bob");
  const bobInvite = await E.parseInvite(await E.inviteCode(bob));
  const aliceInvite = await E.parseInvite(await E.inviteCode(alice));
  say("alice", `identity ready, member ${short(alice.member)}, mailbox ${short(aliceInvite.mailbox)}`);
  say("bob", `identity ready, member ${short(bob.member)}, mailbox ${short(bobInvite.mailbox)}`);

  // 2. Alice opens a DM inbox on the (simulated) contract and adds both members.
  const inbox = await E.dmInboxId(alice.member, E.fromHex(bobInvite.member));
  let state = contract.initialState(RT.createConstructorContext({ sk: alice.chainSecret }, COIN)).currentContractState.data;
  state = call(state, { sk: alice.chainSecret }, "createInbox", inbox);
  state = call(state, { sk: alice.chainSecret }, "addMember", inbox, alice.member);
  state = call(state, { sk: alice.chainSecret }, "addMember", inbox, E.fromHex(bobInvite.member));
  say("chain", `inbox ${short(inbox)} created with ${ledger(state).inboxes.lookup(inbox).members} private member leaves`);

  // 3. Alice seals, uploads ciphertext to Bob's mailbox, posts the commitment on-chain.
  const sealed = await E.seal(alice, bobInvite, "Verified but anonymous: this tip is from inside the team.", { inbox });
  const up = await fetch(`${RELAY}/v1/mailboxes/${bobInvite.mailbox}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ envelope: E.toB64u(sealed.envelope) }),
  }).then((r) => r.json());
  say("relay", `stored ${sealed.envelope.length} B of ciphertext, commitment ${short(up.commitment)} (cannot read it, cannot see the sender)`);
  state = call(state, { sk: alice.chainSecret, blind: E.fromHex(sealed.payload.blind) }, "postEnvelope", inbox, sealed.commitment);
  const post = ledger(state).posts.lookup(sealed.commitment);
  say("chain", `post #${post.seq}: commitment ${short(sealed.commitment)}, authorTag ${short(post.authorTag)}; membership proven, sender hidden`);

  // 4. Bob polls his mailbox, decrypts, and checks the ledger.
  const inboxMsgs = await fetch(`${RELAY}/v1/mailboxes/${bobInvite.mailbox}/messages?after=0`).then((r) => r.json());
  const env = E.fromB64u(inboxMsgs.messages[0].envelope);
  const opened = await E.open(bob, env);
  if (opened.senderKey !== aliceInvite.encPublic) throw new Error("sender key does not match Alice's invite");
  say("bob", `decrypted "${opened.payload.body}" from ${opened.payload.from} (sender key matches Alice's invite)`);
  const onChain = ledger(state).posts.lookup(opened.commitment);
  const ok = await E.verifyAuthorTag(opened, onChain.authorTag);
  say("bob", `on-chain author tag ${ok ? "MATCHES" : "DOES NOT MATCH"}: the anonymous post was made by Alice's member key`);
  if (!ok) throw new Error("author tag mismatch");

  // 5. Bob acknowledges delivery anonymously; anyone can count receipts.
  state = call(state, { sk: bob.chainSecret }, "ackDelivery", opened.commitment);
  say("chain", `delivery receipts for ${short(opened.commitment)}: ${ledger(state).ackCount.lookup(opened.commitment)}`);

  // 6. Selective disclosure: Bob hands a reviewer {commitment, member, blind} for this one message.
  const d = E.authorDisclosure(opened);
  say("auditor", `checks Bob's disclosure bundle against the ledger: ${(await E.checkAuthorDisclosure(d, onChain.authorTag)) ? "authorship proven" : "rejected"}`);
  console.log("\nPublic ledger holds: inbox id, member leaves, commitment, author tag, ack nullifier. No bodies, keys or names.");
} finally {
  relay.close();
}
