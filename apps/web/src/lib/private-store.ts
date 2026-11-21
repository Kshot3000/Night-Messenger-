// SPDX-License-Identifier: Apache-2.0
/** Pure state helpers for the private (E2EE) messenger. Storage lives in private-vault.ts. */
import type { PublicIdentity } from "@midnight-messenger/shared";
import type { RelayCursor } from "./relay-client";

export const DEFAULT_RELAY =
  process.env.NEXT_PUBLIC_NM_RELAY_URL || "http://localhost:8787";
/**
 * Legacy localStorage key from builds that persisted `?relay=` and the Settings
 * relay. It is no longer written; boot removes it so relay.json wins.
 */
export const RELAY_KEY = "nm_private_relay_v1";

export type ChatMessage = {
  id: string;
  dir: "in" | "out";
  body: string;
  at: string;
  commitment: string; // hex SHA-256 of the envelope (what postEnvelope puts on-chain)
  authorTag: string; // hex hiding tag (what postEnvelope stores)
  senderVerified: boolean; // sender's static key matched the contact's invite
  member: string; // hex sender member commitment
  blind: string; // hex; only inside your own encrypted history
  relaySeq?: number;
  chain?: ChainStatus;
};
export type ChainStatus = { posted: boolean; seq?: string; receipts?: string; acked?: boolean; proofMs?: number; error?: string };
/** `unverified`: a placeholder made from an incoming message before its invite was added. */
export type Contact = PublicIdentity & { addedAt: string; unverified?: boolean };
export type PrivateState = {
  v: 1;
  contacts: Contact[];
  threads: Record<string, ChatMessage[]>; // keyed by contact mailbox
  cursor: number; // legacy cursor, retained for reading existing browser state
  relayCursor?: RelayCursor;
};
export const emptyState = (): PrivateState => ({ v: 1, contacts: [], threads: {}, cursor: 0 });

/** Placeholder contacts come from messages that arrived before the sender's invite. */
export function isPlaceholderContact(c: Contact): boolean {
  return c.unverified === true || / \(not in contacts\)$/.test(c.name);
}

/**
 * Pure reducer helpers (tested in apps/web/tests/private-store.test.mjs).
 *
 * Contacts are keyed by mailbox. Adding a real invite for a mailbox that only
 * has a placeholder (a sender seen before their invite was pasted, common
 * right after restoring keys, when the relay replays the mailbox) upgrades the
 * placeholder in place and re-checks that thread's received messages against
 * the invite's member commitment. A placeholder never overwrites a contact.
 */
export function addContact(
  state: PrivateState,
  c: PublicIdentity,
  now = new Date().toISOString(),
  options: { unverified?: boolean } = {},
): PrivateState {
  const i = state.contacts.findIndex((x) => x.mailbox === c.mailbox);
  if (i < 0) {
    const added: Contact = { ...c, addedAt: now, ...(options.unverified ? { unverified: true } : {}) };
    return { ...state, contacts: [...state.contacts, added] };
  }
  const existing = state.contacts[i];
  if (options.unverified || !isPlaceholderContact(existing) || existing.encPublic !== c.encPublic) return state;
  const upgraded: Contact = { ...c, addedAt: existing.addedAt };
  const contacts = state.contacts.map((x, j) => (j === i ? upgraded : x));
  const list = state.threads[c.mailbox];
  const threads = list
    ? { ...state.threads, [c.mailbox]: list.map((m) => (m.dir === "in" ? { ...m, senderVerified: m.member === c.member } : m)) }
    : state.threads;
  return { ...state, contacts, threads };
}

/** What adding this invite would do, for the UI notice. */
export function contactAddOutcome(state: PrivateState, c: PublicIdentity): "added" | "upgraded" | "exists" {
  const existing = state.contacts.find((x) => x.mailbox === c.mailbox);
  if (!existing) return "added";
  return isPlaceholderContact(existing) && existing.encPublic === c.encPublic ? "upgraded" : "exists";
}
export function addMessage(state: PrivateState, mailbox: string, m: ChatMessage): PrivateState {
  const list = state.threads[mailbox] ?? [];
  if (list.some((x) => x.commitment === m.commitment || x.id === m.id)) return state;
  const next = [...list, m].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return { ...state, threads: { ...state.threads, [mailbox]: next } };
}
/**
 * The chain simulator receives the member secret (sk) in plain JSON, so it
 * must only ever run on this machine. "local" = localhost/127.0.0.1/[::1];
 * anything else is "warn" in development and "refuse" in production builds.
 */
export function chainUrlRisk(u: string, production: boolean): "local" | "warn" | "refuse" {
  let local = false;
  try {
    local = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(u).hostname);
  } catch {
    local = false;
  }
  return local ? "local" : production ? "refuse" : "warn";
}

export function isRelayUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  } catch {
    return false;
  }
}

/** Strip a trailing slash; reject anything `isRelayUrl` would refuse. */
export function parseRelayParam(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const u = raw.trim();
  if (!u || !isRelayUrl(u)) return null;
  return u.replace(/\/+$/, "") || null;
}

/** Localhost and Cloudflare quick-tunnel hosts change or are only useful on this machine. */
export function isTransientRelay(u: string): boolean {
  try {
    const { hostname, protocol } = new URL(u);
    if (protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(hostname)) return true;
    return hostname === "trycloudflare.com" || hostname.endsWith(".trycloudflare.com");
  } catch {
    return true;
  }
}

/**
 * Pick the relay for this page load: a share-link `?relay=` (in memory only,
 * never saved), else the published relay.json, else the build default.
 */
export function resolveRelayUrl(options: { query?: string | null; published?: string | null; fallback: string }): string {
  return parseRelayParam(options.query) ?? parseRelayParam(options.published) ?? options.fallback;
}

/** Remove any relay override an older build saved, so relay.json wins. */
export function clearStoredRelayOverride(storage: Pick<Storage, "removeItem"> | null | undefined): void {
  try {
    storage?.removeItem(RELAY_KEY);
  } catch {
    /* storage may be unavailable (private mode); nothing to clear */
  }
}

export function updateMessage(state: PrivateState, mailbox: string, commitment: string, patch: Partial<ChatMessage>): PrivateState {
  const list = state.threads[mailbox];
  if (!list) return state;
  return { ...state, threads: { ...state.threads, [mailbox]: list.map((m) => (m.commitment === commitment ? { ...m, ...patch } : m)) } };
}
