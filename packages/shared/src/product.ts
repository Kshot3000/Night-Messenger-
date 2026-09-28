/** Product positioning & onboarding — Night Messenger (100% free & open source) */

export const PRODUCT = {
  name: 'Night Messenger',
  shortName: 'Night Chat',
  legalName: 'Night Messenger',
  tagline: 'Private messaging on Midnight — with selective disclosure',
  oneLiner:
    '1:1 DMs where plaintext stays encrypted, existence can be proven on-chain, and you choose what to disclose.',
  repoUrl: 'https://github.com/Kshot3000/Night-Messenger-',
  twitter: '@kshot9000',
  freeAndOpen: true as const,
  theme: {
    bg: '#07070f',
    bgElevated: '#0e0e1a',
    bgGlass: 'rgba(14, 14, 26, 0.72)',
    accent: '#8b6cff',
    accentDeep: '#5b3fd4',
    accentSoft: '#c4b5fd',
    indigo: '#4338ca',
    violet: '#7c3aed',
    text: '#eceaf6',
    muted: '#9b97b0',
    border: 'rgba(139, 108, 255, 0.18)',
    success: '#34d399',
    warning: '#fbbf24',
  },
} as const;

export const AUDIENCE = [
  {
    title: 'Builders on Midnight',
    body: 'Ship private UX that can still prove facts on-chain — without leaking message bodies.',
  },
  {
    title: 'Privacy-first communities',
    body: 'Keep DMs sealed. Disclose delivery or membership only when a policy or dispute needs it.',
  },
  {
    title: 'On-chain identity users',
    body: 'Tie conversations to shielded Midnight identity — stronger than phone-number messengers, without a public profile dump.',
  },
];

export const WHY_NOT_SIGNAL = [
  {
    title: 'On-chain identity, optional proof',
    body: 'Signal & Telegram excel at E2EE. Night Messenger adds Midnight-native commitments and selective ZK proofs for existence, delivery, and attributes — without opening content.',
  },
  {
    title: 'Selective disclosure by design',
    body: 'Prove “I sent this” or “they received it” to a counterparty, auditor, or contract — plaintext never leaves the E2EE envelope.',
  },
  {
    title: 'Free, open source & wallet-native',
    body: 'Connect Lace. No phone number required for the MVP path. Inspect the repo; no dark patterns, no paywalls.',
  },
];

export const ONBOARDING_STEPS = [
  {
    id: 'wallet',
    title: 'Connect Lace',
    body: 'Enumerate Midnight wallets on this device. We never hardcode mnLace.',
  },
  {
    id: 'profile',
    title: 'Choose a display name',
    body: 'Local label only — not published on-chain by default.',
  },
  {
    id: 'learn',
    title: 'Learn selective privacy',
    body: 'Encrypted body · optional commitment · disclose proofs only when you choose.',
  },
] as const;

export const ROADMAP = [
  'Real Compact circuits for commit + selective disclosure',
  'E2EE key agreement + encrypted relay',
  'Groups & media (after 1:1 is solid)',
  'Mobile Lace deep-link / WalletConnect-style flow when available',
] as const;
