"use client";
import type { LocalConversation } from "@/lib/messenger-store";
import { lastActivity } from "@/lib/messenger-store";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { formatListTimestamp } from "@/lib/format";
export function ConversationList({
  conversations,
  activeId,
  onSelect,
  search,
  onSearch,
  onCreate,
  filter,
  onFilter,
  unreadCount,
}: {
  conversations: LocalConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearch: (query: string) => void;
  onCreate: () => void;
  filter: "all" | "unread" | "archived";
  onFilter: (filter: "all" | "unread" | "archived") => void;
  unreadCount: number;
}) {
  return (
    <>
      <div className="list-heading">
        <div>
          <p className="eyebrow">YOUR LITTLE CORNER</p>
          <h1>
            {filter === "archived" ? "Archived" : "Messages"}
            <span>{conversations.length}</span>
          </h1>
        </div>
        <button
          className="new-chat-button"
          aria-label="New conversation"
          title="New conversation"
          onClick={onCreate}
        >
          <Icon name="plus" size={20} />
        </button>
      </div>
      <div className="search-field">
        <Icon name="search" size={16} />
        <input
          id="conversation-search"
          type="search"
          aria-label="Search conversations and messages"
          placeholder="Search your conversations"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          autoComplete="off"
        />
        <span className="key-hint">⌘ K</span>
      </div>
      <div className="list-tabs" role="group" aria-label="Filter conversations">
        {(["all", "unread", "archived"] as const).map((tab) => (
          <button
            key={tab}
            aria-pressed={filter === tab}
            className={filter === tab ? "selected" : ""}
            onClick={() => onFilter(tab)}
          >
            {tab === "all"
              ? "All chats"
              : tab === "unread"
                ? "Unread"
                : "Archived"}
            {tab === "unread" && unreadCount > 0 && <span>{unreadCount}</span>}
          </button>
        ))}
      </div>
      <div className="conversation-scroll">
        <p className="list-section">
          {search
            ? "SEARCH RESULTS"
            : filter === "archived"
              ? "SAVED FOR LATER"
              : "CONVERSATIONS"}
        </p>
        {conversations.length === 0 ? (
          <div className="list-empty">
            <Icon name={search ? "search" : "chat"} size={26} />
            <h2>
              {search
                ? "Nothing here just yet."
                : filter === "unread"
                  ? "All caught up."
                  : "A little room to talk."}
            </h2>
            <p>
              {search
                ? "Try a different name or a word from a message."
                : filter === "unread"
                  ? "Your conversations are waiting when you need them."
                  : "Start a local conversation to make this space yours."}
            </p>
            {search || filter !== "all" ? (
              <button
                className="text-link"
                onClick={() => {
                  onSearch("");
                  onFilter("all");
                }}
              >
                Show all chats <Icon name="arrow" size={14} />
              </button>
            ) : (
              <button className="text-link" onClick={onCreate}>
                Start a conversation <Icon name="plus" size={14} />
              </button>
            )}
          </div>
        ) : (
          <ul className="conversation-list" aria-label="Conversations">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => onSelect(c.id)}
                  className={`conversation-item ${c.id === activeId ? "selected" : ""}`}
                  aria-current={c.id === activeId ? "true" : undefined}
                  aria-label={`${c.name}${c.unread ? `, ${c.unread} unread messages` : ""}`}
                >
                  <Avatar name={c.name} hue={c.hue} size={43} />
                  <span className="conversation-copy">
                    <span className="conversation-topline">
                      <strong>{c.name}</strong>
                      <time dateTime={lastActivity(c)}>
                        {formatListTimestamp(lastActivity(c))}
                      </time>
                    </span>
                    <span className="conversation-bottomline">
                      <span>
                        {c.draft ? (
                          <>
                            <em>Draft: </em>
                            {c.draft}
                          </>
                        ) : (
                          (c.messages.at(-1)?.body ?? "Start with a hello.")
                        )}
                      </span>
                      {c.unread > 0 ? (
                        <span className="unread-count">{c.unread}</span>
                      ) : c.pinned ? (
                        <Icon name="pin" size={12} />
                      ) : null}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
