"use client";

import { useState } from "react";
import { PRODUCT } from "@midnight-messenger/shared";

/** Optional tip address (one constant: PRODUCT.tipAddress). Tipping unlocks nothing. */
const TIP_ADDRESS = PRODUCT.tipAddress;

export function DonationCard() {
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(TIP_ADDRESS);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="footer-donation">
      <span className="footer-donation-label">SUPPORT THE DEV</span>
      <strong>Tip in ADA (optional, unlocks nothing)</strong>
      <div className="donation-address-row">
        <code>{TIP_ADDRESS}</code>
        <button
          type="button"
          onClick={copyAddress}
          aria-label="Copy Cardano tip address"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
