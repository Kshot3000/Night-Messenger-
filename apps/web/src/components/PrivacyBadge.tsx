"use client";

import type { MessageVisibility } from "@midnight-messenger/shared";

const LABELS: Record<MessageVisibility, { label: string; tip: string }> = {
  encrypted: { label: "E2EE", tip: "Off-chain encrypted — only recipients decrypt" },
  committed: { label: "Committed", tip: "Existence commitment on-chain; body stays private" },
  selectively_disclosed: { label: "Disclosed", tip: "A proof was selectively shared — not the body" },
};

export function PrivacyBadge({ visibility }: { visibility: MessageVisibility }) {
  const meta = LABELS[visibility];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-nm-border bg-black/25 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-nm-accent-soft"
      title={meta.tip}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-nm-accent" aria-hidden />
      {meta.label}
    </span>
  );
}
