"use client";
import { useEffect, useRef, useState } from "react";
import type { Action, LocalConversation, Message } from "@/lib/messenger-store";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { ComposeBox } from "./ComposeBox";
import { Modal } from "./Modal";
import { MAX_BODY_LENGTH } from "@/lib/messenger-store";
export function ChatThread({
  conversation: c,
  onBack,
  dispatch,
  onDetails,
  detailsOpen,
  onCreate,
  compact,
}: {
  conversation: LocalConversation | null;
  onBack: () => void;
  dispatch: (action: Action) => void;
  onDetails: () => void;
  detailsOpen: boolean;
  onCreate: () => void;
  compact: boolean;
}) {
  const [editing, setEditing] = useState<Message | null>(null);
  const [editBody, setEditBody] = useState("");
  const [deleting, setDeleting] = useState<Message | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [reactionId, setReactionId] = useState<string | null>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [c?.id, c?.messages.length]);
  const messages =
    c?.messages.filter(
      (m) =>
        !query.trim() ||
        m.body.toLowerCase().includes(query.trim().toLowerCase()),
    ) ?? [];
  if (!c)
    return (
      <div className="chat-welcome">
        <span className="welcome-moon">
          <Icon name="moon" size={46} />
        </span>
        <p className="eyebrow">A LITTLE LESS PUBLIC. A LOT MORE YOU.</p>
        <h2>
          Good conversations
          <br />
          <span>start with a hello.</span>
        </h2>
        <p>
          Choose a chat or start a new one.
          <br />
          Make yourself at home.
        </p>
        <button className="button button-accent" onClick={onCreate}>
          New conversation <Icon name="plus" size={17} />
        </button>
        <small>Local preview · No messages leave this browser</small>
      </div>
    );
  return (
    <div className={`chat-thread ${compact ? "compact-messages" : ""}`}>
      <header className="thread-header">
        <button
          className="icon-button thread-back"
          onClick={onBack}
          aria-label="Back to conversations"
        >
          <Icon name="back" />
        </button>
        <Avatar name={c.name} hue={c.hue} size={42} />
        <div className="thread-person">
          <h2>{c.name}</h2>
          <p>
            <span className="status-dot" /> Local conversation
          </p>
        </div>
        <div className="thread-actions">
          <button
            className={`icon-button ${searchOpen ? "active" : ""}`}
            onClick={() => {
              setSearchOpen(!searchOpen);
              setQuery("");
            }}
            aria-label="Search this conversation"
            aria-expanded={searchOpen}
          >
            <Icon name="search" size={19} />
          </button>
          <button
            className={`icon-button ${detailsOpen ? "active" : ""}`}
            onClick={onDetails}
            aria-label="Conversation details"
            aria-expanded={detailsOpen}
          >
            <Icon name="info" size={20} />
          </button>
        </div>
      </header>
      {searchOpen && (
        <div className="thread-search">
          <Icon name="search" size={16} />
          <input
            type="search"
            aria-label="Search messages in this conversation"
            placeholder="Find something in this conversation…"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span>
            {messages.length} {messages.length === 1 ? "message" : "messages"}
          </span>
          <button
            className="icon-button"
            aria-label="Close message search"
            onClick={() => {
              setSearchOpen(false);
              setQuery("");
            }}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      <div className="message-scroll" onClick={() => setReactionId(null)}>
        <div className="conversation-intro">
          <span>
            <Icon name="moon" size={16} />
          </span>
          <p>A little space for you and {c.name}.</p>
          <small>Sample content only. This preview is not encrypted.</small>
        </div>
        <div
          className="messages"
          aria-label={`Messages with ${c.name}`}
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {messages.map((m, index) => {
            const previous = messages[index - 1];
            const newDay =
              !previous ||
              new Date(m.at).toDateString() !==
                new Date(previous.at).toDateString();
            const mine = m.author === "me";
            return (
              <div key={m.id}>
                {newDay && (
                  <div className="day-divider">
                    <span>
                      {new Date(m.at).toDateString() ===
                      new Date().toDateString()
                        ? "Today"
                        : new Date(m.at).toLocaleDateString(undefined, {
                            month: "long",
                            day: "numeric",
                          })}
                    </span>
                  </div>
                )}
                <div className={`message-row ${mine ? "mine" : "theirs"}`}>
                  {!mine && <Avatar name={c.name} hue={c.hue} size={28} />}
                  <div className="message-group">
                    <div className="message-bubble">{m.body}</div>
                    <div className="message-meta">
                      <time dateTime={m.at}>
                        {new Date(m.at).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </time>
                      {m.editedAt && (
                        <span
                          title={`Edited ${new Date(m.editedAt).toLocaleString()}`}
                        >
                          edited
                        </span>
                      )}
                      {mine && (
                        <span title="Saved locally, not delivered">
                          <Icon name="check" size={11} /> Local
                        </span>
                      )}
                      {m.reaction && (
                        <button
                          className="reaction-chip"
                          aria-label={`Remove ${m.reaction} reaction`}
                          onClick={() =>
                            dispatch({
                              type: "reaction",
                              id: c.id,
                              messageId: m.id,
                              emoji: m.reaction!,
                            })
                          }
                        >
                          {m.reaction} <span>1</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="message-tools">
                    {mine && (
                      <>
                        <button
                          className="icon-button"
                          aria-label={`Edit message ${index + 1}`}
                          onClick={() => {
                            setEditing(m);
                            setEditBody(m.body);
                          }}
                        >
                          <Icon name="edit" size={15} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Delete message ${index + 1}`}
                          onClick={() => setDeleting(m)}
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </>
                    )}
                    <button
                      className="icon-button"
                      aria-label={`React to message ${index + 1}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setReactionId(reactionId === m.id ? null : m.id);
                      }}
                      aria-expanded={reactionId === m.id}
                    >
                      <Icon name="smile" size={16} />
                    </button>
                    {reactionId === m.id && (
                      <div
                        className="reaction-picker"
                        role="group"
                        aria-label="Message reactions"
                      >
                        {["❤️", "👍", "✨", "😂"].map((emoji) => (
                          <button
                            key={emoji}
                            aria-label={`React ${emoji}`}
                            onClick={() =>
                              dispatch({
                                type: "reaction",
                                id: c.id,
                                messageId: m.id,
                                emoji,
                              })
                            }
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {messages.length === 0 && (
            <div className="thread-empty">
              <Icon name={query ? "search" : "chat"} size={28} />
              <h3>{query ? "No matching messages." : "Start with a hello."}</h3>
              <p>
                {query
                  ? "Try another word or clear the search."
                  : "Your first message is a good place to begin."}
              </p>
            </div>
          )}
          <div ref={bottom} />
        </div>
      </div>
      <ComposeBox
        key={c.id}
        name={c.name}
        value={c.draft}
        onChange={(body) => dispatch({ type: "draft", id: c.id, body })}
        onSend={(body) => {
          setQuery("");
          setSearchOpen(false);
          dispatch({
            type: "send",
            id: c.id,
            body,
            messageId: crypto.randomUUID(),
            at: new Date().toISOString(),
          });
        }}
      />
      {editing && (
        <Modal title="Edit your message" onClose={() => setEditing(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!editBody.trim()) return;
              dispatch({
                type: "edit",
                id: c.id,
                messageId: editing.id,
                body: editBody,
                at: new Date().toISOString(),
              });
              setEditing(null);
            }}
          >
            <label className="field-label" htmlFor="edit-message">
              Message
            </label>
            <textarea
              className="text-input edit-textarea"
              id="edit-message"
              autoFocus
              value={editBody}
              maxLength={MAX_BODY_LENGTH}
              onChange={(event) => setEditBody(event.target.value)}
            />
            <p className="field-help">
              Changes are saved to this local conversation.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="button button-outline"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                className="button button-accent"
                disabled={!editBody.trim()}
              >
                Save changes <Icon name="check" size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal title="Delete this message?" onClose={() => setDeleting(null)}>
          <p className="modal-description">
            This removes your message from this browser. This action cannot be
            undone.
          </p>
          <blockquote className="delete-preview">{deleting.body}</blockquote>
          <div className="modal-actions">
            <button
              className="button button-outline"
              onClick={() => setDeleting(null)}
            >
              Keep message
            </button>
            <button
              className="button button-danger"
              onClick={() => {
                dispatch({
                  type: "deleteMessage",
                  id: c.id,
                  messageId: deleting.id,
                });
                setDeleting(null);
              }}
            >
              Delete message
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
