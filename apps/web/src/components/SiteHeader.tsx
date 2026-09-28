"use client";

import Link from "next/link";
import { PRODUCT } from "@midnight-messenger/shared";

export function SiteHeader({ solid }: { solid?: boolean }) {
  return (
    <header
      className={`sticky top-0 z-40 ${solid ? "nm-glass" : "bg-transparent"}`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="Night Messenger home">
          <span className="nm-seal h-9 w-9 rounded-lg text-base" title="夜 — night">
            {PRODUCT.brandMark}
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-nm-text">
            {PRODUCT.name}
          </span>
          <span className="hidden rounded-full border border-nm-border bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-nm-accent-soft sm:inline">
            Free & open
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Primary">
          <Link href="/security" className="nm-btn nm-btn-ghost hidden px-3 py-2 text-sm sm:inline-flex">
            Trust & security
          </Link>
          <a
            href={PRODUCT.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="nm-btn nm-btn-ghost px-3 py-2 text-sm"
          >
            GitHub
          </a>
          <Link href="/onboarding" className="nm-btn nm-btn-primary px-4 py-2 text-sm">
            Open app
          </Link>
        </nav>
      </div>
    </header>
  );
}
