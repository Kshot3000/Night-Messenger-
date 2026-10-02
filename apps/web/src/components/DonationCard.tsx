"use client";

import { useState } from "react";

const CARDANO_ADDRESS =
  "addr1q8hnl6vl5a6k3rw3n5g3jtte696zcl76kfatzv7gpswa9r0dj7fma6klq55y4ffm7tf0em09udnyhuk4ah92pl5x9jpqjae44v";

export function DonationCard() {
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(CARDANO_ADDRESS);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="footer-donation">
      <span className="footer-donation-label">SUPPORT THE PROJECT</span>
      <strong>Cardano / ADA donations</strong>
      <div className="donation-address-row">
        <code>{CARDANO_ADDRESS}</code>
        <button
          type="button"
          onClick={copyAddress}
          aria-label="Copy Cardano donation address"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
