import type { Metadata } from "next";
import { Suspense } from "react";
import { ReceiptVerifier } from "@/components/ReceiptVerifier";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Verify a delivery receipt",
  description: "Check that a message was posted by a verified member and how many members acknowledged it, without seeing the message.",
};

export default function VerifyPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="container pm-verify-page">
        <Suspense fallback={null}>
          <ReceiptVerifier />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
