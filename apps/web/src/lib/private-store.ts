// SPDX-License-Identifier: Apache-2.0
/** Pure state helpers for the private (E2EE) messenger. Storage lives in private-vault.ts. */
import type { PublicIdentity } from "@midnight-messenger/shared";

export const DEFAULT_RELAY =
  process.env.NEXT_PUBLIC_NM_RELAY_URL || "http://localhost:8787";
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
export type Contact = PublicIdentity & { addedAt: string };
export type PrivateState = {
  v: 1;
  contacts: Contact[];
  threads: Record<string, ChatMessage[]>; // keyed by contact mailbox
  cursor: number; // relay seq already fetched for our mailbox
};
export const emptyState = (): PrivateState => ({ v: 1, contacts: [], threads: {}, cursor: 0 });

/** Pure reducer helpers (tested in apps/web/tests/private-store.test.mjs). */
export function addContact(state: PrivateState, c: PublicIdentity, now = new Date().toISOString()): PrivateState {
  if (state.contacts.some((x) => x.mailbox === c.mailbox)) return state;
  return { ...state, contacts: [...state.contacts, { ...c, addedAt: now }] };
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

/** Prefer a share-link `?relay=`, then a durable user-saved URL, then published `relay.json`. */
export function resolveRelayUrl(options: {
  query?: string | null;
  stored?: string | null;
  published?: string | null;
  fallback: string;
}): string {
  const query = parseRelayParam(options.query);
  if (query) return query;
  const stored = parseRelayParam(options.stored);
  const published = parseRelayParam(options.published);
  if (stored && !isTransientRelay(stored)) return stored;
  if (published) return published;
  if (stored) return stored;
  return options.fallback;
}

export function updateMessage(state: PrivateState, mailbox: string, commitment: string, patch: Partial<ChatMessage>): PrivateState {
  const list = state.threads[mailbox];
  if (!list) return state;
  return { ...state, threads: { ...state.threads, [mailbox]: list.map((m) => (m.commitment === commitment ? { ...m, ...patch } : m)) } };
}
