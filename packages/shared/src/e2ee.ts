// SPDX-License-Identifier: Apache-2.0
/**
 * Night Messenger end-to-end encryption (WebCrypto only, no dependencies).
 *
 * Primitives: X25519 (ECDH), HKDF-SHA-256, AES-256-GCM, SHA-256, PBKDF2.
 * Works in current browsers (Chrome/Edge 133+, Firefox 130+, Safari 17+) and
 * Node 22.18+.
 *
 * Sealing follows the Noise "X" one-way pattern (e, es, s, ss):
 *   1. The sender makes a fresh ephemeral key e.
 *   2. k1 = HKDF(ECDH(e, R))           encrypts the sender's static key S.
 *   3. k2 = HKDF(ECDH(e, R) || ECDH(S, R)) encrypts the payload.
 * Only the recipient can open it; a relay sees neither the sender nor the body;
 * the recipient learns the sender's static key and knows the sender held its
 * private half (ss). Each message uses a fresh e, so keys are never reused.
 * Not provided (documented): forward secrecy against a later leak of R's
 * static key, and deniability guarantees beyond those of Noise X.
 *
 * Midnight link: every identity also holds a 32-byte chain secret `sk`. Its
 * memberCommitment, the message commitment and the author tag are computed
 * exactly as night_messenger.compact computes them (persistentHash over
 * Vector<n, Bytes<32>> is SHA-256 of the concatenation), so the browser can
 * check a post against the ledger without the compact runtime.
 */

const te = new TextEncoder();
const td = new TextDecoder();
const subtle = () => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error("WebCrypto is unavailable (use https or localhost)");
  return s;
};
const rand = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));
const buf = (u: Uint8Array): ArrayBuffer => u.slice().buffer as ArrayBuffer;

export const ENVELOPE_VERSION = 1;
export const MAX_PLAINTEXT_BYTES = 16 * 1024;
const PBKDF2_ITERATIONS = 600_000;

// ------------------------------------------------------------------ encoding

