import Link from "next/link";
import {
  PRODUCT,
  PRIVACY_LEGEND,
  AUDIENCE,
  WHY_NOT_SIGNAL,
  ROADMAP,
} from "@midnight-messenger/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { SakuraPetals } from "@/components/SakuraPetals";

export default function LandingPage() {
  return (
    <div className="nm-aurora min-h-screen">
      <SakuraPetals count={20} />
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-16">
          <div className="nm-fade-up mx-auto max-w-3xl text-center">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-nm-border bg-white/5 px-3 py-1 text-xs font-medium text-nm-accent-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-nm-success" />
              Free &amp; open source · Built for Midnight
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-nm-text sm:text-5xl sm:leading-[1.08]">
              Private messages.
              <span className="mt-1 block bg-gradient-to-r from-white via-nm-accent-soft to-nm-ink bg-clip-text text-transparent">
                Selective proofs.
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-nm-muted sm:text-lg">
              {PRODUCT.oneLiner} No phone number. No paywall. Just Lace + Midnight.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/onboarding" className="nm-btn nm-btn-primary px-6 py-3 text-base">
                Start chatting free
              </Link>
              <Link href="/app" className="nm-btn nm-btn-ghost px-6 py-3 text-base">
                Preview the chat UI
              </Link>
            </div>
            <p className="mt-4 text-xs text-nm-muted">
              Android app included in this repo · Web works today with mock chats
            </p>
          </div>

          <div className="nm-fade-up mx-auto mt-14 max-w-4xl">
            <div className="nm-glass overflow-hidden rounded-2xl">
              <div className="flex items-center gap-2 border-b border-nm-border px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-nm-danger/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-nm-accent-soft/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-nm-success" />
                <span className="ml-3 text-xs text-nm-muted">Night Messenger · 1:1</span>
                <span className="ml-auto font-serif text-sm text-nm-accent-soft/80" title="夜">
                  {PRODUCT.brandMark}
                </span>
              </div>
              <div className="grid md:grid-cols-[280px_1fr]">
                <div className="border-b border-nm-border p-4 md:border-b-0 md:border-r">
                  {["Ada", "Orion", "Nyx"].map((n, i) => (
                    <div
                      key={n}
                      className={`mb-2 flex items-center gap-3 rounded-xl px-3 py-2.5 ${i === 0 ? "bg-white/10" : ""}`}
                    >
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-nm-on-accent"
                        style={{
                          background: `linear-gradient(145deg, hsl(0 0% ${72 - i * 12}%), hsl(0 0% ${42 - i * 8}%))`,
                        }}
                      >
                        {n[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{n}</p>
                        <p className="text-[11px] text-nm-muted">
                          {i === 0 ? "Proof of delivery ready…" : "Sealed · E2EE"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-3 p-5">
                  <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-nm-border bg-nm-panel px-3.5 py-2.5 text-sm">
                    Committed existence on-chain; body stays E2EE.
                  </div>
                  <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-nm-accent to-nm-accent-deep px-3.5 py-2.5 text-sm text-nm-on-accent">
                    Prove delivery when you need it — not the message.
                  </div>
                  <div className="mt-2 flex gap-2">
                    <span className="rounded-full border border-nm-border px-2 py-0.5 text-[10px] uppercase text-nm-accent-soft">E2EE</span>
                    <span className="rounded-full border border-nm-border px-2 py-0.5 text-[10px] uppercase text-nm-accent-soft">Committed</span>
                    <span className="rounded-full border border-nm-border px-2 py-0.5 text-[10px] uppercase text-nm-accent-soft">Selective</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-nm-border bg-nm-elevated/40 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              Three layers. You stay in control.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-nm-muted sm:text-base">
              Midnight ZK + selective disclosure — high level, no fake crypto APIs.
            </p>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {PRIVACY_LEGEND.map((item) => (
                <article key={item.layer} className="nm-card p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-nm-accent-soft">
                    {item.layer.replace("_", "-")}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-nm-muted">{item.summary}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Who it is for</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {AUDIENCE.map((a) => (
                <article key={a.title} className="rounded-2xl border border-nm-border bg-black/20 p-5">
                  <h3 className="font-semibold">{a.title}</h3>
                  <p className="mt-2 text-sm text-nm-muted">{a.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-nm-border bg-nm-elevated/30 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Why Night Messenger — not just Signal or Telegram
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-nm-muted">
              Great E2EE apps already exist. We add Midnight-native identity and selective proofs.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {WHY_NOT_SIGNAL.map((w) => (
                <article key={w.title} className="nm-card p-5">
                  <h3 className="font-semibold">{w.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-nm-muted">{w.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="nm-card flex flex-col items-start justify-between gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
              <div>
                <h2 className="text-xl font-semibold">Trust by default</h2>
                <p className="mt-2 max-w-xl text-sm text-nm-muted">
                  Open source. No dark patterns. No paywalls. Contract stubs are labeled honestly in the UI.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/security" className="nm-btn nm-btn-ghost">Trust &amp; security</Link>
                <a href={PRODUCT.repoUrl} target="_blank" rel="noreferrer" className="nm-btn nm-btn-primary">View on GitHub</a>
              </div>
            </div>
            <div className="mt-10">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-nm-muted">Roadmap</h3>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {ROADMAP.map((r) => (
                  <li key={r} className="flex gap-2 text-sm text-nm-text">
                    <span className="text-nm-accent-soft">→</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-nm-border py-8 text-center text-xs text-nm-muted">
        <p>
          <span className="mr-1.5 font-serif text-nm-accent-soft">{PRODUCT.brandMark}</span>
          {PRODUCT.name} · Free forever ·{" "}
          <a className="text-nm-accent-soft hover:underline" href={PRODUCT.repoUrl}>
            Kshot3000/Night-Messenger-
          </a>
        </p>
      </footer>
    </div>
  );
}
