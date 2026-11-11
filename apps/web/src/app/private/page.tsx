import type { Metadata } from "next";
import { PrivateMessenger } from "@/components/PrivateMessenger";

export const metadata: Metadata = {
  title: "Private chat",
  description: "End-to-end encrypted messages with anonymous membership proofs and checkable delivery receipts on Midnight.",
};

export default function PrivatePage() {
  return <PrivateMessenger />;
}
