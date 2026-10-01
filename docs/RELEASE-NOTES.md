# Night Messenger 0.2 — web experience update

## Design

- Expanded design system on the monochrome ninja / sakura identity (夜 seal, white petals), locally bundled Geist typography, and refreshed social preview.
- Responsive landing page, interactive messenger preview, product tour, FAQ, and clear privacy information.
- Full-height messenger with conversation sidebar, app navigation, thoughtful empty states, mobile inbox/thread navigation, and accessible dialogs.
- Improved onboarding and wallet chooser; larger, readable message text and mobile controls.

## Functionality

- Persistent local conversations, drafts, message history, reactions, pins, archives, and profile/preferences.
- Cross-conversation and in-thread search, unread filters, emoji, and Ctrl/Cmd+K.
- Editing/deleting your own messages and deleting a conversation, with deletion confirmation.
- Single-conversation exports and full workspace backups, validated restore, and reset confirmation.
- Corrupt storage protection and visible storage failure/recovery messages.
- Provider-specific Midnight v4 wallet connection, address validation, timeout/rejection handling, and a shared session across pages.

## Build and deployment

- Next.js 15.5.27 and React 19.3.0; reproducible pnpm lockfile and locally packaged fonts.
- React type isolation for the existing Expo React 18 starter.
- Web checks workflow: regression tests, TypeScript, lint, and GitHub Pages export.
- Portable Pages build command and a deployment script that preserves gh-pages history.

## Verification

- 10 automated state/backup/wallet regression tests passed.
- Web/shared TypeScript checks, ESLint, and production static build passed.
- Chromium browser checks passed for onboarding, new chats, draft reloads, sending, editing, deletion, reactions, search, pinning, export, archive/restore, backup/reset/restore, missing wallets, dialog Escape, and corrupted storage.
- All four routes checked for horizontal overflow at 360, 390, 768, 1024, and 1440px.
- Automated accessibility review of the four main routes; corrected the search keyboard-hint contrast finding.

## Current boundaries

This release is a local browser demo. It does not provide end-to-end encryption, communication with another person, cross-device/tab synchronization, or live Midnight commitments/proofs. Wallet tests use controlled provider fixtures; an installed live extension was not available for an end-to-end wallet test. The Android starter and contracts were preserved, not deployed or validated as production systems.
