// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { addContact, addMessage, emptyState, isRelayUrl } from "../src/lib/private-store.ts";

const contact = { v: 1, name: "Bob", encPublic: "x", member: "a".repeat(64), mailbox: "b".repeat(64) };
const msg = (o = {}) => ({ id: "1", dir: "in", body: "hi", at: "2026-11-10T00:00:00.000Z", commitment: "c".repeat(64), authorTag: "d".repeat(64), senderVerified: true, member: "a".repeat(64), blind: "e".repeat(64), ...o });

test("contacts are de-duplicated by mailbox", () => {
  let s = addContact(emptyState(), contact);
  s = addContact(s, { ...contact, name: "Bob again" });
  assert.equal(s.contacts.length, 1);
});

test("messages are de-duplicated by commitment and kept in time order", () => {
  let s = addMessage(emptyState(), contact.mailbox, msg());
  s = addMessage(s, contact.mailbox, msg({ id: "2" }));
  s = addMessage(s, contact.mailbox, msg({ id: "0", commitment: "f".repeat(64), at: "2026-11-09T00:00:00.000Z" }));
  assert.deepEqual(s.threads[contact.mailbox].map((m) => m.id), ["0", "1"]);
});

test("relay URLs must be https, or http on localhost only", () => {
  assert.ok(isRelayUrl("http://localhost:8787"));
  assert.ok(isRelayUrl("https://relay.example"));
  assert.equal(isRelayUrl("http://relay.example"), false);
  assert.equal(isRelayUrl("javascript:alert(1)"), false);
});
