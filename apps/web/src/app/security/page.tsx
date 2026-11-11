import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Icon } from "@/components/Icon";
import { SakuraPetals } from "@/components/SakuraPetals";
export const metadata: Metadata = {
  title: "Privacy & transparency",
  description:
    "What works today, what stays on your device, and the privacy vision behind Night Messenger.",
};
export default function SecurityPage() {
  return (
    <div className="security-page nm-aurora">
      <SakuraPetals count={14} />
      <SiteHeader />
      <main id="main-content" className="security-page container">
        <div className="security-hero">
          <p className="eyebrow">
            <span className="status-dot" /> BUILT ON TRANSPARENCY
          </p>
          <h1>
            Trust starts with
            <br />
            <span>the whole picture.</span>
          </h1>
          <p>
            A thoughtful messenger should be honest about where it stands.
            <br />
            Here’s what Night Messenger does today — and where we’re headed.
          </p>
        </div>
        <div className="security-callout">
          <Icon name="info" size={24} />
          <div>
            <strong>Two modes, stated plainly.</strong>
            <p>
              Private chat (/private) encrypts end to end and delivers through
              a ciphertext-only relay; commitments and receipts go to a local
              chain simulator that runs the real contract, until the Midnight
              Preprod deployment lands. The sample app (/app) is a local
              preview with readable demo data. Testnet only, not audited.
            </p>
          </div>
        </div>
        <section className="security-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">WHERE THINGS STAND</p>
              <h2>
                Real features.
                <br />
                <span>A clear roadmap.</span>
              </h2>
            </div>
          </div>
          <div className="readiness-grid">
            <article>
              <span className="readiness-badge ready">
                <Icon name="check" size={13} /> WORKING TODAY
              </span>
              <h3>A place to try things out.</h3>
              <ul>
                <li>Local conversations and saved message history</li>
                <li>Search, drafts, pinning, archiving, and reactions</li>
                <li>
                  Editing, deletion, backup/restore, and conversation export
                </li>
                <li>Mobile layouts and keyboard navigation</li>
                <li>Optional compatible-wallet connection on preprod</li>
              </ul>
            </article>
            <article>
              <span className="readiness-badge">
                <Icon name="moon" size={13} /> STILL AHEAD
              </span>
              <h3>The privacy layer.</h3>
              <ul>
                <li>Live communication between people and devices</li>
                <li>End-to-end encryption and key management</li>
                <li>Encrypted message relay and delivery receipts</li>
                <li>Live Midnight contracts and selective disclosure</li>
                <li>Identity verification and security review</li>
              </ul>
            </article>
          </div>
        </section>
        <section className="security-section">
          <p className="eyebrow">THE DIRECTION WE’RE BUILDING TOWARD</p>
          <h2>
            Share a fact.
            <br />
            <span>Keep the conversation.</span>
          </h2>
          <div className="privacy-model">
            {[
              {
                icon: "lock" as const,
                title: "Private content",
                body: "Working in Private chat: X25519 + HKDF + AES-256-GCM in the browser (WebCrypto). Keys are made on your device and sealed at rest with a non-extractable device key. Not audited.",
              },
              {
                icon: "shield" as const,
                title: "Optional commitments",
                body: "Working: each message posts only a 32-byte SHA-256 commitment of its ciphertext, with a ZK proof that a member sent it. Runs on a local chain simulator with real proofs; Preprod next.",
              },
              {
                icon: "eye" as const,
                title: "Selective disclosure",
                body: "Working: anonymous delivery receipts anyone can count at /verify, and an opt-in bundle that proves who wrote one message without opening any other.",
              },
            ].map((item) => (
              <article key={item.title}>
                <Icon name={item.icon} size={25} />
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="security-section data-section">
          <div>
            <p className="eyebrow">YOUR DEMO DATA</p>
            <h2>
              On your device.
              <br />
              <span>Under your control.</span>
            </h2>
          </div>
          <div>
            <h3>What’s stored?</h3>
            <p>
              Display name, conversations, messages, reactions, drafts, and
              display preferences are saved in this browser’s local storage. Any
              person or script with access to that browser storage can read
              them.
            </p>
            <h3>How do I remove it?</h3>
            <p>
              Use Settings → Reset demo data to replace your conversations with
              the samples. Clear this site’s browser data to also remove your
              profile and preferences. Exported JSON files are separate copies
              and must be deleted separately.
            </p>
            <h3>What does connecting a wallet change?</h3>
            <p>
              The app can ask a compatible Midnight wallet for a preprod
              connection and display its returned address. It does not request
              transactions or enable real messaging. The app session is kept in
              memory; manage persistent site permissions in your wallet.
            </p>
          </div>
        </section>
        <section className="source-callout">
          <div>
            <Icon name="code" size={24} />
            <h2>Nothing behind the curtain.</h2>
            <p>
              Inspect the code, follow the work, or help shape what comes next.
            </p>
          </div>
          <a
            className="button button-accent"
            href="https://github.com/Kshot3000/Night-Messenger-"
            target="_blank"
            rel="noreferrer"
          >
            Explore the source <Icon name="arrowUp" size={18} />
          </a>
        </section>
        <Link href="/app" className="text-link security-return">
          Back to your little corner <Icon name="arrow" size={17} />
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
