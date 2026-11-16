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
            : "Connect Lace"}
        </span>
      </button>
      {open && (
        <Modal
          title={
            session.status === "connected" ? "Your wallet" : "Connect Lace"
          }
          onClose={() => setOpen(false)}
        >
          <p className="modal-description">
            Connect the Lace desktop extension on Midnight Preview to create or
            join a DM inbox, post an envelope, and acknowledge delivery on the
            live test contract. This network is unaudited and can reset. Phones
            cannot connect Lace.
          </p>
          {session.status === "connected" ? (
            <>
              <div className="connected-card">
                <Icon name="check" size={24} />
                <strong>{session.walletName || "Midnight wallet"}</strong>
                <code>
                  {session.addressPreview || "Connected for this session"}
                </code>
                <p className="field-help">Midnight Preview</p>
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
                        <small>Midnight · Preview</small>
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
                    Open this site in a desktop browser with the Lace extension
                    enabled. Phones cannot connect Lace. You can keep exploring
                    without a wallet; on-chain post and ack need one.
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
              Proving follows whatever you set in Lace under Settings → Midnight.
              If Remote is listed, it is the least install (no Docker) but the
              remote operator can read private proof inputs, including your
              member secret. The private option is a local proof server 9.0.0 on
              127.0.0.1:6300 with Local selected. See the README for sources.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
