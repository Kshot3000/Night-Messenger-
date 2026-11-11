// SPDX-License-Identifier: Apache-2.0
/**
 * At-rest protection for the private (E2EE) messenger, folded in from the
 * Nocturne preview: a random AES-256-GCM device key is generated in the
 * browser as a NON-EXTRACTABLE CryptoKey and kept in IndexedDB. The identity
 * (X25519 private key + Midnight member secret) and the message history are
 * sealed with it before they touch localStorage, so the raw private key is
 * never written anywhere in plaintext. The device key cannot be exported
 * (copied out) even by page script, though the open page can use it.
 * Passphrase backups (PBKDF2) live in packages/shared/src/e2ee.ts.
 */
import {
  exportIdentity,
  importIdentity,
  unwrapWithKey,
  wrapWithKey,
  type Identity,
  type WrappedBlob,
} from "@midnight-messenger/shared";
import { emptyState, type PrivateState } from "./private-store";

const DB = "night-messenger";
const STORE = "keys";
const DEVICE_KEY_ID = "device-key-v1";
export const IDENTITY_KEY = "nm_private_identity_v1";
export const STATE_KEY = "nm_private_state_v1";

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const r = run(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/** Get (or create) this browser's non-extractable device key. */
export async function deviceKey(): Promise<CryptoKey> {
  const db = await idb();
  const existing = await tx<CryptoKey | undefined>(db, "readonly", (s) => s.get(DEVICE_KEY_ID));
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await tx(db, "readwrite", (s) => s.put(key, DEVICE_KEY_ID));
  return key;
}

const te = new TextEncoder();
const td = new TextDecoder();

export async function saveIdentity(key: CryptoKey, id: Identity): Promise<void> {
  const blob = await wrapWithKey(key, te.encode(JSON.stringify(await exportIdentity(id))));
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(blob));
}
export async function loadIdentity(key: CryptoKey): Promise<Identity | null> {
  const raw = localStorage.getItem(IDENTITY_KEY);
  if (!raw) return null;
  const blob = JSON.parse(raw) as WrappedBlob;
  return importIdentity(JSON.parse(td.decode(await unwrapWithKey(key, blob))));
}
export async function saveState(key: CryptoKey, state: PrivateState): Promise<void> {
  const blob = await wrapWithKey(key, te.encode(JSON.stringify(state)), "night-messenger/v1/state");
  localStorage.setItem(STATE_KEY, JSON.stringify(blob));
}
export async function loadState(key: CryptoKey): Promise<PrivateState> {
  const raw = localStorage.getItem(STATE_KEY);
  if (!raw) return emptyState();
  const s = JSON.parse(td.decode(await unwrapWithKey(key, JSON.parse(raw), "night-messenger/v1/state")));
  if (!s || s.v !== 1 || !Array.isArray(s.contacts) || typeof s.threads !== "object") return emptyState();
  return s as PrivateState;
}
export function forgetEverything(): void {
  localStorage.removeItem(IDENTITY_KEY);
  localStorage.removeItem(STATE_KEY);
}

