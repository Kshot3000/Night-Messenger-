"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/Brand";
import { Icon } from "@/components/Icon";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { getDisplayName, setDisplayName, setOnboarded } from "@/lib/storage";
import { SakuraPetals } from "@/components/SakuraPetals";
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  useEffect(() => setName(getDisplayName() || ""), []);
  function next() {
    if (step === 0) {
      if (!name.trim()) {
        setError("A display name helps make this space yours.");
        return;
      }
      if (!setDisplayName(name))
        setError(
          "Your browser cannot save this name. You can still explore this session.",
        );
      else setError("");
    }
    setStep((s) => s + 1);
  }
  return (
    <div className="onboarding-page nm-aurora">
      <SakuraPetals count={14} />
      <header className="onboarding-header container">
        <Brand />
        <Link className="text-link" href="/app">
          Skip to the preview <Icon name="arrowUp" size={15} />
        </Link>
      </header>
      <main id="main-content" className="onboarding-main container">
        <aside className="onboarding-story">
          <p className="eyebrow">
            <span className="status-dot" /> COME AS YOU ARE
          </p>
          <h1>
            A little space.
            <br />
            <span>All your own.</span>
          </h1>
          <p>
            Good conversations start with feeling at home.
            <br />
            Let’s make this corner yours.
          </p>
          <div className="onboarding-moon" aria-hidden="true">
            <span>
              <Icon name="moon" size={60} />
            </span>
            <i />
          </div>
          <div className="onboarding-note">
            <Icon name="moon" size={20} />
            <span>
              No phone number. No inbox to verify.
              <br />
              <strong>Just a name, and you’re here.</strong>
            </span>
          </div>
        </aside>
        <div className="onboarding-card">
          <div
            className="onboarding-progress"
            aria-label={`Step ${step + 1} of 3`}
          >
            {["Your space", "Your wallet", "You’re home"].map((label, i) => (
              <div key={label} className={i <= step ? "current" : ""}>
                <span>
                  {i < step ? <Icon name="check" size={11} /> : `0${i + 1}`}
                </span>
                {label}
              </div>
            ))}
          </div>
          <div className="onboarding-content" key={step}>
            <span className="step-icon">
              <Icon
                name={step === 0 ? "chat" : step === 1 ? "wallet" : "moon"}
                size={26}
              />
            </span>
            <p className="eyebrow">STEP 0{step + 1}</p>
            <h2>
              {step === 0
                ? "What should we call you?"
                : step === 1
                  ? "A wallet, if you want."
                  : "Make yourself at home."}
            </h2>
            <p>
              {step === 0
                ? "A name for this little corner. Keep it simple. Keep it you."
                : step === 1
                  ? "Explore a Midnight wallet connection, or jump straight into the conversation."
                  : "One thing to know before you step inside: this is a local product preview."}
            </p>
            {step === 0 && (
              <form
                id="onboarding-name-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  next();
                }}
              >
                <label className="field-label" htmlFor="display-name">
                  Display name
                </label>
                <input
                  className="text-input"
                  id="display-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError("");
                  }}
                  maxLength={32}
                  autoFocus
                  autoComplete="nickname"
                  placeholder="Your name or a good alias"
                  required
                />
                <p className="field-help">
                  Saved only in this browser. Change it anytime.
                </p>
              </form>
            )}
            {step === 1 && (
              <div className="onboarding-wallet">
                <ConnectWalletButton />
                <span>No wallet? You’re already welcome here.</span>
              </div>
            )}
            {step === 2 && (
              <div className="onboarding-explainer">
                <div>
                  <Icon name="chat" size={18} />
                  <span>
                    <strong>A working space to explore</strong>
                    <small>Write, react, search, and create local chats.</small>
                  </span>
                </div>
                <div>
                  <Icon name="eye" size={18} />
                  <span>
                    <strong>Sample content, please</strong>
                    <small>
                      Demo messages are saved as readable data on this device.
                    </small>
                  </span>
                </div>
                <div>
                  <Icon name="moon" size={18} />
                  <span>
                    <strong>More on the horizon</strong>
                    <small>
                      Encryption, delivery, and Midnight proofs are planned.
                    </small>
                  </span>
                </div>
              </div>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="onboarding-buttons">
              {step > 0 && (
                <button
                  className="icon-button"
                  aria-label="Previous step"
                  onClick={() => setStep((s) => s - 1)}
                >
                  <Icon name="back" />
                </button>
              )}
              {step === 0 ? (
                <button
                  className="button button-accent"
                  type="submit"
                  form="onboarding-name-form"
                  disabled={!name.trim()}
                >
                  Continue <Icon name="arrow" size={18} />
                </button>
              ) : (
                <button
                  className="button button-accent"
                  onClick={() => {
                    if (step === 2) {
                      setOnboarded();
                      router.push("/app");
                    } else next();
                  }}
                >
                  {step === 2 ? "Step inside" : "Continue to preview"}{" "}
                  <Icon name="arrow" size={18} />
                </button>
              )}
            </div>
          </div>
          <p className="onboarding-bottom">
            Free & open source <span>·</span>{" "}
            <Link href="/security">
              Built on transparency <Icon name="arrowUp" size={12} />
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
