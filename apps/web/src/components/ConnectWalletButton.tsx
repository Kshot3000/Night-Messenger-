"use client";
import { useState } from "react";
import {
  discoverMidnightProviders,
  safeWalletLabel,
  type DiscoveredProvider,
} from "@midnight-messenger/shared";
import { useWallet } from "@/hooks/useWallet";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
export function ConnectWalletButton({
  className = "",
  onConnected,
}: {
  className?: string;
  onConnected?: () => void;
}) {
  const { session, busy, connect, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const [providers, setProviders] = useState<DiscoveredProvider[]>([]);
  function showWallets() {
    setProviders(discoverMidnightProviders());
    setOpen(true);
  }
  return (
    <div className={`wallet-control ${className}`}>
      <button
        className={`button button-outline button-small ${session.status === "connected" ? "wallet-connected" : ""}`}
        onClick={showWallets}
        aria-label={
          session.status === "connected"
            ? "Manage connected wallet"
            : "Connect wallet"
        }
      >
        <Icon
          name={session.status === "connected" ? "check" : "wallet"}
          size={15}
        />
        <span>
          {session.status === "connected"
            ? session.walletName || "Wallet connected"
            : "Connect wallet"}
        </span>
      </button>
      {open && (
        <Modal
          title={
            session.status === "connected" ? "Your wallet" : "Connect a wallet"
          }
          onClose={() => setOpen(false)}
        >
          <p className="modal-description">
            An optional connection to a compatible Midnight wallet on preprod.
            Your chats remain a local demo.
          </p>
          {session.status === "connected" ? (
            <>
              <div className="connected-card">
                <Icon name="check" size={24} />
                <strong>{session.walletName || "Midnight wallet"}</strong>
                <code>
                  {session.addressPreview || "Connected for this session"}
                </code>
              </div>
              <p className="field-help">
                Disconnecting here clears this app’s session. Manage site
                permissions in your wallet to revoke access.
              </p>
              <button
                className="button button-outline wallet-full"
                onClick={disconnect}
              >
                Disconnect from this app
              </button>
            </>
          ) : (
            <>
              {providers.length ? (
                <div className="wallet-options">
                  {providers.map((p) => (
                    <button
                      key={p.injectionKey}
                      disabled={busy}
                      onClick={async () => {
                        const next = await connect(p.injectionKey);
                        if (next.status === "connected") {
                          onConnected?.();
                          setOpen(false);
                        }
                      }}
                    >
                      <span className="wallet-option-icon">
                        <Icon name="wallet" />
                      </span>
                      <span>
                        {safeWalletLabel(p.api)}
                        <small>Midnight · Preprod</small>
                      </span>
                      {busy ? (
                        <span className="spinner" />
                      ) : (
                        <Icon name="arrow" size={18} />
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="no-wallet">
                  <span className="wallet-option-icon">
                    <Icon name="wallet" size={25} />
                  </span>
                  <h3>No compatible wallet found.</h3>
                  <p>
                    Open this site in a browser with a Midnight-compatible
                    wallet extension enabled. You can keep exploring without
                    one.
                  </p>
                  <button
                    className="button button-outline button-small"
                    onClick={() => setProviders(discoverMidnightProviders())}
                  >
                    Check again <Icon name="arrow" size={15} />
                  </button>
                </div>
              )}
              {session.error && (
                <p className="form-error" role="alert">
                  {session.error}
                </p>
              )}
            </>
          )}
          <div className="modal-note">
            <Icon name="info" size={17} />
            <p>
              Connecting a wallet does not enable encryption, live messaging, or
              proofs in this preview.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