export function toHex(u: Uint8Array): string {
  return Array.from(u, (b) => b.toString(16).padStart(2, "0")).join("");
}
export function fromHex(h: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})*$/i.test(h)) throw new Error("invalid hex");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}
export function toB64u(u: Uint8Array): string {
  let s = "";
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function fromB64u(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error("invalid base64url");
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
/** Compact's pad(32, s): UTF-8 bytes, right-padded with zeros. */
export function pad32(s: string): Uint8Array {
  const b = te.encode(s);
  if (b.length > 32) throw new Error("tag too long");
  const out = new Uint8Array(32);
  out.set(b);
  return out;
}
export async function sha256(...parts: Uint8Array[]): Promise<Uint8Array> {
  return new Uint8Array(await subtle().digest("SHA-256", buf(concat(...parts))));
}

// --------------------------------------------- Midnight contract mirrors

/** = night_messenger.compact memberCommitment(sk) */
export const memberCommitment = (sk: Uint8Array) => sha256(pad32("nm:member:v1"), sk);
/** = ownerCommitment(sk) */
export const ownerCommitment = (sk: Uint8Array) => sha256(pad32("nm:owner:v1"), sk);
/** = memberLeaf(inboxId, member) */
export const memberLeaf = (inboxId: Uint8Array, member: Uint8Array) =>
  sha256(pad32("nm:leaf:v1"), inboxId, member);
/** = authorTag(commitment, member, blind) */
export const authorTag = (commitment: Uint8Array, member: Uint8Array, blind: Uint8Array) =>
  sha256(pad32("nm:author:v1"), commitment, member, blind);
/** = ackNullifier(commitment, sk) */
export const ackNullifier = (commitment: Uint8Array, sk: Uint8Array) =>
  sha256(pad32("nm:ack:v1"), commitment, sk);
/** The on-chain message commitment: SHA-256 over the exact envelope bytes. */
export const envelopeCommitment = (envelope: Uint8Array) => sha256(envelope);

/** A 1:1 DM inbox id both sides derive the same way (order-independent). */
export async function dmInboxId(memberA: Uint8Array, memberB: Uint8Array): Promise<Uint8Array> {
  const [x, y] = toHex(memberA) < toHex(memberB) ? [memberA, memberB] : [memberB, memberA];
  return sha256(pad32("nm:dm-inbox:v1"), x, y);
}

// ------------------------------------------------------------------ keys

export type Identity = {
  name: string;
  encPrivate: CryptoKey; // X25519, deriveBits
  encPublic: Uint8Array; // 32 bytes raw
  chainSecret: Uint8Array; // 32 bytes, Midnight member secret (never sent anywhere)
  member: Uint8Array; // memberCommitment(chainSecret)
  createdAt: string;
};

/** What you share with a contact (an invite). Contains no secret. */
export type PublicIdentity = {
  v: 1;
  name: string;
  encPublic: string; // b64url
  member: string; // hex
  mailbox: string; // hex
};

export async function mailboxFor(encPublic: Uint8Array): Promise<string> {
  return toHex(await sha256(pad32("nm:mailbox:v1"), encPublic));
}

export async function createIdentity(name: string): Promise<Identity> {
  const kp = (await subtle().generateKey({ name: "X25519" }, true, ["deriveBits"])) as CryptoKeyPair;
  const encPublic = new Uint8Array(await subtle().exportKey("raw", kp.publicKey));
  const chainSecret = rand(32);
  return {
    name: cleanName(name),
    encPrivate: kp.privateKey,
    encPublic,
    chainSecret,
    member: await memberCommitment(chainSecret),
    createdAt: new Date().toISOString(),
  };
}

function cleanName(name: string): string {
  const n = String(name ?? "").trim().slice(0, 40);
  if (!n) throw new Error("name is required");
  return n;
}

export async function publicIdentity(id: Identity): Promise<PublicIdentity> {
  return { v: 1, name: id.name, encPublic: toB64u(id.encPublic), member: toHex(id.member), mailbox: await mailboxFor(id.encPublic) };
}

const INVITE_PREFIX = "nm1:";
export async function inviteCode(id: Identity): Promise<string> {
  return INVITE_PREFIX + toB64u(te.encode(JSON.stringify(await publicIdentity(id))));
}
export async function parseInvite(code: string): Promise<PublicIdentity> {
  const c = String(code ?? "").trim();
  if (!c.startsWith(INVITE_PREFIX) || c.length > 2048) throw new Error("not a Night Messenger invite");
  let v: PublicIdentity;
  try {
    v = JSON.parse(td.decode(fromB64u(c.slice(INVITE_PREFIX.length))));
  } catch {
    throw new Error("invite is malformed");
  }
  if (!v || v.v !== 1 || typeof v.name !== "string" || typeof v.encPublic !== "string" || typeof v.member !== "string" || typeof v.mailbox !== "string")
    throw new Error("invite is malformed");
  const pub = fromB64u(v.encPublic);
  if (pub.length !== 32 || !/^[0-9a-f]{64}$/.test(v.member)) throw new Error("invite is malformed");
  if ((await mailboxFor(pub)) !== v.mailbox) throw new Error("invite mailbox does not match its key");
  return { v: 1, name: cleanName(v.name), encPublic: v.encPublic, member: v.member, mailbox: v.mailbox };
}

// ------------------------------------------------------------------ sealing

async function x25519(priv: CryptoKey, pubRaw: Uint8Array): Promise<Uint8Array> {
  const pub = await subtle().importKey("raw", buf(pubRaw), { name: "X25519" }, false, []);
  const bits = new Uint8Array(await subtle().deriveBits({ name: "X25519", public: pub }, priv, 256));
  if (bits.every((b) => b === 0)) throw new Error("invalid public key");
  return bits;
}
async function hkdfKey(ikm: Uint8Array, salt: Uint8Array, info: string): Promise<CryptoKey> {
  const base = await subtle().importKey("raw", buf(ikm), "HKDF", false, ["deriveKey"]);
  return subtle().deriveKey({ name: "HKDF", hash: "SHA-256", salt: buf(salt), info: buf(te.encode(info)) }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
const gcm = async (mode: "encrypt" | "decrypt", key: CryptoKey, iv: Uint8Array, data: Uint8Array, aad: Uint8Array) =>
  new Uint8Array(await subtle()[mode]({ name: "AES-GCM", iv: buf(iv), additionalData: buf(aad) }, key, buf(data)));

/** Decrypted message content. `blind` + `member` let the recipient check the on-chain author tag. */
export type Payload = {
  t: "msg";
  id: string;
  body: string;
  sentAt: string;
  from: string; // sender display name (self-asserted; trust the contact record)
  member: string; // hex sender memberCommitment
  blind: string; // hex 32 bytes, author-tag blinding factor
  inbox: string; // hex inbox id
};

// Layout: v(1) | e(32) | iv1(12) | encS(32+16) | iv2(12) | ct
const HDR = 1 + 32;
const ENC_S = 32 + 16;

export type Sealed = {
  envelope: Uint8Array;
  commitment: Uint8Array;
  authorTag: Uint8Array;
  payload: Payload;
};

export async function seal(
  sender: Identity,
  recipient: PublicIdentity,
  body: string,
  opts: { inbox?: Uint8Array; id?: string; sentAt?: string } = {},
): Promise<Sealed> {
  const text = String(body ?? "");
  if (!text.trim()) throw new Error("message is empty");
  const R = fromB64u(recipient.encPublic);
  const inbox = opts.inbox ?? (await dmInboxId(sender.member, fromHex(recipient.member)));
  const blind = rand(32);
  const payload: Payload = {
    t: "msg",
    id: opts.id ?? globalThis.crypto.randomUUID(),
    body: text,
    sentAt: opts.sentAt ?? new Date().toISOString(),
    from: sender.name,
    member: toHex(sender.member),
    blind: toHex(blind),
    inbox: toHex(inbox),
  };
  const plain = te.encode(JSON.stringify(payload));
  if (plain.length > MAX_PLAINTEXT_BYTES) throw new Error("message is too long");

  const e = (await subtle().generateKey({ name: "X25519" }, true, ["deriveBits"])) as CryptoKeyPair;
  const ePub = new Uint8Array(await subtle().exportKey("raw", e.publicKey));
  const header = concat(Uint8Array.of(ENVELOPE_VERSION), ePub);
  const es = await x25519(e.privateKey, R);
  const k1 = await hkdfKey(es, concat(ePub, R), "night-messenger/v1/sender");
  const iv1 = rand(12);
  const encS = await gcm("encrypt", k1, iv1, sender.encPublic, concat(header, R));
  const ss = await x25519(sender.encPrivate, R);
  const k2 = await hkdfKey(concat(es, ss), concat(ePub, R, sender.encPublic), "night-messenger/v1/payload");
  const iv2 = rand(12);
  const ct = await gcm("encrypt", k2, iv2, plain, concat(header, R, iv1, encS));
  const envelope = concat(header, iv1, encS, iv2, ct);
  const commitment = await envelopeCommitment(envelope);
  return { envelope, commitment, authorTag: await authorTag(commitment, sender.member, blind), payload };
}

export type Opened = {
  payload: Payload;
  senderKey: string; // b64url static X25519 key the sender proved
  commitment: Uint8Array;
  authorTag: Uint8Array; // recomputed; compare with the ledger's posts[commitment].authorTag
};

export async function open(recipient: Identity, envelope: Uint8Array): Promise<Opened> {
  if (envelope.length < HDR + 12 + ENC_S + 12 + 16 + 2 || envelope[0] !== ENVELOPE_VERSION) throw new Error("not a Night Messenger envelope");
  const header = envelope.subarray(0, HDR);
  const ePub = envelope.subarray(1, HDR);
  let o = HDR;
  const iv1 = envelope.subarray(o, (o += 12));
  const encS = envelope.subarray(o, (o += ENC_S));
  const iv2 = envelope.subarray(o, (o += 12));
  const ct = envelope.subarray(o);
  const R = recipient.encPublic;
  let plain: Uint8Array;
  let S: Uint8Array;
  try {
    const es = await x25519(recipient.encPrivate, ePub);
    const k1 = await hkdfKey(es, concat(ePub, R), "night-messenger/v1/sender");
    S = await gcm("decrypt", k1, iv1, encS, concat(header, R));
    const ss = await x25519(recipient.encPrivate, S);
    const k2 = await hkdfKey(concat(es, ss), concat(ePub, R, S), "night-messenger/v1/payload");
    plain = await gcm("decrypt", k2, iv2, ct, concat(header, R, iv1, encS));
  } catch {
    throw new Error("cannot decrypt: not for this identity or tampered");
  }
  const payload = parsePayload(td.decode(plain));
  const commitment = await envelopeCommitment(envelope);
  return { payload, senderKey: toB64u(S), commitment, authorTag: await authorTag(commitment, fromHex(payload.member), fromHex(payload.blind)) };
}

function parsePayload(text: string): Payload {
  const p = JSON.parse(text);
  const hex32 = (x: unknown) => typeof x === "string" && /^[0-9a-f]{64}$/.test(x);
  if (!p || p.t !== "msg" || typeof p.id !== "string" || p.id.length > 128 || typeof p.body !== "string" || typeof p.from !== "string" || !Number.isFinite(Date.parse(p.sentAt)) || !hex32(p.member) || !hex32(p.blind) || !hex32(p.inbox))
    throw new Error("malformed payload");
  return p as Payload;
}

/**
 * Verified-but-anonymous check: the decrypted message names member m and
 * blind b; the ledger stores a hiding tag for the commitment. Equal tags mean
 * the on-chain post (whose membership proof hid the sender) was made by m.
 */
export async function verifyAuthorTag(opened: Opened, onChainTag: Uint8Array): Promise<boolean> {
  return equal(opened.authorTag, onChainTag);
}

/** Disclosure bundle the recipient (or sender) can hand a third party to prove who wrote one message. */
export type AuthorDisclosure = { commitment: string; member: string; blind: string };
export function authorDisclosure(o: Opened): AuthorDisclosure {
  return { commitment: toHex(o.commitment), member: o.payload.member, blind: o.payload.blind };
}
export async function checkAuthorDisclosure(d: AuthorDisclosure, onChainTag: Uint8Array): Promise<boolean> {
  return equal(await authorTag(fromHex(d.commitment), fromHex(d.member), fromHex(d.blind)), onChainTag);
}

// ------------------------------------------------- keys at rest / backup

export type ExportedIdentity = { v: 1; name: string; encPrivate: JsonWebKey; encPublic: string; chainSecret: string; createdAt: string };

export async function exportIdentity(id: Identity): Promise<ExportedIdentity> {
  return { v: 1, name: id.name, encPrivate: await subtle().exportKey("jwk", id.encPrivate), encPublic: toB64u(id.encPublic), chainSecret: toHex(id.chainSecret), createdAt: id.createdAt };
}
export async function importIdentity(x: ExportedIdentity, extractable = true): Promise<Identity> {
  if (!x || x.v !== 1 || !x.encPrivate || typeof x.chainSecret !== "string") throw new Error("not an identity");
  const encPrivate = await subtle().importKey("jwk", x.encPrivate, { name: "X25519" }, extractable, ["deriveBits"]);
  const chainSecret = fromHex(x.chainSecret);
  if (chainSecret.length !== 32) throw new Error("not an identity");
  return { name: cleanName(x.name), encPrivate, encPublic: fromB64u(x.encPublic), chainSecret, member: await memberCommitment(chainSecret), createdAt: x.createdAt };
}

export type WrappedBlob = { v: 1; alg: "AES-256-GCM"; kdf?: { name: "PBKDF2-SHA256"; iterations: number; salt: string }; iv: string; data: string };

/** Encrypt bytes with an AES-GCM key (e.g. a non-extractable device key kept in IndexedDB). */
export async function wrapWithKey(key: CryptoKey, data: Uint8Array, aad = "night-messenger/v1/identity"): Promise<WrappedBlob> {
  const iv = rand(12);
  return { v: 1, alg: "AES-256-GCM", iv: toB64u(iv), data: toB64u(await gcm("encrypt", key, iv, data, te.encode(aad))) };
}
export async function unwrapWithKey(key: CryptoKey, blob: WrappedBlob, aad = "night-messenger/v1/identity"): Promise<Uint8Array> {
  return gcm("decrypt", key, fromB64u(blob.iv), fromB64u(blob.data), te.encode(aad));
}
async function passphraseKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  if (String(passphrase ?? "").length < 8) throw new Error("passphrase must be at least 8 characters");
  const base = await subtle().importKey("raw", buf(te.encode(passphrase)), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: buf(salt), iterations }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
/** Passphrase-protected identity backup (PBKDF2-SHA256, 600k iterations). */
export async function backupIdentity(id: Identity, passphrase: string): Promise<WrappedBlob> {
  const salt = rand(16);
  const key = await passphraseKey(passphrase, salt, PBKDF2_ITERATIONS);
  const blob = await wrapWithKey(key, te.encode(JSON.stringify(await exportIdentity(id))), "night-messenger/v1/backup");
  return { ...blob, kdf: { name: "PBKDF2-SHA256", iterations: PBKDF2_ITERATIONS, salt: toB64u(salt) } };
}
export async function restoreIdentity(blob: WrappedBlob, passphrase: string): Promise<Identity> {
  if (!blob?.kdf || blob.kdf.name !== "PBKDF2-SHA256" || blob.kdf.iterations < 100_000 || blob.kdf.iterations > 10_000_000) throw new Error("not a Night Messenger backup");
  const key = await passphraseKey(passphrase, fromB64u(blob.kdf.salt), blob.kdf.iterations);
  let raw: Uint8Array;
  try {
    raw = await unwrapWithKey(key, blob, "night-messenger/v1/backup");
  } catch {
    throw new Error("wrong passphrase or damaged backup");
  }
  return importIdentity(JSON.parse(td.decode(raw)));
}
