import type { Metadata } from "next";
import { Suspense } from "react";
import { PrivateMessenger } from "@/components/PrivateMessenger";

export const metadata: Metadata = {
  title: "Private chat",
  description: "End-to-end encrypted messages with anonymous membership proofs and read receipts (in testing, unaudited) on Midnight.",
};

export default function PrivatePage() {
  return (
    <Suspense fallback={<main className="pm-shell pm-center">Loading private chat…</main>}>
      <PrivateMessenger />
    </Suspense>
  );
}
