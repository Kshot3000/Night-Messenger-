// SPDX-License-Identifier: Apache-2.0
"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { checkAuthorDisclosure, fromHex, PRODUCT, type AuthorDisclosure } from "@midnight-messenger/shared";
import { CHAIN_KEY, DEFAULT_CHAIN, chainReceipt, type Receipt } from "@/lib/chain-client";

const HEX32 = /^[0-9a-f]{64}$/;

/** Public receipt view: anyone with a commitment can check it. No keys, no message content. */
export function ReceiptVerifier() {
  const params = useSearchParams();
  const [commitment, setCommitment] = useState(params.get("c") ?? "");
  const [chain, setChain] = useState(DEFAULT_CHAIN);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [bundle, setBundle] = useState("");
  const [authorship, setAuthorship] = useState<"" | "proven" | "rejected" | "invalid">("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHAIN_KEY);
      if (saved) setChain(saved);
    } catch {}
  }, []);

  const check = useCallback(async () => {
    setError("");
    setReceipt(null);
    setAuthorship("");
    const c = commitment.trim().toLowerCase().replace(/^0x/, "");
    if (!HEX32.test(c)) return setError("A commitment is 64 hex characters.");
    try {
      setReceipt(await chainReceipt(chain, c));
    } catch (e) {
      setError(`Could not reach the chain at ${chain}: ${(e as Error).message}`);
    }
  }, [commitment, chain]);

  useEffect(() => {
    if (params.get("c")) void check();
    // run once for a shared link
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkBundle() {
    if (!receipt?.authorTag) return;
    try {
      const d = JSON.parse(bundle) as AuthorDisclosure;
      if (d.commitment !== receipt.commitment || !HEX32.test(d.member) || !HEX32.test(d.blind)) return setAuthorship("invalid");
      setAuthorship((await checkAuthorDisclosure(d, fromHex(receipt.authorTag))) ? "proven" : "rejected");
    } catch {
      setAuthorship("invalid");
    }
  }

  return (
    <section className="pm-card pm-verify" aria-labelledby="verify-title">
      <p className="eyebrow">Public receipt check</p>
      <h1 id="verify-title">Verify a {PRODUCT.name} delivery receipt</h1>
      <p className="pm-muted">
        Paste a message commitment. You will see whether a verified member of an inbox posted it and how many members
        acknowledged it. You will not see the message, the sender or the recipients.
      </p>
      <div className="pm-row">
        <input className="pm-input pm-mono" value={commitment} onChange={(e) => setCommitment(e.target.value)} placeholder="commitment (64 hex)" aria-label="Commitment" />
        <button className="button button-light button-small" onClick={check}>Check</button>
      </div>
      <details className="pm-details">
        <summary>Chain endpoint</summary>
        <input className="pm-input pm-mono" value={chain} onChange={(e) => setChain(e.target.value)} aria-label="Chain endpoint" />
        <p className="pm-muted pm-small">Local chain simulator today (runs the real compiled contract). Midnight Preprod indexer once deployed.</p>
      </details>
      {error && <p className="pm-error" role="alert">{error}</p>}
      {receipt && !receipt.posted && <p className="pm-error" role="status">No post with this commitment on this chain.</p>}
      {receipt?.posted && (
        <div className="pm-receipt" role="status">
          <div className="pm-receipt-big">
            <span>{receipt.receipts}</span> delivery receipt{receipt.receipts === "1" ? "" : "s"}
          </div>
          <dl>
            <dt>Posted by</dt>
            <dd>a verified member of the inbox (ZK membership proof; which member stays hidden)</dd>
            <dt>Post #</dt>
            <dd>{receipt.seq}</dd>
            <dt>Inbox</dt>
            <dd className="pm-mono">{receipt.inboxId}</dd>
            <dt>Author tag</dt>
            <dd className="pm-mono">{receipt.authorTag}</dd>
            {receipt.revealedAuthor && (
              <>
                <dt>Author (revealed by them)</dt>
                <dd className="pm-mono">{receipt.revealedAuthor}</dd>
              </>
            )}
          </dl>
          {!!receipt.txs?.length && (
            <ul className="pm-txs">
              {receipt.txs.map((t) => (
                <li key={t.n}>
                  <strong>{t.circuit}</strong> · {new Date(t.at).toLocaleString()} ·{" "}
                  {t.proof ? `ZK proof ${t.proof.bytes.toLocaleString()} B in ${(t.proof.ms / 1000).toFixed(1)} s` : "simulated (no proof server)"}
                </li>
              ))}
            </ul>
          )}
          <details className="pm-details">
            <summary>Check an authorship disclosure</summary>
            <p className="pm-muted pm-small">If the sender or recipient chose to share a disclosure bundle for this one message, paste it to confirm who wrote it.</p>
            <textarea className="pm-input pm-mono" rows={4} value={bundle} onChange={(e) => setBundle(e.target.value)} aria-label="Disclosure bundle" placeholder='{"commitment":"…","member":"…","blind":"…"}' />
            <button className="button button-outline button-small" onClick={checkBundle}>Verify authorship</button>
            {authorship === "proven" && <p className="pm-ok">Authorship proven: that member commitment wrote this message.</p>}
            {authorship === "rejected" && <p className="pm-error">Does not match the on-chain author tag.</p>}
            {authorship === "invalid" && <p className="pm-error">Not a valid bundle for this commitment.</p>}
          </details>
        </div>
      )}
    </section>
  );
}
