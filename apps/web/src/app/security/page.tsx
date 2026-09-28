import type { Metadata } from "next";
import Link from "next/link";
import { PRODUCT, PRIVACY_LEGEND } from "@midnight-messenger/shared";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Trust & security",
  description: "How Night Messenger handles privacy, open source, and honesty about stubs.",
};

export default function SecurityPage() {
  return (
    <div className="nm-aurora min-h-screen">
      <SiteHeader solid />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-nm-accent-soft">Trust</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Security & privacy</h1>
        <p className="mt-3 text-nm-muted">
          Night Messenger is free and open source. We would rather under-claim than over-claim.
        </p>

        <section className="mt-10 space-y-4">
          <h2 className="text-lg font-semibold">What we ship today</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-nm-muted">
            <li>Polished chat UX with mock conversations for product exploration</li>
            <li>Lace / Midnight wallet connect stub that enumerates <code className="text-nm-accent-soft">window.midnight</code> via Object.values / Object.keys — never hardcodes mnLace</li>
            <li>Documented selective privacy model (on-chain / off-chain / selective)</li>
            <li>Contract interfaces marked TODO — no fake proof bytes in production paths</li>
          </ul>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-lg font-semibold">Privacy model</h2>
          {PRIVACY_LEGEND.map((item) => (
            <article key={item.layer} className="nm-card p-4">
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm text-nm-muted">{item.summary}</p>
            </article>
          ))}
          <p className="text-sm text-nm-muted">
            Full write-up: <code className="text-nm-accent-soft">packages/shared/PRIVACY.md</code>
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-lg font-semibold">What we do not do</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-nm-muted">
            <li>No paywalls, dark patterns, or fake “Pro” checkouts</li>
            <li>No phone-number harvest for the MVP path</li>
            <li>No claiming Compact circuits or proof servers are live before they are</li>
          </ul>
        </section>

        <section className="mt-10 nm-card p-5">
          <h2 className="font-semibold">Open source</h2>
          <p className="mt-2 text-sm text-nm-muted">
            Inspect every line. Report issues. Fork freely.
          </p>
          <a
            className="nm-btn nm-btn-primary mt-4 inline-flex"
            href={PRODUCT.repoUrl}
            target="_blank"
            rel="noreferrer"
          >
            github.com/Kshot3000/Night-Messenger-
          </a>
        </section>

        <p className="mt-10 text-sm">
          <Link href="/" className="text-nm-accent-soft hover:underline">
            ← Back home
          </Link>
        </p>
      </main>
    </div>
  );
}
