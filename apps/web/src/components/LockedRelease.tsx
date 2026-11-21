// SPDX-License-Identifier: Apache-2.0
import type { ReactNode } from "react";

function ReleaseWaiting({ subject }: { subject: string }) {
  return (
    <section className="container pm-stack" aria-label={subject}>
      <h1>{subject}</h1>
      <p>This release target is awaiting operator approval and verified deployment evidence.</p>
    </section>
  );
}

export function PrivateMessenger() { return <ReleaseWaiting subject="Messaging is disabled" />; }
export function ReceiptVerifier() { return <ReleaseWaiting subject="Receipt verification is disabled" />; }
export function ConnectWalletButton() { return <span>Wallet connection disabled</span>; }
export function WalletProvider({ children }: { children: ReactNode }) { return <>{children}</>; }
