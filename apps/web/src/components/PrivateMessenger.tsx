// SPDX-License-Identifier: Apache-2.0
"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  PRODUCT,
  backupIdentity,
  createIdentity,
  dmInboxId,
  fromB64u,
  fromHex,
  inviteCode,
  mailboxFor,
  open as openEnvelope,
  parseInvite,
  publicIdentity,
  restoreIdentity,
  seal,
  toB64u,
  toHex,
  type Identity,
  type PublicIdentity,
} from "@midnight-messenger/shared";
import { Brand } from "./Brand";
import { Icon } from "./Icon";
import { DEFAULT_RELAY, RELAY_KEY, addContact, addMessage, emptyState, isRelayUrl, updateMessage, type ChatMessage, type PrivateState } from "@/lib/private-store";
import { deviceKey, forgetEverything, loadIdentity, loadState, saveIdentity, saveState } from "@/lib/private-vault";
import { CHAIN_KEY, DEFAULT_CHAIN, chainAck, chainHealth, chainReceipt, chainSend } from "@/lib/chain-client";

type Boot = "loading" | "unsupported" | "setup" | "ready";
const POLL_MS = 3000;

async function x25519Supported(): Promise<boolean> {
  try {
    await crypto.subtle.generateKey({ name: "X25519" }, false, ["deriveBits"]);
    return true;
  } catch {
    return false;
  }
}

