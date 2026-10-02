/** Product positioning & onboarding — Night Messenger (100% free & open source) */

export const PRODUCT = {
  name: 'Night Messenger',
  shortName: 'Night Chat',
  legalName: 'Night Messenger',
  tagline: 'Private messaging on Midnight — with selective disclosure',
  oneLiner:
    '1:1 DMs designed for Midnight selective disclosure. Today this is a local preview — end-to-end encryption, on-chain commitments, and proofs are on the roadmap, not yet live.',
  repoUrl: 'https://github.com/Kshot3000/Night-Messenger-',
  twitter: '@kshot9000',
  freeAndOpen: true as const,
  brandMark: '夜',
  theme: {
    bg: '#050505',
    bgElevated: '#0a0a0a',
    bgGlass: 'rgba(10, 10, 10, 0.78)',
    accent: '#f5f5f5',
    accentDeep: '#d4d4d4',
    accentSoft: '#a3a3a3',
    ink: '#737373',
    text: '#fafafa',
    muted: '#8a8a8a',
    border: 'rgba(255, 255, 255, 0.12)',
    onAccent: '#0a0a0a',
    success: '#86efac',
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
    body: 'The goal: prove “I sent this” or “they received it” to a counterparty, auditor, or contract — without opening the conversation. Proof generation is not implemented yet.',
  },
  {
    title: 'Free, open source & wallet-native',
    body: 'Connect Lace. No phone number required for the MVP path. Inspect the repo; no dark patterns, no paywalls.',
  },
] as const;

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
