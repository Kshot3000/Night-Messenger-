"use client";

import { useWallet } from "@/hooks/useWallet";

export function ConnectWalletButton({
  className = "",
  onConnected,
}: {
  className?: string;
  onConnected?: () => void;
}) {
  const { session, busy, connect, disconnect } = useWallet();

  if (session.status === "connected") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="hidden text-right sm:block">
          <p className="text-xs text-nm-muted">{session.walletName ?? "Lace"}</p>
          <p className="font-mono text-xs text-nm-accent-soft">
            {session.addressPreview ?? "Connected"}
          </p>
        </div>
        <button type="button" className="nm-btn nm-btn-ghost px-3 py-2 text-sm" onClick={disconnect}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-end gap-1 ${className}`}>
      <button
        type="button"
        className="nm-btn nm-btn-primary px-4 py-2 text-sm disabled:opacity-60"
        disabled={busy || session.status === "connecting"}
        onClick={async () => {
          const next = await connect();
          if (next.status === "connected") onConnected?.();
        }}
        aria-label="Connect Lace Midnight wallet"
      >
        {busy || session.status === "connecting" ? "Connecting…" : "Connect wallet"}
      </button>
      {session.error ? (
        <p className="max-w-xs text-right text-[11px] leading-snug text-nm-danger" role="alert">
          {session.error}
        </p>
      ) : (
        <p className="max-w-[220px] text-right text-[10px] text-nm-muted">
          Enumerates <code className="text-nm-accent-soft">window.midnight</code> — never hardcodes mnLace
        </p>
      )}
    </div>
  );
}
