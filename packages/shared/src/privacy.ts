import type { PrivacyLegendItem } from './types';

export { PRODUCT } from './product';

export const PRIVACY_LEGEND: PrivacyLegendItem[] = [
  {
    layer: 'on_chain',
    title: 'On-chain / proven',
    summary:
      'Message existence commitments and optional sender/recipient proofs. Metadata only when you choose to reveal it.',
  },
  {
    layer: 'off_chain',
    title: 'Off-chain / encrypted',
    summary:
      'Message plaintext stays E2EE between parties. Relays see ciphertext — only recipients decrypt.',
  },
  {
    layer: 'selective',
    title: 'Selective disclosure',
    summary:
      'Prove delivery, membership, or attributes without opening content. Disclosure is always intentional.',
  },
];
