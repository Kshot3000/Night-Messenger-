"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ONBOARDING_STEPS, PRIVACY_LEGEND, PRODUCT } from "@midnight-messenger/shared";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { getDisplayName, setDisplayName, setOnboarded, isOnboarded } from "@/lib/storage";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [walletOk, setWalletOk] = useState(false);

  useEffect(() => {
    const existing = getDisplayName();
    if (existing) setName(existing);
    if (isOnboarded()) {
      // allow re-running onboarding
    }
  }, []);

  const steps = ONBOARDING_STEPS;

  return (
    <div className="nm-aurora flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-lg items-center justify-between px-4 py-5">
        <Link href="/" className="text-sm font-semibold text-nm-text">
          ← {PRODUCT.name}
        </Link>
        <span className="text-xs text-nm-muted">
          Step {step + 1} of {steps.length}
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-10">
        <div className="mb-6 flex gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? "bg-nm-accent" : "bg-nm-border"}`}
            />
          ))}
        </div>

        <div className="nm-card flex flex-1 flex-col p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-nm-accent-soft">
            {steps[step].id}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{steps[step].title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-nm-muted">{steps[step].body}</p>

          <div className="mt-8 flex-1">
            {step === 0 && (
              <div className="space-y-4">
                <ConnectWalletButton
                  onConnected={() => setWalletOk(true)}
                />
                <button
                  type="button"
                  className="text-sm text-nm-muted underline-offset-2 hover:text-nm-accent-soft hover:underline"
                  onClick={() => setWalletOk(true)}
                >
                  Skip for now — explore with mock chats
                </button>
                {walletOk ? (
                  <p className="text-sm text-nm-success">Ready — continue when you like.</p>
                ) : null}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3">
                <label htmlFor="display-name" className="text-sm font-medium">
                  Display name
                </label>
                <input
                  id="display-name"
                  className="nm-input"
                  placeholder="e.g. Kshot"
                  maxLength={32}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-nm-muted">
                  Stored locally on this device. Not published on-chain by default.
                </p>
              </div>
            )}

            {step === 2 && (
              <ul className="space-y-3">
                {PRIVACY_LEGEND.map((item) => (
                  <li key={item.layer} className="rounded-xl border border-nm-border bg-black/25 p-4">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-nm-muted">{item.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-8 flex gap-3">
            {step > 0 ? (
              <button type="button" className="nm-btn nm-btn-ghost flex-1" onClick={() => setStep((s) => s - 1)}>
                Back
              </button>
            ) : null}
            <button
              type="button"
              className="nm-btn nm-btn-primary flex-1"
              disabled={step === 0 && !walletOk}
              onClick={() => {
                if (step === 1) {
                  if (!name.trim()) return;
                  setDisplayName(name);
                }
                if (step >= steps.length - 1) {
                  setOnboarded();
                  router.push("/app");
                  return;
                }
                setStep((s) => s + 1);
              }}
            >
              {step >= steps.length - 1 ? "Open Night Messenger" : "Continue"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
