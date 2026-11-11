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
export function isRelayUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  } catch {
    return false;
  }
}

export function updateMessage(state: PrivateState, mailbox: string, commitment: string, patch: Partial<ChatMessage>): PrivateState {
  const list = state.threads[mailbox];
  if (!list) return state;
  return { ...state, threads: { ...state.threads, [mailbox]: list.map((m) => (m.commitment === commitment ? { ...m, ...patch } : m)) } };
}
