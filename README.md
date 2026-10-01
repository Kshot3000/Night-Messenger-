# Night Messenger

**Your words. Not the world’s.** A calm, open-source messaging preview for the Midnight ecosystem.

Monochrome ninja UI (black / white / soft gray) with 夜 seal mark and subtle white sakura petals — free forever.

[Open the website](https://kshot3000.github.io/Night-Messenger-/) · [Privacy model](packages/shared/PRIVACY.md)

![Night Messenger landing page](docs/screenshots/landing.png)

## What works

- Responsive landing page with an interactive messenger preview, product tour, and FAQ.
- Full desktop messenger and mobile inbox-to-conversation navigation.
- Local conversations and message history, per-chat drafts, emoji, and reactions.
- Search across conversations or within a thread; unread filtering, pinning, and archiving.
- Edit/delete your own messages, delete a conversation with confirmation, or export it to JSON.
- Full workspace backup/restore with file validation and replacement confirmation.
- Profile onboarding, optional wallet selection, compact view, and sample-data reset.
- Accessible dialogs, visible keyboard focus, reduced motion, and Ctrl/Cmd+K search.
- Midnight DApp Connector v4 discovery and optional preprod connection, with rejection/timeout handling.

**This is a local product preview.** Messages are readable browser data, not encrypted or delivered to anyone. A connected wallet does not enable live chat. End-to-end encryption, a relay, device synchronization, and Midnight proofs are future work. Please use sample content only. There are no fake delivery receipts or generated replies.

## Run the website

Use **Node.js 24 LTS** (minimum 22.18) and **pnpm 11.25.0**.

```bash
npm install -g pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000`. Fonts are bundled locally; builds do not fetch Google Fonts.

| Route | Experience |
| --- | --- |
| `/` | Landing page and interactive preview |
| `/onboarding/` | Display name, optional wallet, preview explanation |
| `/app/` | Working local messenger |
| `/security/` | Current capabilities, data handling, and privacy roadmap |

```bash
pnpm test           # State, backup validation, and wallet regression tests
pnpm typecheck      # Web and shared packages
pnpm lint           # Web source
pnpm build:web      # Static export for a root-domain host
pnpm build:pages    # Static export with /Night-Messenger- base path
```

The export is written to `apps/web/out/`. Serve it over HTTP, not by opening HTML files directly. To preview a root-domain build: `python -m http.server 3000 --directory apps/web/out`.

## GitHub Pages

The current website publishes from the **gh-pages branch, root folder**. The `Web checks` GitHub Actions workflow validates every main-branch push and pull request. To publish after the checks pass:

```bash
bash scripts/deploy-gh-pages.sh
```

This builds the Pages export and adds a normal commit to `gh-pages`; it does not force-push or replace branch history. Git write access is required. `NEXT_PUBLIC_SITE_URL` can override the canonical URL; change `repoBase` in `apps/web/next.config.ts` if moving to a differently named repository.

## Local data and backups

The web app stores its workspace under `night_messenger_workspace_v1`, plus display-name and compact-view preferences. Data stays in the current browser profile and origin. Storage failures are shown in the UI; unreadable saved data is preserved until you explicitly restore a backup or reset the demo. Backups and single-conversation exports contain readable content.

- **Settings → Back up chats:** export all conversations, drafts, reactions, and archive/pin state.
- **Settings → Restore backup:** validate a workspace backup, then confirm replacement.
- **Conversation details → Export:** export one conversation; this is not a workspace restore file.
- **Settings → Reset demo:** replace conversations with the samples. Profile/preferences remain.
- Clear the site's browser data to remove everything. Delete downloaded backups separately.

Multiple open tabs do not synchronize edits; use one tab per browser profile to avoid overwriting another tab's changes. A refresh opens the first pinned/recent conversation. A wallet session is in memory and is not persisted.

## Repository layout

| Folder | Purpose |
| --- | --- |
| `apps/web` | Next.js 15 / React 19 website and local messenger |
| `apps/mobile` | Original Expo / React Native Android starter (separate, not redesigned here) |
| `packages/shared` | Domain types, wallet helper, API stubs, privacy documentation |
| `contracts` | Unimplemented Compact interfaces; no deployed contracts |
| `scripts` | Portable Pages build and history-preserving deployment |

The mobile starter keeps React 18. A pnpm package extension isolates Next.js's React 19 types to avoid monorepo type conflicts. Run the Android starter with `pnpm dev:mobile`; mobile native builds are outside this web release's verification.

## Next milestones

1. Authenticated identity and device/session key management.
2. Reviewed end-to-end encryption and encrypted message transport.
3. Reliable delivery, multi-device sync, abuse prevention, and recovery.
4. Implemented/audited Midnight contracts and selective-disclosure proofs.

Built by [Kshot3000](https://github.com/Kshot3000) for the Midnight ecosystem. MIT license.
