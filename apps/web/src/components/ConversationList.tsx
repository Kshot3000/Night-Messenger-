"use client";

import type { Conversation } from "@midnight-messenger/shared";
import { Avatar } from "./Avatar";
import { formatRelativeTime } from "@/lib/format";

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  search,
  onSearch,
}: {
  conversations: Conversation[];
  activeId?: string;
  onSelect: (id: string) => void;
  search: string;
  onSearch: (q: string) => void;
}) {
  const filtered = conversations.filter((c) =>
    c.peer.displayName.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-nm-border px-4 pb-3 pt-4">
        <label className="sr-only" htmlFor="nm-search">
          Search conversations
        </label>
        <input
          id="nm-search"
          className="nm-input py-2.5 text-sm"
          placeholder="Search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          autoComplete="off"
        />
      </div>
      <ul className="nm-scrollbar flex-1 overflow-y-auto py-1" role="listbox" aria-label="Conversations">
        {filtered.length === 0 ? (
          <li className="px-5 py-10 text-center text-sm text-nm-muted">
            No chats match. Start a DM when you&apos;re ready.
          </li>
        ) : (
          filtered.map((c) => {
            const active = c.id === activeId;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => onSelect(c.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                    active ? "bg-nm-accent/15" : "hover:bg-nm-hover/70"
                  }`}
                >
                  <Avatar name={c.peer.displayName} hue={c.peer.avatarHue} online={c.unreadCount > 0} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[15px] font-semibold tracking-tight">
                        {c.peer.displayName}
                      </span>
                      <span className="shrink-0 text-[11px] text-nm-muted">
                        {formatRelativeTime(c.lastMessageAt)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <p className="truncate text-[13px] text-nm-muted">{c.lastMessagePreview}</p>
                      {c.hasCommitment ? (
                        <span className="shrink-0 text-[10px] text-nm-accent-soft" title="Has commitment">
                          ◆
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {c.unreadCount > 0 ? (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-nm-accent px-1.5 text-[11px] font-bold text-nm-on-accent">
                      {c.unreadCount}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
