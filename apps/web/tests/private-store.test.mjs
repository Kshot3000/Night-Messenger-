// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { RELAY_KEY, addContact, addMessage, chainUrlRisk, clearStoredRelayOverride, contactAddOutcome, emptyState, isPlaceholderContact, isRelayUrl, isTransientRelay, parseRelayParam, resolveRelayUrl } from "../src/lib/private-store.ts";

test("chain simulator URL: localhost only; warn in dev, refuse in production", () => {
  for (const u of ["http://localhost:8788", "http://127.0.0.1:8788", "http://[::1]:8788"]) {
    assert.equal(chainUrlRisk(u, true), "local");
    assert.equal(chainUrlRisk(u, false), "local");
  }
  for (const u of ["https://sim.example.com", "http://192.168.1.5:8788", "not a url"]) {
    assert.equal(chainUrlRisk(u, false), "warn");
    assert.equal(chainUrlRisk(u, true), "refuse");
  }
});

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

test("parseRelayParam accepts https and localhost http only", () => {
  assert.equal(parseRelayParam("https://abc.trycloudflare.com/"), "https://abc.trycloudflare.com");
  assert.equal(parseRelayParam("http://localhost:8787"), "http://localhost:8787");
  assert.equal(parseRelayParam("http://evil.example"), null);
  assert.equal(parseRelayParam("javascript:alert(1)"), null);
  assert.ok(isTransientRelay("https://abc.trycloudflare.com"));
  assert.ok(isTransientRelay("http://127.0.0.1:8787"));
  assert.equal(isTransientRelay("https://relay.example"), false);
});

test("resolveRelayUrl: ?relay= for this load, else relay.json, else the fallback", () => {
  const fallback = "http://localhost:8787";
  assert.equal(resolveRelayUrl({ query: "https://a.trycloudflare.com/", published: "https://b.trycloudflare.com", fallback }), "https://a.trycloudflare.com");
  assert.equal(resolveRelayUrl({ query: null, published: "https://b.trycloudflare.com", fallback }), "https://b.trycloudflare.com");
  // invalid share links are ignored, not trusted
  assert.equal(resolveRelayUrl({ query: "http://evil.example", published: "https://b.trycloudflare.com", fallback }), "https://b.trycloudflare.com");
  assert.equal(resolveRelayUrl({ query: "javascript:alert(1)", published: null, fallback }), fallback);
  assert.equal(resolveRelayUrl({ query: null, published: null, fallback }), fallback);
  // a previously saved override is no longer an input at all
  assert.equal(resolveRelayUrl({ query: null, stored: "https://saved.example", published: "https://b.trycloudflare.com", fallback }), "https://b.trycloudflare.com");
});

test("clearStoredRelayOverride removes the legacy key and tolerates missing storage", () => {
  const store = new Map([[RELAY_KEY, "https://old.trycloudflare.com"], ["other", "keep"]]);
  const storage = { removeItem: (k) => store.delete(k) };
  clearStoredRelayOverride(storage);
  assert.equal(store.has(RELAY_KEY), false);
  assert.equal(store.get("other"), "keep");
  clearStoredRelayOverride(null);
  clearStoredRelayOverride({ removeItem: () => { throw new Error("SecurityError"); } });
});

test("pasting an invite upgrades a placeholder made from an earlier message (restore-from-backup case)", () => {
  const stranger = { ...contact, name: "Bob (not in contacts)", member: "9".repeat(64) };
  let s = addContact(emptyState(), stranger, "2026-11-01T00:00:00.000Z", { unverified: true });
  s = addMessage(s, contact.mailbox, msg({ senderVerified: false, member: contact.member }));
  s = addMessage(s, contact.mailbox, msg({ id: "x", commitment: "1".repeat(64), senderVerified: false, member: "2".repeat(64) }));
  s = addMessage(s, contact.mailbox, msg({ id: "o", dir: "out", commitment: "3".repeat(64), senderVerified: true }));
  assert.equal(contactAddOutcome(s, contact), "upgraded");
  s = addContact(s, contact);
  assert.equal(s.contacts.length, 1);
  assert.equal(s.contacts[0].name, "Bob");
  assert.equal(s.contacts[0].member, contact.member);
  assert.equal(s.contacts[0].unverified, undefined);
  assert.equal(s.contacts[0].addedAt, "2026-11-01T00:00:00.000Z");
  assert.ok(!isPlaceholderContact(s.contacts[0]));
  const byId = Object.fromEntries(s.threads[contact.mailbox].map((m) => [m.id, m.senderVerified]));
  assert.deepEqual(byId, { 1: true, x: false, o: true }); // only messages from the invite's member verify
  assert.equal(contactAddOutcome(s, contact), "exists");
});

test("legacy placeholders (name suffix only) are upgraded too; placeholders never overwrite real contacts", () => {
  let s = addContact(emptyState(), { ...contact, name: "Bob (not in contacts)" });
  s = addContact(s, contact);
  assert.equal(s.contacts[0].name, "Bob");
  const before = s;
  s = addContact(s, { ...contact, name: "Mallory (not in contacts)", member: "9".repeat(64) }, undefined, { unverified: true });
  assert.equal(s, before);
  // a different key claiming the same mailbox cannot replace a placeholder
  let t = addContact(emptyState(), { ...contact, name: "Bob (not in contacts)" }, undefined, { unverified: true });
  t = addContact(t, { ...contact, encPublic: "y" });
  assert.equal(t.contacts[0].encPublic, "x");
});

