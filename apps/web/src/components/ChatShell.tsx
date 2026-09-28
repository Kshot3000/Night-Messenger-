"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Conversation } from "@midnight-messenger/shared";
import { PRODUCT, createStubMessengerApi } from "@midnight-messenger/shared";
import { ConversationList } from "./ConversationList";
import { ChatThread } from "./ChatThread";
import { ConnectWalletButton } from "./ConnectWalletButton";
import { getDisplayName } from "@/lib/storage";

const api = createStubMessengerApi();

export function ChatShell() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const [displayName, setDisplayNameState] = useState<string | null>(null);

  useEffect(() => {
    api.listConversations().then(setConversations);
    setDisplayNameState(getDisplayName());
  }, []);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <div className="nm-aurora flex h-[100dvh] flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-nm-border bg-nm-elevated/90 px-3 backdrop-blur sm:px-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2" aria-label="Night Messenger home">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-nm-accent to-nm-accent-deep text-sm text-white">☾</span>
            <span className="hidden text-sm font-semibold sm:inline">{PRODUCT.shortName}</span>
          </Link>
          {displayName ? (
            <span className="rounded-full border border-nm-border px-2.5 py-0.5 text-[11px] text-nm-muted">
              You · {displayName}
            </span>
          ) : (
            <Link href="/onboarding" className="text-[11px] text-nm-accent-soft hover:underline">
              Set display name
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/security" className="hidden text-xs text-nm-muted hover:text-nm-text sm:inline">
            Trust
          </Link>
          <ConnectWalletButton />
        </div>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 overflow-hidden p-0 sm:p-3">
        <div className="nm-glass flex min-h-0 w-full overflow-hidden sm:rounded-2xl">
          <aside
            className={`w-full shrink-0 border-r border-nm-border bg-nm-elevated/50 md:w-[340px] lg:w-[380px] ${
              mobileShowThread ? "hidden md:flex md:flex-col" : "flex flex-col"
            }`}
          >
            <div className="flex items-center justify-between px-4 pt-4">
              <h1 className="text-xl font-semibold tracking-tight">Chats</h1>
              <button
                type="button"
                className="rounded-full border border-nm-border px-3 py-1 text-xs text-nm-accent-soft opacity-60"
                title="New chat — coming soon"
                disabled
              >
                New
              </button>
            </div>
            <ConversationList
              conversations={conversations}
              activeId={activeId}
              search={search}
              onSearch={setSearch}
              onSelect={(id) => {
                setActiveId(id);
                setMobileShowThread(true);
              }}
            />
          </aside>
          <main
            className={`min-w-0 flex-1 bg-nm-bg/40 ${
              mobileShowThread ? "flex flex-col" : "hidden md:flex md:flex-col"
            }`}
          >
            <ChatThread
              conversation={active}
              onBack={() => setMobileShowThread(false)}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
