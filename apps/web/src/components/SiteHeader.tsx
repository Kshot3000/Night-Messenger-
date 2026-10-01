"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "./Brand";
import { Icon } from "./Icon";
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav
          className={`site-nav ${open ? "is-open" : ""}`}
          id="main-navigation"
          aria-label="Main navigation"
          onClick={() => setOpen(false)}
        >
          <Link href="/#experience">The experience</Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link
            href="/security"
            aria-current={pathname.startsWith("/security") ? "page" : undefined}
          >
            Our approach
          </Link>
          <a
            href="https://github.com/Kshot3000/Night-Messenger-"
            target="_blank"
            rel="noreferrer"
            className="nav-github"
          >
            <Icon name="github" size={17} /> Source code{" "}
            <Icon name="arrowUp" size={13} />
          </a>
        </nav>
        <div className="header-actions">
          <Link href="/app" className="button button-light button-small">
            Open app <Icon name="arrowUp" size={16} />
          </Link>
          <button
            className="icon-button menu-toggle"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="main-navigation"
            onClick={() => setOpen(!open)}
          >
            <Icon name={open ? "close" : "menu"} />
          </button>
        </div>
      </div>
    </header>
  );
}