export function PrivateMessenger() {
  const [boot, setBoot] = useState<Boot>("loading");
  const [bootError, setBootError] = useState("");
  const [me, setMe] = useState<Identity | null>(null);
  const [myPublic, setMyPublic] = useState<PublicIdentity | null>(null);
  const [state, setState] = useState<PrivateState>(emptyState());
  const [active, setActive] = useState<string | null>(null);
  const [relay, setRelay] = useState(DEFAULT_RELAY);
  const [chain, setChain] = useState(DEFAULT_CHAIN);
  const [relayOk, setRelayOk] = useState<boolean | null>(null);
  const [chainInfo, setChainInfo] = useState<{ ok: boolean; proving: boolean } | null>(null);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const keyRef = useRef<CryptoKey | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // ---------------------------------------------------------- boot
  useEffect(() => {
    (async () => {
      if (!globalThis.crypto?.subtle || !(await x25519Supported())) return setBoot("unsupported");
      try {
        setRelay(localStorage.getItem(RELAY_KEY) || DEFAULT_RELAY);
        setChain(localStorage.getItem(CHAIN_KEY) || DEFAULT_CHAIN);
        const key = await deviceKey();
        keyRef.current = key;
        const id = await loadIdentity(key);
        if (!id) return setBoot("setup");
        setMe(id);
        setMyPublic(await publicIdentity(id));
        const s = await loadState(key);
        setState(s);
        setActive(s.contacts[0]?.mailbox ?? null);
        setBoot("ready");
      } catch (e) {
        setBootError(`Could not unlock local keys: ${(e as Error).message}`);
        setBoot("setup");
      }
    })();
  }, []);

  const commit = useCallback(async (next: PrivateState) => {
    stateRef.current = next;
    setState(next);
    if (keyRef.current) await saveState(keyRef.current, next).catch(() => setNotice("Could not save to this browser's storage."));
  }, []);

  async function adopt(id: Identity) {
    if (!keyRef.current) keyRef.current = await deviceKey();
    await saveIdentity(keyRef.current, id);
    setMe(id);
    setMyPublic(await publicIdentity(id));
    await commit(emptyState());
    setBoot("ready");
  }

  // ---------------------------------------------------------- health
  useEffect(() => {
    if (boot !== "ready") return;
    let stop = false;
    const ping = async () => {
      const r = await fetch(`${relay.replace(/\/$/, "")}/health`).then((x) => x.ok).catch(() => false);
      const c = await chainHealth(chain).catch(() => null);
      if (!stop) {
        setRelayOk(r);
        setChainInfo(c ? { ok: true, proving: !!c.proving } : { ok: false, proving: false });
      }
    };
    void ping();
    const t = setInterval(ping, 15000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [boot, relay, chain]);

  // ---------------------------------------------------------- receive
  const poll = useCallback(async () => {
    if (!me || !myPublic || !relayOk) return;
    let s = stateRef.current;
    const r = await fetch(`${relay.replace(/\/$/, "")}/v1/mailboxes/${myPublic.mailbox}/messages?after=${s.cursor}`).catch(() => null);
    if (!r?.ok) return;
    const { messages, next } = (await r.json()) as { messages: { seq: number; envelope: string }[]; next: number };
    if (!messages.length) return;
    for (const m of messages) {
      try {
        const o = await openEnvelope(me, fromB64u(m.envelope));
        let contact = s.contacts.find((c) => c.encPublic === o.senderKey);
        const verified = !!contact && contact.member === o.payload.member;
        if (!contact) {
          const pub = fromB64u(o.senderKey);
          const stranger: PublicIdentity = { v: 1, name: `${o.payload.from.slice(0, 28)} (not in contacts)`, encPublic: o.senderKey, member: o.payload.member, mailbox: await mailboxFor(pub) };
          s = addContact(s, stranger);
          contact = s.contacts.find((c) => c.mailbox === stranger.mailbox)!;
        }
        const msg: ChatMessage = {
          id: o.payload.id,
          dir: "in",
          body: o.payload.body,
          at: o.payload.sentAt,
          commitment: toHex(o.commitment),
          authorTag: toHex(o.authorTag),
          senderVerified: verified,
          member: o.payload.member,
          blind: o.payload.blind,
          relaySeq: m.seq,
        };
        s = addMessage(s, contact.mailbox, msg);
      } catch {
        /* not for us or tampered: skip */
      }
    }
    s = { ...s, cursor: next };
    await commit(s);
  }, [me, myPublic, relay, relayOk, commit]);

  useEffect(() => {
    if (boot !== "ready") return;
    void poll();
    const t = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(t);
  }, [boot, poll]);

  // ---------------------------------------------------------- chain sync: ack received, refresh receipts
  const syncChain = useCallback(async () => {
    if (!me || !chainInfo?.ok) return;
    let s = stateRef.current;
    let changed = false;
    for (const [mailbox, list] of Object.entries(s.threads)) {
      for (const m of list.slice(-30)) {
        try {
          let rc = await chainReceipt(chain, m.commitment);
          if (m.dir === "in" && rc.posted && !m.chain?.acked) {
            rc = (await chainAck(chain, { sk: toHex(me.chainSecret), commitment: m.commitment }).catch((e: Error) => {
              if (/already acknowledged/.test(e.message)) return { receipt: rc };
              throw e;
            })).receipt;
            s = updateMessage(s, mailbox, m.commitment, { chain: { posted: true, seq: rc.seq, receipts: rc.receipts, acked: true } });
            changed = true;
          } else if (rc.posted && (rc.receipts !== m.chain?.receipts || !m.chain?.posted)) {
            s = updateMessage(s, mailbox, m.commitment, { chain: { ...m.chain, posted: true, seq: rc.seq, receipts: rc.receipts } });
            changed = true;
          }
        } catch {
          /* chain offline: try later */
        }
      }
    }
    if (changed) await commit(s);
  }, [me, chain, chainInfo, commit]);

  useEffect(() => {
    if (boot !== "ready") return;
    const t = setInterval(() => void syncChain(), 5000);
    return () => clearInterval(t);
  }, [boot, syncChain]);

  // ---------------------------------------------------------- send
  async function send() {
    const contact = state.contacts.find((c) => c.mailbox === active);
    const body = draft.trim();
    if (!me || !contact || !body || busy) return;
    if (!relayOk) return setNotice(`Relay ${relay} is offline. Start it with: pnpm relay`);
    setBusy(true);
    try {
      const inbox = await dmInboxId(me.member, fromHex(contact.member));
      const s = await seal(me, contact, body, { inbox });
      const up = await fetch(`${relay.replace(/\/$/, "")}/v1/mailboxes/${contact.mailbox}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ envelope: toB64u(s.envelope) }),
      });
      if (!up.ok) throw new Error(`relay refused the envelope (${up.status})`);
      const commitment = toHex(s.commitment);
      let next = addMessage(stateRef.current, contact.mailbox, {
        id: s.payload.id,
        dir: "out",
        body,
        at: s.payload.sentAt,
        commitment,
        authorTag: toHex(s.authorTag),
        senderVerified: true,
        member: s.payload.member,
        blind: s.payload.blind,
        chain: { posted: false },
      });
      setDraft("");
      await commit(next);
      if (chainInfo?.ok) {
        try {
          const r = await chainSend(chain, { sk: toHex(me.chainSecret), blind: s.payload.blind, inboxId: toHex(inbox), commitment, members: [toHex(me.member), contact.member] });
          const proof = r.txs.find((t) => t.circuit === "postEnvelope")?.proof;
          next = updateMessage(stateRef.current, contact.mailbox, commitment, { chain: { posted: true, seq: r.receipt.seq, receipts: r.receipt.receipts, proofMs: proof?.ms } });
        } catch (e) {
          next = updateMessage(stateRef.current, contact.mailbox, commitment, { chain: { posted: false, error: (e as Error).message } });
        }
        await commit(next);
      }
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ---------------------------------------------------------- render
  if (boot === "loading") return <main className="pm-shell pm-center">Unlocking local keys…</main>;
  if (boot === "unsupported")
    return (
      <main className="pm-shell pm-center">
        <div className="pm-card">
          <h1>This browser can&apos;t run {PRODUCT.name} encryption</h1>
          <p className="pm-muted">It needs WebCrypto X25519 (Chrome or Edge 133+, Firefox 130+, Safari 17+) over https or localhost.</p>
          <Link className="button button-light button-small" href="/">Back home</Link>
        </div>
      </main>
    );
  if (boot === "setup" || !me || !myPublic) return <Setup error={bootError} onReady={adopt} />;

  const contact = state.contacts.find((c) => c.mailbox === active) ?? null;
  const thread = contact ? state.threads[contact.mailbox] ?? [] : [];

  return (
    <main className="pm-shell">
      <header className="pm-top">
        <Link href="/" aria-label={`${PRODUCT.name} home`}><Brand /></Link>
        <div className="pm-status" aria-live="polite">
          <span className={`pm-dot ${relayOk ? "ok" : "off"}`} /> relay {relayOk ? "online" : relayOk === null ? "…" : "offline"}
          <span className={`pm-dot ${chainInfo?.ok ? "ok" : "off"}`} /> chain {chainInfo?.ok ? (chainInfo.proving ? "sim + real ZK proofs" : "sim, no proofs") : "offline"}
        </div>
      </header>
      {notice && (
        <p className="pm-notice" role="status">
          {notice} <button className="pm-link" onClick={() => setNotice("")}>Dismiss</button>
        </p>
      )}
      <div className={`pm-layout ${contact ? "has-thread" : ""}`}>
        <aside className="pm-side" aria-label="Contacts">
          <IdentityCard me={me} pub={myPublic} onNotice={setNotice} onForget={() => { forgetEverything(); location.reload(); }} />
          <AddContact myMailbox={myPublic.mailbox} onAdd={async (c) => { await commit(addContact(stateRef.current, c)); setActive(c.mailbox); }} onNotice={setNotice} />
          <ul className="pm-contacts">
            {state.contacts.map((c) => (
              <li key={c.mailbox}>
                <button className={`pm-contact ${c.mailbox === active ? "active" : ""}`} onClick={() => setActive(c.mailbox)}>
                  <strong>{c.name}</strong>
                  <span className="pm-mono pm-small">{c.member.slice(0, 10)}…</span>
                </button>
              </li>
            ))}
            {!state.contacts.length && <li className="pm-muted pm-small">No contacts yet. Swap invite codes with someone (open this page in a second browser to try it alone).</li>}
          </ul>
          <Settings relay={relay} chain={chain} onRelay={(u) => { setRelay(u); localStorage.setItem(RELAY_KEY, u); }} onChain={(u) => { setChain(u); localStorage.setItem(CHAIN_KEY, u); }} onNotice={setNotice} />
        </aside>
        <section className="pm-thread" aria-label="Conversation">
          {!contact ? (
            <div className="pm-empty pm-muted">Pick a contact or add one with their invite code.</div>
          ) : (
            <>
              <div className="pm-thread-head">
                <button className="icon-button pm-back" aria-label="Back to contacts" onClick={() => setActive(null)}><Icon name="back" /></button>
                <div>
                  <strong>{contact.name}</strong>
                  <div className="pm-small pm-muted">E2EE · X25519 + AES-256-GCM · member {contact.member.slice(0, 10)}…</div>
                </div>
              </div>
              <ol className="pm-messages">
                {thread.map((m) => <Bubble key={m.commitment} m={m} />)}
                {!thread.length && <li className="pm-muted pm-small">No messages yet. The first one creates your shared inbox on-chain.</li>}
              </ol>
              <form className="pm-compose" onSubmit={(e) => { e.preventDefault(); void send(); }}>
                <textarea className="pm-input" rows={2} maxLength={4000} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a sealed message…" aria-label="Message" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
                <button className="button button-light button-small" disabled={busy || !draft.trim()} aria-label="Send">
                  {busy ? "Sealing…" : <Icon name="send" />}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  // Same shape as authorDisclosure(): enough for anyone to check this one message against the ledger.
  const disclosure = () => JSON.stringify({ commitment: m.commitment, member: m.member, blind: m.blind });
  return (
    <li className={`pm-bubble ${m.dir}`}>
      <p>{m.body}</p>
      <div className="pm-meta">
        <span title="End-to-end encrypted"><Icon name="lock" size={12} /> sealed</span>
        {m.dir === "in" && (m.senderVerified ? <span className="pm-ok" title="Sender proved the key from their invite">sender key verified</span> : <span className="pm-error">unknown sender</span>)}
        {m.chain?.posted ? (
          <Link href={`/verify/?c=${m.commitment}`} title="Open the public receipt view">
            on-chain #{m.chain.seq} · {m.chain.receipts ?? "0"} receipt{m.chain.receipts === "1" ? "" : "s"}
            {m.chain.proofMs ? ` · proof ${(m.chain.proofMs / 1000).toFixed(1)}s` : ""}
          </Link>
        ) : (
          <span className="pm-muted" title={m.chain?.error}>{m.chain?.error ? `not on-chain: ${m.chain.error}` : m.dir === "out" ? "relay only" : "checking chain…"}</span>
        )}
        <span>{new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        <button className="pm-link" onClick={async () => { await navigator.clipboard.writeText(disclosure()).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }} title="Copy a bundle that proves who wrote this one message">
          {copied ? "copied" : "share authorship proof"}
        </button>
      </div>
    </li>
  );
}

function Setup({ error, onReady }: { error: string; onReady: (id: Identity) => Promise<void> }) {
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState(error);
  const [busy, setBusy] = useState(false);
  return (
    <main className="pm-shell pm-center">
      <div className="pm-card">
        <p className="eyebrow">{PRODUCT.name} · private chat</p>
        <h1>Verified, but anonymous.</h1>
        <p className="pm-muted">
          Your keys are made in this browser and sealed with a device key that can&apos;t be exported. Messages are end-to-end
          encrypted; the relay only stores ciphertext. On Midnight you prove you&apos;re a member of the conversation without
          saying which member, and anyone can check delivery receipts.
        </p>
        <form className="pm-stack" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(""); try { await onReady(await createIdentity(name)); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); } }}>
          <label className="pm-label">Display name (only your contacts see it)
            <input className="pm-input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} required />
          </label>
          <button className="button button-light" disabled={busy || !name.trim()}>{busy ? "Generating keys…" : "Create my keys"}</button>
        </form>
        <details className="pm-details">
          <summary>Restore from a backup</summary>
          <form className="pm-stack" onSubmit={async (e) => { e.preventDefault(); if (!file) return; setBusy(true); setErr(""); try { await onReady(await restoreIdentity(JSON.parse(await file.text()), pass)); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); } }}>
            <input type="file" accept="application/json,.json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Backup file" />
            <input className="pm-input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Backup passphrase" aria-label="Backup passphrase" />
            <button className="button button-outline button-small" disabled={busy || !file}>Restore</button>
          </form>
        </details>
        {err && <p className="pm-error" role="alert">{err}</p>}
      </div>
    </main>
  );
}

function IdentityCard({ me, pub, onNotice, onForget }: { me: Identity; pub: PublicIdentity; onNotice: (s: string) => void; onForget: () => void }) {
  const [pass, setPass] = useState("");
  const [showBackup, setShowBackup] = useState(false);
  return (
    <div className="pm-me">
      <div><strong>{me.name}</strong> <span className="pm-small pm-muted pm-mono">member {pub.member.slice(0, 10)}…</span></div>
      <div className="pm-row">
        <button className="button button-light button-small" onClick={async () => { await navigator.clipboard.writeText(await inviteCode(me)).then(() => onNotice("Invite code copied. It has your public keys only; send it to your contact.")).catch(() => onNotice("Copy failed; your browser blocked the clipboard.")); }}>
          <Icon name="copy" size={14} /> Copy my invite
        </button>
        <button className="button button-outline button-small" onClick={() => setShowBackup(!showBackup)}>Back up keys</button>
      </div>
      {showBackup && (
        <form className="pm-stack" onSubmit={async (e) => {
          e.preventDefault();
          try {
            const blob = await backupIdentity(me, pass);
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([JSON.stringify(blob)], { type: "application/json" }));
            a.download = "night-messenger-keys.backup.json";
            a.click();
            URL.revokeObjectURL(a.href);
            setPass("");
            setShowBackup(false);
            onNotice("Encrypted key backup downloaded. Without the passphrase it cannot be opened.");
          } catch (x) {
            onNotice((x as Error).message);
          }
        }}>
          <input className="pm-input" type="password" minLength={8} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Backup passphrase (8+ chars)" aria-label="Backup passphrase" />
          <button className="button button-outline button-small">Download encrypted backup</button>
        </form>
      )}
      <button className="pm-link pm-small" onClick={() => { if (confirm("Delete your keys and messages from this browser? Without a backup they are gone.")) onForget(); }}>Forget this device</button>
    </div>
  );
}

function AddContact({ myMailbox, onAdd, onNotice }: { myMailbox: string; onAdd: (c: PublicIdentity) => Promise<void>; onNotice: (s: string) => void }) {
  const [code, setCode] = useState("");
  return (
    <form className="pm-row" onSubmit={async (e) => {
      e.preventDefault();
      try {
        const c = await parseInvite(code);
        if (c.mailbox === myMailbox) return onNotice("That's your own invite.");
        await onAdd(c);
        setCode("");
      } catch (x) {
        onNotice((x as Error).message);
      }
    }}>
      <input className="pm-input pm-mono" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste an invite (nm1:…)" aria-label="Contact invite code" />
      <button className="button button-outline button-small" aria-label="Add contact"><Icon name="plus" size={14} /></button>
    </form>
  );
}

function Settings({ relay, chain, onRelay, onChain, onNotice }: { relay: string; chain: string; onRelay: (u: string) => void; onChain: (u: string) => void; onNotice: (s: string) => void }) {
  const [r, setR] = useState(relay);
  const [c, setC] = useState(chain);
  return (
    <details className="pm-details">
      <summary>Relay &amp; chain</summary>
      <form className="pm-stack" onSubmit={(e) => {
        e.preventDefault();
        if (!isRelayUrl(r) || !isRelayUrl(c)) return onNotice("Use https://, or http:// on localhost only.");
        onRelay(r);
        onChain(c);
        onNotice("Saved.");
      }}>
        <label className="pm-label pm-small">Relay (ciphertext only)<input className="pm-input pm-mono" value={r} onChange={(e) => setR(e.target.value)} /></label>
        <label className="pm-label pm-small">Chain (local simulator until Preprod)<input className="pm-input pm-mono" value={c} onChange={(e) => setC(e.target.value)} /></label>
        <button className="button button-outline button-small">Save</button>
      </form>
    </details>
  );
}
