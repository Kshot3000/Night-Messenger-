import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MessengerPreview } from "@/components/MessengerPreview";
import { Icon } from "@/components/Icon";
import { SakuraPetals } from "@/components/SakuraPetals";

const faqs = [
  [
    "Can I try it without a wallet?",
    "Absolutely. Open the app to explore sample conversations, write messages, and create local chats. You can add a display name or try connecting a compatible Midnight wallet whenever you like.",
  ],
  [
    "Are my messages encrypted or sent to other people?",
    "Not in this preview. Conversations, drafts, and preferences are saved in this browser as readable local data. Messages are not delivered to another person. End-to-end encryption, a message relay, and live Midnight proofs are planned. Please use sample content only.",
  ],
  [
    "What is selective disclosure?",
    "It is the idea of proving a specific fact, such as delivery, without revealing the contents of a conversation. Night Messenger explores this approach for Midnight. The proof and contract integrations are still in development.",
  ],
  [
    "What happens to my demo conversations?",
    "They stay in this browser until you clear the app's local data or your browser storage. You can export a conversation as JSON from its details panel. Demo data does not sync across devices.",
  ],
  [
    "Is Night Messenger open source?",
    "Yes. The web app, Android starter, shared types, and contract interfaces are available on GitHub under the MIT license. You can inspect the code, suggest improvements, or build on it.",
  ],
];
export default function LandingPage() {
  return (
    <div className="landing nm-aurora">
      <SakuraPetals count={20} />
      <SiteHeader />
      <main id="main-content">
        <section className="hero container">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="status-dot" /> MESSAGING, WITH A DIFFERENT
              MINDSET <span className="eyebrow-line" />
            </div>
            <h1>
              Your words.
              <br />
              <span>Not the world’s.</span>
            </h1>
            <p className="hero-description">
              For the late-night ideas. The inside jokes. The conversations that
              are just between you.
            </p>
            <p className="hero-secondary">
              A calmer messaging experience, built for the Midnight ecosystem.
            </p>
            <div className="hero-actions">
              <Link href="/app" className="button button-accent">
                Find your quiet <Icon name="arrowUp" size={19} />
              </Link>
              <Link href="#experience" className="text-link">
                Take a look around <Icon name="arrow" size={17} />
              </Link>
            </div>
            <div className="hero-footnote">
              <span className="tiny-circle">
                <Icon name="check" size={10} />
              </span>{" "}
              Free to explore <span>·</span> No wallet required{" "}
              <span className="preview-pill">Public preview</span>
            </div>
          </div>
          <MessengerPreview />
          <div className="hero-bottom">
            <span>01 — A NEW KIND OF CONVERSATION</span>
            <span>
              SCROLL TO EXPLORE <span>↓</span>
            </span>
          </div>
        </section>
        <section
          className="principles container"
          aria-label="Product principles"
        >
          <span>
            Less to give up.
            <br />
            <strong>More to say.</strong>
          </span>
          <div>
            <Icon name="chat" /> No phone number
          </div>
          <div>
            <Icon name="code" /> Always open source
          </div>
          <div>
            <Icon name="moon" /> Made for Midnight
          </div>
          <div>
            <Icon name="sparkle" /> Yours to explore
          </div>
        </section>
        <section className="experience container section-space" id="experience">
          <div className="section-heading">
            <div>
              <p className="eyebrow">LESS NOISE. MORE CONNECTION.</p>
              <h2>
                Good conversation.
                <br />
                <span>Room to breathe.</span>
              </h2>
            </div>
            <p>
              No feeds to keep up with. No audience to perform for.
              <br />
              Just a thoughtful space for one-to-one conversations.
            </p>
          </div>
          <div className="feature-grid">
            <article className="feature-card feature-large">
              <div className="feature-top">
                <span className="feature-icon">
                  <Icon name="chat" />
                </span>
                <span className="tiny-label">01 / THE EXPERIENCE</span>
              </div>
              <h3>
                Feels familiar.
                <br />
                Feels like yours.
              </h3>
              <p>
                Pick up where you left off. Keep a draft, pin a conversation,
                find a message, or leave a little reaction.
              </p>
              <div className="feature-chat-art" aria-hidden="true">
                <div className="art-message">A place to just be ourselves.</div>
                <div className="art-message art-mine">
                  That’s the whole idea. <span>↗</span>
                </div>
                <span className="art-reaction">♡ &nbsp; 1</span>
              </div>
              <Link href="/app" className="text-link">
                Explore the messenger <Icon name="arrow" size={16} />
              </Link>
            </article>
            <article className="feature-card">
              <div className="feature-top">
                <span className="feature-icon">
                  <Icon name="eye" />
                </span>
                <span className="feature-tag">THE VISION</span>
              </div>
              <div className="privacy-art" aria-hidden="true">
                <div className="privacy-ring">
                  <Icon name="eye" size={28} />
                </div>
                <span>YOU DECIDE WHAT TO SHARE</span>
              </div>
              <h3>Privacy, on your terms.</h3>
              <p>
                A vision for selective disclosure: prove a fact without opening
                the whole conversation.
              </p>
              <Link href="/security" className="text-link">
                Meet the privacy model <Icon name="arrow" size={16} />
              </Link>
            </article>
            <article className="feature-card">
              <div className="feature-top">
                <span className="feature-icon">
                  <Icon name="code" />
                </span>
                <span className="tiny-label">BUILT IN THE OPEN</span>
              </div>
              <div className="open-art" aria-hidden="true">
                <span>
                  <Icon name="moon" size={22} />
                </span>
                <span className="code-bracket">{"{ }"}</span>
                <span>☾</span>
              </div>
              <h3>No black boxes.</h3>
              <p>
                Free to use. Open to inspect. Follow the work, shape what comes
                next, or make it your own.
              </p>
              <a
                href="https://github.com/Kshot3000/Night-Messenger-"
                target="_blank"
                rel="noreferrer"
                className="text-link"
              >
                Go behind the scenes <Icon name="arrowUp" size={16} />
              </a>
            </article>
          </div>
        </section>
        <section className="how-section section-space" id="how-it-works">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="eyebrow">MAKE YOURSELF AT HOME</p>
                <h2>
                  A few clicks.
                  <br />
                  <span>A little more you.</span>
                </h2>
              </div>
              <Link href="/onboarding" className="button button-outline">
                Set up your space <Icon name="arrow" size={17} />
              </Link>
            </div>
            <div className="steps-grid">
              {[
                {
                  title: "Come as you are.",
                  body: "Choose a display name. There’s no phone number or email form standing in your way.",
                  icon: "moon" as const,
                },
                {
                  title: "Find your people.",
                  body: "Explore sample chats or create a new local conversation. Pin your favorites and settle in.",
                  icon: "chat" as const,
                },
                {
                  title: "Make it a conversation.",
                  body: "Write, react, search, and pick up where you left off. Your demo stays on this device.",
                  icon: "sparkle" as const,
                },
              ].map((step, i) => (
                <article key={step.title}>
                  <div className="step-number">
                    0{i + 1}
                    <Icon name={step.icon} size={23} />
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </article>
              ))}
            </div>
            <div className="honesty-note">
              <Icon name="info" size={18} />
              <p>
                <strong>A preview with a purpose.</strong> This is a working
                local demo. Encrypted delivery and live Midnight proofs are
                still ahead.
              </p>
              <Link href="/security">
                See what’s ready <Icon name="arrowUp" size={14} />
              </Link>
            </div>
          </div>
        </section>
        <section className="faq-section container section-space">
          <div>
            <p className="eyebrow">A LITTLE CLARITY</p>
            <h2>
              Good questions.
              <br />
              <span>Straight answers.</span>
            </h2>
            <p>Trust starts with knowing where things stand.</p>
          </div>
          <div className="faq-list">
            {faqs.map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <Icon name="plus" size={18} />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="closing-section container">
          <div className="closing-moon" aria-hidden="true" />
          <p className="eyebrow">THE INTERNET CAN BE A QUIETER PLACE.</p>
          <h2>
            Let’s keep it
            <br />
            <span>between us.</span>
          </h2>
          <Link href="/app" className="button button-accent">
            Step inside <Icon name="arrowUp" size={18} />
          </Link>
          <p className="closing-caption">
            Your next good conversation starts here.
            <br />
            <span>Explore the local preview · Free & open source</span>
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
