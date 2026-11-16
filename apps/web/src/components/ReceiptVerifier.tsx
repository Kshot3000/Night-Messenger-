// SPDX-License-Identifier: Apache-2.0
"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { checkAuthorDisclosure, fromHex, PRODUCT, type AuthorDisclosure } from "@midnight-messenger/shared";
import { CHAIN_KEY, DEFAULT_CHAIN, chainReceipt, chainSummary, type Receipt, type Usage } from "@/lib/chain-client";
import { checkPreviewAckOnIndexer, loadPreviewRecord, type PreviewLiveCheck, type PreviewRecord } from "@/lib/preview-public";
import { decodePreviewReceipt, type PreviewDecodedReceipt } from "@/lib/preview-receipt";

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
  const [usage, setUsage] = useState<Usage | null>(null);
  const [preview, setPreview] = useState<PreviewRecord | null>(null);
  const [previewLive, setPreviewLive] = useState<PreviewLiveCheck | null>(null);
  const [previewLiveError, setPreviewLiveError] = useState("");
  const [liveSource, setLiveSource] = useState<PreviewDecodedReceipt["source"] | "snapshot" | null>(null);

  useEffect(() => {
    chainSummary(chain).then(setUsage).catch(() => setUsage(null));
  }, [chain, receipt]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHAIN_KEY);
      if (saved) setChain(saved);
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rec = await loadPreviewRecord();
      if (cancelled || !rec) return;
      setPreview(rec);
      const c = rec.commitment?.replace(/^0x/, "");
      if (c && !commitment) setCommitment(c);
      try {
        const live = await checkPreviewAckOnIndexer(rec);
        if (!cancelled) setPreviewLive(live);
      } catch (e) {
        if (!cancelled) setPreviewLiveError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
    // Fill the test commitment once if the field is still empty.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!preview) return;
    const c = commitment.trim().toLowerCase().replace(/^0x/, "");
    if (HEX32.test(c)) void check();
    // Run when the Preview record arrives (and if ?c= or the test commitment is set).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  const check = useCallback(async () => {
    setError("");
    setReceipt(null);
    setAuthorship("");
    setLiveSource(null);
    const c = commitment.trim().toLowerCase().replace(/^0x/, "");
    if (!HEX32.test(c)) return setError("A commitment is 64 hex characters.");
    try {
      const decoded = await decodePreviewReceipt(c, { contractAddress: preview?.contractAddress ?? undefined });
      setLiveSource(decoded.source);
      setPreviewLiveError("");
      setReceipt({
        commitment: decoded.commitment,
        posted: decoded.posted,
        inboxId: decoded.inboxId,
        authorTag: decoded.authorTag,
        seq: decoded.seq,
        receipts: decoded.receipts ?? "0",
      });
      if (preview) {
        try {
          setPreviewLive(await checkPreviewAckOnIndexer(preview));
        } catch (e) {
          setPreviewLiveError((e as Error).message);
        }
      }
      return;
    } catch (e) {
      const msg = (e as Error).message;
      setPreviewLiveError(msg);
      const testC = (preview?.verify?.commitment ?? preview?.commitment ?? "").replace(/^0x/, "").toLowerCase();
      if (preview?.status === "deployed-drill-passed" && testC && c === testC) {
        const v = preview.verify ?? {};
        setLiveSource("snapshot");
        setReceipt({
          commitment: c,
          posted: true,
          inboxId: v.inboxId ?? preview.inboxId ?? undefined,
          authorTag: v.authorTag,
          seq: v.seq,
          receipts: v.acks ?? preview.check?.acks ?? "1",
        });
        setError(`Could not decode live Preview state (${msg}). Showing the published drill snapshot.`);
        return;
      }
      try {
        setReceipt(await chainReceipt(chain, c));
        setLiveSource(null);
      } catch (e2) {
        setError(`Could not decode this commitment on Preview (${msg}) or reach the local simulator at ${chain}: ${(e2 as Error).message}`);
      }
    }
  }, [commitment, chain, preview]);

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
        acknowledged it. You will not see the message. Read receipts are in testing and unaudited: outsiders can&apos;t
        tell who acknowledged, but in a 1:1 chat the sender knows it was the other person.
      </p>
      {preview?.status === "deployed-drill-passed" && preview.contractAddress && (
        <div className="pm-receipt" style={{ marginBottom: "1.25rem" }}>
          <p className="pm-muted pm-small">
            <strong>Midnight Preview testnet</strong> (disposable; this chain can reset). Contract{" "}
            <a className="pm-mono" href={preview.explorer ?? `https://preview.midnightexplorer.com/contracts/0x${preview.contractAddress}`} target="_blank" rel="noreferrer">
              {preview.contractAddress}
            </a>
            {previewLive?.height != null && <> · indexer height {previewLive.height}</>}
            {previewLive && (
              <>
                {" "}· ackDelivery tx {previewLive.ackDeliveryPresent ? "is on-chain" : "was not found on the indexer"}
                {preview.txs?.ackDelivery?.explorer && (
                  <>
                    {" "}(
                    <a href={preview.txs.ackDelivery.explorer} target="_blank" rel="noreferrer">explorer</a>
                    )
                  </>
                )}
              </>
            )}
            {previewLiveError && <> · indexer check failed: {previewLiveError}</>}
          </p>
          {preview.commitment && (
            <p className="pm-muted pm-small">
              Test commitment <span className="pm-mono">{preview.commitment}</span>
              {preview.check?.acks != null && <> · {preview.check.acks} delivery receipt (from the Preview deploy drill)</>}
              . Lookups decode the live Preview contract state (ack counts for any new commitment, not only this drill).
              Preview is a testnet, unaudited, and can reset.
            </p>
          )}
        </div>
      )}
      <div className="pm-row">
        <input className="pm-input pm-mono" value={commitment} onChange={(e) => setCommitment(e.target.value)} placeholder="commitment (64 hex)" aria-label="Commitment" />
        <button className="button button-light button-small" onClick={check}>Check</button>
      </div>
      <details className="pm-details">
        <summary>Chain endpoint</summary>
        <input className="pm-input pm-mono" value={chain} onChange={(e) => setChain(e.target.value)} aria-label="Chain endpoint" />
        <p className="pm-muted pm-small">
          Receipts are decoded from the live Midnight Preview contract first. This simulator endpoint is only a fallback
          for local development. Preview is unaudited and can reset.
        </p>
      </details>
      {usage && (
        <p className="pm-muted pm-small" aria-label="Network totals">
          Totals from ledger counters: {usage.registrations} member registrations · {usage.envelopesPosted} envelopes posted ·{" "}
          {usage.deliveryReceipts} delivery receipts · {usage.inboxes} inboxes
        </p>
      )}
      {error && <p className="pm-error" role="alert">{error}</p>}
      {receipt && !receipt.posted && <p className="pm-error" role="status">No post with this commitment on this chain.</p>}
      {receipt?.posted && (
        <div className="pm-receipt" role="status">
          <div className="pm-receipt-big">
            <span>{receipt.receipts}</span> delivery receipt{receipt.receipts === "1" ? "" : "s"}
          </div>
          {liveSource === "preview-ledger" && (
            <p className="pm-muted pm-small">Decoded from the live Preview ledger.</p>
          )}
          {liveSource === "snapshot" && (
            <p className="pm-muted pm-small">From the published Preview drill snapshot (live decode failed).</p>
          )}
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
